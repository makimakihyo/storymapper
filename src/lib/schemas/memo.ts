import { z } from 'zod'

export const createMemoSchema = z.object({
  scene_id: z.string().uuid(),
  body: z
    .string()
    .trim()
    .min(1, '本文を入力してください')
    .max(2000, '2000文字以内で入力してください'),
  is_bookmark: z.boolean().default(false),
})

export type CreateMemoInput = z.infer<typeof createMemoSchema>