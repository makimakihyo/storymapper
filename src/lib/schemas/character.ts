import { z } from 'zod';

export const characterFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'キャラ名を入力してください')
    .max(100, 'キャラ名は100文字以内で入力してください'),
  // カンマ区切りの生入力。配列化は parseAliases で行う(α版)。
  aliases: z
    .string()
    .trim()
    .max(200, '別名は合計200文字以内で入力してください')
    .optional()
    .or(z.literal('')),
  notes: z
    .string()
    .trim()
    .max(1000, 'メモは1000文字以内で入力してください')
    .optional()
    .or(z.literal('')),
});

export type CharacterFormInput = z.infer<typeof characterFormSchema>;

// "A, B, , C" -> ['A','B','C'] / 空なら null(characters.aliases は TEXT[] NULL 許容)
export function parseAliases(raw: string | undefined): string[] | null {
  if (!raw) return null;
  const arr = raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  return arr.length > 0 ? arr : null;
}
