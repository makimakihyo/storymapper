'use server';

import { revalidatePath } from 'next/cache';

import { createClient } from '@/lib/supabase/server';
import {
  characterFormSchema,
  characterStateFormSchema,
  parseAliases,
  type CharacterFormInput,
  type CharacterStateFormInput,
} from '@/lib/schemas/character';
import {
  characterBelongsToBook,
  sceneBelongsToBook,
} from '@/lib/books/ownership';

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
    .eq('id', characterId)
    .eq('book_id', bookId);

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
    .eq('id', characterId)
    .eq('book_id', bookId);
  
  if (error) {
    return { error: `キャラ削除に失敗しました` };
  }

  revalidatePath(`/books/${bookId}/characters`);
}

export type CharacterStateFailure =
  | {
      kind: 'fieldErrors';
      fieldErrors: Partial<Record<keyof CharacterStateFormInput, string>>;
    }
  | { kind: 'formError'; message: string };

function toStateFieldErrors(
  issues: { path: PropertyKey[]; message: string }[],
): Partial<Record<keyof CharacterStateFormInput, string>> {
  const fieldErrors: Partial<Record<keyof CharacterStateFormInput, string>> = {};
  for (const issue of issues) {
    const key = issue.path[0];
    if (
      typeof key === 'string' &&
      !fieldErrors[key as keyof CharacterStateFormInput]
    ) {
      fieldErrors[key as keyof CharacterStateFormInput] = issue.message;
    }
  }
  return fieldErrors;
}

/**
 * キャラ状態を「同一シーンならUPSERT(上書き)」で保存する。
 * - observed_in_scene_id は α簡易運用で scene_id と同値(ADR-0006)。
 * - updated_at はトリガ trg_character_states_updated が自動更新。
 */
export async function saveCharacterStateAction(
  bookId: string,
  characterId: string,
  sceneId: string,
  input: CharacterStateFormInput,
): Promise<CharacterStateFailure | void> {
  // 1) サーバ側 Zod 再バリデーション
  const parsed = characterStateFormSchema.safeParse(input);
  if (!parsed.success) {
    return {
      kind: 'fieldErrors',
      fieldErrors: toStateFieldErrors(parsed.error.issues),
    };
  }
  const { current_location, goal, affiliation } = parsed.data;

  // 2) 認証ユーザー確認
  const supabase = await createClient();
  const { data: claimsData, error: claimsError } =
    await supabase.auth.getClaims();
  if (claimsError || !claimsData?.claims?.sub) {
    return { kind: 'formError', message: 'サインインが必要です' };
  }

  // 3) 所有・整合ガード: character と scene が共に同一 book(=自分のもの)か。
  //    RLS は character_id しか縛らないため scene_id を明示検証(Week6 と同クラスの穴を塞ぐ)。
  const [charOk, sceneOk] = await Promise.all([
    characterBelongsToBook(supabase, bookId, characterId),
    sceneBelongsToBook(supabase, bookId, sceneId),
  ]);
  if (!charOk || !sceneOk) {
    return { kind: 'formError', message: '不正なキャラまたはシーンです' };
  }

  // 4) UPSERT(同一 character_id+scene_id は上書き)
  const { data: saved, error: upsertError } = await supabase
    .from('character_states')
    .upsert(
      {
        character_id: characterId,
        scene_id: sceneId,
        observed_in_scene_id: sceneId,
        current_location:
          current_location && current_location.length > 0
            ? current_location
            : null,
        goal: goal && goal.length > 0 ? goal : null,
        affiliation:
          affiliation && affiliation.length > 0 ? affiliation : null,
      },
      { onConflict: 'character_id,scene_id' },
    )
    .select('id')
    .maybeSingle();

  if (upsertError || !saved) {
    return { kind: 'formError', message: 'キャラ状態の保存に失敗しました' };
  }

  // 5) 同一ページ内の一覧へ即反映
  revalidatePath(`/books/${bookId}/characters`);
}