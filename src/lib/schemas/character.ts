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

export const characterStateFormSchema = z.object({
  // canonical（ADR-0007）。memos-first では必須。
  raw_memo: z
    .string().trim()
    .min(1, 'メモを入力してください')
    .max(2000, 'メモは2000文字以内で入力してください'),
  // 以下3欄は抽出由来＝任意（ユーザーが編集可能）。
  current_location: z
    .string().trim().max(200, '居場所は200文字以内で入力してください')
    .optional().or(z.literal('')),
  goal: z
    .string().trim().max(200, '目的は200文字以内で入力してください')
    .optional().or(z.literal('')),
  affiliation: z
    .string().trim().max(100, '所属は100文字以内で入力してください')
    .optional().or(z.literal('')),
});

export type CharacterStateFormInput = z.infer<typeof characterStateFormSchema>;