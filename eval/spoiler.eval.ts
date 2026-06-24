import { summarizeCharacter, type CharacterStateForSummary } from '@/lib/ai/summarize-character';
import { anthropic } from '@/lib/ai/client';

// ===== 設定 =====
const GEN_MODELS = ['claude-sonnet-4-6', 'claude-haiku-4-5'] as const; // 生成側を振る
const JUDGE_MODEL = 'claude-sonnet-4-6'; // judge は固定（比較軸を生成側に限定）

// 料金（USD / 1M tokens, 2026-06 時点）出典: memo 末尾
const PRICE: Record<string, { in: number; out: number }> = {
  'claude-sonnet-4-6': { in: 3, out: 15 },
  'claude-haiku-4-5': { in: 1, out: 5 },
};

// ===== fixtures（standalone MEMOS の character_states 版）=====
type Fixture = {
  name: string;
  character: string;
  characterNotes: string | null;
  current: number;                       // 読者の現在シーン
  states: CharacterStateForSummary[];    // 全シーン分（未来も保持＝判定用）
};

const FIXTURES: Fixture[] = [
  {
    name: 'アキラ', character: 'アキラ', characterNotes: null, current: 2,
    states: [
      { scenePosition: 1, sceneName: '港町', currentLocation: '港町', goal: '灯台の鍵を探す', affiliation: null, emotion: null, notes: null },
      { scenePosition: 2, sceneName: null, currentLocation: '灯台', goal: '鍵穴の謎を解く', affiliation: null, emotion: null, notes: null },
      { scenePosition: 3, sceneName: null, currentLocation: '灯台', goal: 'ミナを追う', affiliation: '中立', emotion: '不信', notes: null },
      { scenePosition: 4, sceneName: null, currentLocation: '地下', goal: 'もう一方の鍵の在処を掴む', affiliation: null, emotion: null, notes: 'ミナに地図を奪われる' },
    ],
  },
  // Day4 で2-3キャラに拡張（current を変えてケースを増やす）
  {
    name: 'ミナ', character: 'ミナ', characterNotes: '寡黙な地図職人', current: 2,
    states: [
      { scenePosition: 1, sceneName: '港町', currentLocation: '市場', goal: '古い海図を売る', affiliation: '商人組合', emotion: null, notes: null },
      { scenePosition: 2, sceneName: null, currentLocation: '灯台前', goal: 'アキラを観察する', affiliation: '商人組合', emotion: '警戒', notes: null },
      { scenePosition: 3, sceneName: null, currentLocation: '地下', goal: '地図を奪い返す', affiliation: '裏組織', emotion: '決意', notes: 'アキラを裏切る' },
    ],
  },
];

// current 以前だけに絞る（生成器に渡す入力＝第1層フィルタの再現）
function statesUpTo(states: CharacterStateForSummary[], scene: number) {
  return states.filter((s) => s.scenePosition <= scene);
}


function forbiddenFutureFacts(f: Fixture, current: number): string[] {
  // 現在以前に既知の (field,value) を集める
  const known = new Set<string>();
  for (const s of f.states.filter((s) => s.scenePosition <= current)) {
    if (s.currentLocation) known.add(`loc:${s.currentLocation}`);
    if (s.goal) known.add(`goal:${s.goal}`);
    if (s.notes) known.add(`note:${s.notes}`);
  }
  return f.states
    .filter((s) => s.scenePosition > current)
    .map((s) => {
      const parts = [
        s.currentLocation && !known.has(`loc:${s.currentLocation}`) && `居場所=${s.currentLocation}`,
        s.goal && !known.has(`goal:${s.goal}`) && `目的=${s.goal}`,
        s.notes && !known.has(`note:${s.notes}`) && `メモ=${s.notes}`,
      ].filter(Boolean);
      return parts.length ? `[S${s.scenePosition}] ${parts.join(' / ')}` : null;
    })
    .filter((x): x is string => x !== null);
}

// ===== judge（eval_spoiler.py の judge_spoiler を忠実移植）=====
type Verdict = { leaked: boolean; leaked_facts: string[]; explanation: string };

function parseJsonLenient(text: string): Verdict {
  try { return JSON.parse(text); } catch {}
  const m = text.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch {} }
  return { leaked: true, leaked_facts: [], explanation: `JSONパース失敗(安全側でleak): ${text.slice(0, 120)}` };
}

async function judgeSpoiler(current: number, summary: string, forbidden: string[]) {
  if (forbidden.length === 0) {
    return { verdict: { leaked: false, leaked_facts: [], explanation: '未来事実なし' } as Verdict, usage: null, latencyMs: 0 };
  }
  const fb = forbidden.map((x) => `- ${x}`).join('\n');
  const prompt = `あなたはネタバレ検査官です。読者の現在位置はシーン${current}です。
次の「未来の事実」は読者がまだ読んでいない情報です。要約にこれらと実質同じ内容が含まれたらネタバレ=NGです。

未来の事実（含まれたらNG）:
${fb}

検査対象の要約:
"""${summary}"""

次のJSONのみ出力（前後に文章なし）:
{"leaked": true/false, "leaked_facts": ["該当id"], "explanation": "理由1-2文"}`;
  const t0 = performance.now();
  const res = await anthropic.messages.create({
    model: JUDGE_MODEL, max_tokens: 400, temperature: 0,
    system: 'あなたは厳密なネタバレ検査官です。与えられた未来の事実のみを基準に判定し、JSONのみを返します。',
    messages: [{ role: 'user', content: prompt }],
  });
  const latencyMs = Math.round(performance.now() - t0);
  const block = res.content.find((b) => b.type === 'text');
  const text = block && block.type === 'text' ? block.text.trim() : '';
  return { verdict: parseJsonLenient(text), usage: res.usage, latencyMs };
}

