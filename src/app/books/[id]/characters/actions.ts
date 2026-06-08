'use server';

import { revalidatePath } from 'next/cache';

import { createClient } from '@/lib/supabase/server';
import {
  characterFormSchema,
  parseAliases,
  type CharacterFormInput,
} from '@/lib/schemas/character';

export type CreateCharacterFailure =
  | {
      kind: 'fieldErrors';
      fieldErrors: Partial<Record<keyof CharacterFormInput, string>>;
    }
  | { kind: 'formError'; message: string };

export async function createCharacterAction(
  bookId: string,
  input: CharacterFormInput,
): Promise<CreateCharacterFailure | void> {
  // 1) サーバ側 Zod 再バリデーション(クライアントが壊れていても弾く)
  const parsed = characterFormSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Partial<Record<keyof CharacterFormInput, string>> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (
        typeof key === 'string' &&
        !fieldErrors[key as keyof CharacterFormInput]
      ) {
        fieldErrors[key as keyof CharacterFormInput] = issue.message;
      }
    }
    return { kind: 'fieldErrors', fieldErrors };
  }
  const { name, aliases, notes } = parsed.data;

  // 2) 認証ユーザー確認
  const supabase = await createClient();
  const { data: claimsData, error: claimsError } =
    await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (claimsError || !userId) {
    return { kind: 'formError', message: 'サインインが必要です' };
  }

  // 3) 現在シーン取得(first_appearance_scene_id に入れる)。
  //    RLS で自分の本のみ。取得できなければ null のまま続行(scene_id は NULL 許容)。
  const { data: progress } = await supabase
    .from('reading_progress')
    .select('current_scene_id')
    .eq('book_id', bookId)
    .single();

  // 4) characters INSERT。book 所有権は RLS(characters_owner_all WITH CHECK)が担保。
  const { error: insertError } = await supabase.from('characters').insert({
    book_id: bookId,
    name,
    aliases: parseAliases(aliases),
    notes: notes && notes.length > 0 ? notes : null,
    first_appearance_scene_id: progress?.current_scene_id ?? null,
  });

  if (insertError) {
    return { kind: 'formError', message: 'キャラの登録に失敗しました' };
  }

  // 5) 同一ページ内の一覧へ即反映
  revalidatePath(`/books/${bookId}/characters`);
}
