import { anthropic, AI_MODELS } from './client';

/** 要約に渡す1シーン分の構造化状態(ネタバレフィルタ済みのものだけ渡すこと) */
export type CharacterStateForSummary = {
  scenePosition: number; // 1始まりのシーン位置(表示・並びの基準)
  sceneName: string | null;
  currentLocation: string | null;
  goal: string | null;
  affiliation: string | null;
  emotion: string | null;
  notes: string | null;
};

export type SummarizeUsage = {
  model: string;
  inputTokens: number;
  outputTokens: number;
};

export type SummarizeResult = {
  summary: string;
  usage: SummarizeUsage;
  latencyMs: number; // ← 追加
};

function buildStateBlock(states: CharacterStateForSummary[]): string {
  return states
    .map((s) => {
      const head = `- シーン${s.scenePosition}${s.sceneName ? `(${s.sceneName})` : ''}:`;
      const parts: string[] = [];
      if (s.currentLocation) parts.push(`居場所=${s.currentLocation}`);
      if (s.goal) parts.push(`目的=${s.goal}`);
      if (s.affiliation) parts.push(`所属=${s.affiliation}`);
      if (s.emotion) parts.push(`感情=${s.emotion}`);
      if (s.notes) parts.push(`メモ=${s.notes}`);
      return `${head} ${parts.join(' / ') || '(記録なし)'}`;
    })
    .join('\n');
}

/**
 * キャラの「ここまでの動向」をネタバレなしで要約する。
 * - 入力 states は呼び出し側で order_key <= 現在 にフィルタ済みであること(第1層)。
 * - system で事前知識禁止/未来言及禁止を固定(第2層)。
 * - 作品名は渡さない(ADR-0001: 匿名化)。
 */
export async function summarizeCharacter(params: {
  characterName: string;
  characterNotes: string | null;
  currentScenePosition: number;
  states: CharacterStateForSummary[];
},
  opts?: {model?: string},
): Promise<SummarizeResult> {
  const model = opts?.model ?? AI_MODELS.characterSummary;
  const { characterName, characterNotes, currentScenePosition, states } =
    params;

  const stateBlock = buildStateBlock(states);
  const background = characterNotes
    ? `\nキャラ設定メモ(背景): ${characterNotes}\n`
    : '';

  const prompt = `次は読者が登場人物「${characterName}」について記録した時系列の状態メモです。
現在の読書位置はシーン${currentScenePosition}です。
${background}
状態メモ(時系列):
${stateBlock}

これらのメモだけを根拠に、「${characterName}」のこれまでの動向を読者向けに要約してください。
- 「現在の状況 / 目的 / 主要な人間関係」の3点に整理する
- メモに無い情報は補完・推測しない(忠実性を最優先)
- シーン${currentScenePosition}より先の展開には一切触れない(ネタバレ厳禁)
- 出力は要約本文のみ`;

  const t0 = performance.now();
  const res = await anthropic.messages.create({
    model,
    max_tokens: 600,
    temperature: 0.2,
    system:
      'あなたは小説の読書支援アシスタントです。' +
      '与えられたメモのみを根拠に要約し、事前学習で得た作品知識は一切使いません。' +
      '未読部分のネタバレは絶対にしません。',
    messages: [{ role: 'user', content: prompt }],
  });
  const latencyMs = Math.round(performance.now() - t0);
  const block = res.content.find((b) => b.type === 'text');
  const summary = block && block.type === 'text' ? block.text.trim() : '';

  return {
    summary,
    usage: {
      model: AI_MODELS.characterSummary,
      inputTokens: res.usage.input_tokens,
      outputTokens: res.usage.output_tokens,
    },
    latencyMs,
  };
}