// ===== ケース定義（eval自体をeval）=====
// normal    : states[<=current] で生成 → expect leaked=false（多層防御の正常確認）
// gen_at    : states[<=genScene>current] で生成し current 基準で判定 → expect true（キャッシュ事故模擬）
// detection : 既知の漏れ要約を固定で渡す → expect true（判定器の検出力検査）
type CaseKind = 'normal' | 'gen_at' | 'detection';

// 既知の漏れ要約（detection 用・固定文字列）
const LEAKED_FIXED = 'アキラは灯台で鍵穴の謎を解いたあと地下へ向かい、ミナに地図を奪われてしまう。';

// ===== 集計器 =====
type Acc = { pass: number; total: number; genIn: number; genOut: number; judgeIn: number; judgeOut: number; genLat: number[]; judgeLat: number[] };
const newAcc = (): Acc => ({ pass: 0, total: 0, genIn: 0, genOut: 0, judgeIn: 0, judgeOut: 0, genLat: [], judgeLat: [] });

const p50 = (xs: number[]) => xs.length ? [...xs].sort((a, b) => a - b)[Math.floor((xs.length - 1) / 2)] : 0;
const cost = (model: string, inTok: number, outTok: number) =>
  inTok / 1e6 * PRICE[model].in + outTok / 1e6 * PRICE[model].out;

async function runCase(genModel: string, f: Fixture, kind: CaseKind, acc: Acc) {
  const current = f.current;
  const forbidden = forbiddenFutureFacts(f, current);
  let summary: string;
  let expectLeak: boolean;

  if (kind === 'detection') {
    summary = LEAKED_FIXED;
    expectLeak = true;
  } else {
    const genScene = kind === 'gen_at' ? Math.min(current + 2, f.states.length) : current;
    const input = statesUpTo(f.states, genScene);
    const r = await summarizeCharacter(
    {
        states: input,
        characterName: f.character,
        characterNotes: f.characterNotes,
        currentScenePosition: genScene,   // ← 既存の genScene をそのまま
    },   
    { model: genModel },
    );
    summary = r.summary;

    acc.genIn += r.usage.inputTokens;   // ← usage のフィールド名は実装に合わせる
    acc.genOut += r.usage.outputTokens;
    acc.genLat.push(r.latencyMs);
    expectLeak = kind === 'gen_at'; // current より先で生成＝漏れる想定
  }

  console.log(`  RAW[${f.name}/${kind}]:`, JSON.stringify(summary)); // ← ここ

  const j = await judgeSpoiler(current, summary, forbidden);
  if (j.usage) { acc.judgeIn += j.usage.input_tokens; acc.judgeOut += j.usage.output_tokens; acc.judgeLat.push(j.latencyMs); }

  const pass = j.verdict.leaked === expectLeak;
  acc.total++; if (pass) acc.pass++;
  console.log(`  [${pass ? 'PASS' : 'FAIL'}] ${f.name}/${kind} expect=${expectLeak} got=${j.verdict.leaked} :: ${j.verdict.explanation}`);
}

async function main() {
  for (const genModel of GEN_MODELS) {
    console.log(`\n=== 生成モデル: ${genModel} ===`);
    const acc = newAcc();
    const t0 = performance.now();
    for (const f of FIXTURES) {
      await runCase(genModel, f, 'normal', acc);
      await runCase(genModel, f, 'gen_at', acc);
    }
    // detection は判定器の検出力なので1本でよい（生成モデル非依存）
    await runCase(genModel, FIXTURES[0], 'detection', acc);

    const wall = Math.round(performance.now() - t0);
    const genCost = cost(genModel, acc.genIn, acc.genOut);
    const judgeCost = cost(JUDGE_MODEL, acc.judgeIn, acc.judgeOut);
    console.log(`--- 集計(${genModel}) ---`);
    console.log(`PASS ${acc.pass}/${acc.total}`);
    console.log(`生成 tokens in/out = ${acc.genIn}/${acc.genOut}  cost=$${genCost.toFixed(5)}  p50=${p50(acc.genLat)}ms`);
    console.log(`judge tokens in/out = ${acc.judgeIn}/${acc.judgeOut}  cost=$${judgeCost.toFixed(5)}  p50=${p50(acc.judgeLat)}ms`);
    console.log(`合計 cost=$${(genCost + judgeCost).toFixed(5)}  wall=${wall}ms`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });