import { z } from 'zod';

export const bookFormSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'タイトルを入力してください')
    .max(200, 'タイトルは200文字以内で入力してください'),
  author: z
    .string()
    .trim()
    .min(1, '著者を入力してください')
    .max(100, '著者は100文字以内で入力してください'),
  first_scene_name: z
    .string()
    .trim()
    .max(100, 'シーン名は100文字以内で入力してください')
    .optional()
    .or(z.literal('')),
});

export type BookFormInput = z.infer<typeof bookFormSchema>;