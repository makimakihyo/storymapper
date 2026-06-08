'use server';

import { revalidatePath } from 'next/cache';

import { createClient } from '@/lib/supabase/server';
import {
  characterFormSchema,
  parseAliases,
  type CharacterFormInput,
} from '@/lib/schemas/character';

export type CharacterFormFailure =
  | {
      kind: 'fieldErrors';
      fieldErrors: Partial<Record<keyof CharacterFormInput, string>>;
    }
  | { kind: 'formError'; message: string };

// Zod issues -> fieldErrors への共通整形
function toFieldErrors(
  issues: { path: PropertyKey[]; message: string }[],
): Partial<Record<keyof CharacterFormInput, string>> {
  const fieldErrors: Partial<Record<keyof CharacterFormInput, string>> = {};
  for (const issue of issues) {
    const key = issue.path[0];
    if (
      typeof key === 'string' &&
      !fieldErrors[key as keyof CharacterFormInput]
    ) {
      fieldErrors[key as keyof CharacterFormInput] = issue.message;
    }
  }
  return fieldErrors;
}

export async function createCharacterAction(
  bookId: string,
  input: CharacterFormInput,
): Promise<CharacterFormFailure | void> {
  // 1) サーバ側 Zod 再バリデーション(クライアントが壊れていても弾く)
  const parsed = characterFormSchema.safeParse(input);
  if (!parsed.success) {
    return { kind: 'fieldErrors', fieldErrors: toFieldErrors(parsed.error.issues) };
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

export async function updateCharacterAction(
  bookId: string,
  characterId: string,
  input: CharacterFormInput,
): Promise<CharacterFormFailure | void> {
  // 1) サーバ側 Zod 再バリデーション
  const parsed = characterFormSchema.safeParse(input);
  if (!parsed.success) {
    return { kind: 'fieldErrors', fieldErrors: toFieldErrors(parsed.error.issues) };
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

  // 3) characters UPDATE。所有権は RLS(characters_owner_all USING)が担保するため
  //    .eq('id', characterId) のみで他人の行は更新されない。
  //    first_appearance_scene_id は編集対象外(作成時の値を維持)。updated_at はトリガで自動更新。
  const { error: updateError } = await supabase
    .from('characters')
    .update({
      name,
      aliases: parseAliases(aliases),
      notes: notes && notes.length > 0 ? notes : null,
    })
    .eq('id', characterId);

  if (updateError) {
    return { kind: 'formError', message: 'キャラの更新に失敗しました' };
  }

  // 4) 同一ページ内の一覧へ即反映
  revalidatePath(`/books/${bookId}/characters`);
}

export async function deleteCharacterAction(
  bookId: string,
  characterId: string,
): Promise<{ error: string } | void> {
  const supabase = await createClient();

  // 認証確認
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims) {
    return { error: 'Unauthorized' };
  }

  // 所有権は RLS(characters_owner_all USING)が担保。
  // 関連 character_states / character_relationships は FK ON DELETE CASCADE で
  // 連鎖削除(Week 6 時点では未使用=空)。
  const { error } = await supabase
    .from('characters')
    .delete()
    .eq('id', characterId);

  if (error) {
    return { error: `キャラ削除に失敗しました: ${error.message}` };
  }

  revalidatePath(`/books/${bookId}/characters`);
}
