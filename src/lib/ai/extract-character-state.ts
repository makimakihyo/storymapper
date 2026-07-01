import { anthropic, AI_MODELS } from './client';

/** 抽出して character-state-form に prefill する3欄（DBカラム名に合わせる）。 */
export type ExtractedState = {
  current_location: string; // メモに無ければ ''（空）
  goal: string;
  affiliation: string;
  evidence: string; // 各欄の根拠語句（任意・デバッグ/将来のUI補助用）
};

export type ExtractUsage = {
  model: string;
  inputTokens: number;
  outputTokens: number;
};

export type ExtractResult = {
  fields: ExtractedState;
  usage: ExtractUsage;
};

/**
 * affiliation 正規化（ADR-0007）: 括弧類と前後空白を除いてグラフ化キーの一致を担保。
 * 例: 『組合』 / 「組合」 / 組合  → すべて "組合"。raw_memo は無加工で別途保持。
 */
function normalizeAffiliation(v: string): string {
  return v.replace(/[『』「」\s]/g, '').trim();
}

// 構造強制ツール: character_states の3欄。書かれていない欄は空文字に。
const EXTRACT_TOOL = {
  name: 'fill_character_state',
  description:
    'あるシーンでの、ある登場人物の状態を自由文メモから抽出してフォームに埋める。' +
    'メモに明示された情報だけを使い、書かれていない欄は空文字にする。',
  input_schema: {
    type: 'object' as const,
    properties: {
      location: {
        type: 'string',
        description: '居場所。メモに明示が無ければ空文字（推測しない＝厳格）。',
      },
      goal: {
        type: 'string',
        description:
          '行動の目的・狙い。名詞句で短く。メモから軽く読み取れる範囲は可、無ければ空文字。',
      },
      affiliation: {
        type: 'string',
        description:
          '所属・関わる勢力。メモに明示が無ければ空文字（推測しない＝厳格・誤所属はデータ汚染）。',
      },
      evidence: {
        type: 'string',
        description: '各欄の根拠となったメモ中の語句。無ければ空文字。',
      },
    },
    required: ['location', 'goal', 'affiliation'],
  },
};

/**
 * (シーン×キャラ) の自由文メモ → character_states の3欄を抽出する。
 * - キャラ・シーンは UI で確定済み＝メモ本文から推定しない（coreference の地雷は UI で解消済み）。
 * - 抽出スコープ＝対象キャラのみ（メモが他キャラに言及しても対象キャラの state だけ埋める, v1）。
 * - 厳格度（ADR-0007）: current_location/affiliation=厳格（無ければ空）, goal=軽い推測可。
 * - 返す3欄は派生・助言的。canonical は raw_memo（呼び出し側で保存）。
 */
export async function extractCharacterState(params: {
  rawMemo: string;
  characterName: string;
  scenePosition: number;
  knownCharacters: string[];
}): Promise<ExtractResult> {
  const { rawMemo, characterName, scenePosition, knownCharacters } = params;

  const system =
    'あなたは小説の読書メモから、ある登場人物の状態を構造化する抽出器です。' +
    'メモに明示された情報のみを使い、書かれていない欄は空にします（推測で埋めない）。' +
    `対象人物は「${characterName}」、現在の読書位置はシーン${scenePosition}です。` +
    (knownCharacters.length
      ? `既知の登場人物: ${knownCharacters.join('、')}。`
      : '') +
    'メモが他の人物に言及していても、抽出するのは対象人物の状態だけにします。' +
    'goal は名詞句で短くまとめます。current_location と affiliation はメモに明示が無ければ必ず空文字にします。';

  const user = `対象「${characterName}」のシーン${scenePosition}でのメモ:\n${rawMemo}`;

  const res = await anthropic.messages.create({
    model: AI_MODELS.stateExtraction,
    max_tokens: 512,
    temperature: 0,
    system,
    tools: [EXTRACT_TOOL],
    tool_choice: { type: 'tool', name: 'fill_character_state' },
    messages: [{ role: 'user', content: user }],
  });

  const block = res.content.find(
    (b) => b.type === 'tool_use' && b.name === 'fill_character_state',
  );
  if (!block || block.type !== 'tool_use') {
    throw new Error('extractCharacterState: tool_use ブロックが返らなかった');
  }

  const f = block.input as {
    location?: string;
    goal?: string;
    affiliation?: string;
    evidence?: string;
  };

  return {
    fields: {
      current_location: (f.location ?? '').trim(),
      goal: (f.goal ?? '').trim(),
      affiliation: normalizeAffiliation(f.affiliation ?? ''),
      evidence: (f.evidence ?? '').trim(),
    },
    usage: {
      model: AI_MODELS.stateExtraction,
      inputTokens: res.usage.input_tokens,
      outputTokens: res.usage.output_tokens,
    },
  };
}