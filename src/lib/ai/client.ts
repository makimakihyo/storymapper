import Anthropic from '@anthropic-ai/sdk';

// サーバ専用。ANTHROPIC_API_KEY は NEXT_PUBLIC を付けないこと(クライアント露出防止)。
export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

// モデルは1か所に集約(Day4でコスト/品質のノブとして触る)。
export const AI_MODELS = {
  // 要約は品質寄りで sonnet。コスト計測後に haiku への切替を検討(Day4)。
  characterSummary: 'claude-sonnet-4-6',
} as const;