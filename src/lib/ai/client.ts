import Anthropic from '@anthropic-ai/sdk';

// サーバ専用。ANTHROPIC_API_KEY は NEXT_PUBLIC を付けないこと(クライアント露出防止)。
export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

// モデルは1か所に集約(Day4でコスト/品質のノブとして触る)。
export const AI_MODELS = {
  // 要約は品質寄りで sonnet。
  characterSummary: 'claude-sonnet-4-6',
  // 抽出は Haiku 既定（Day6/7 検証: 忠実性同等・簡潔・安い）。
  stateExtraction: 'claude-haiku-4-5',
} as const;
