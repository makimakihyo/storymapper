'use server';

import { redirect } from 'next/navigation';
import type { SupabaseClient } from '@supabase/supabase-js';

import { createClient } from '@/lib/supabase/server';
import { bookFormSchema, type BookFormInput } from '@/lib/schemas/book';

// fractional indexing の初期値。後日 src/lib/scenes/position.ts に切り出す候補。
const INITIAL_SCENE_ORDER_KEY = 'a0';
const DEFAULT_FIRST_SCENE_LABEL = 'シーン1';

export type CreateBookFailure =
  | {
      kind: 'fieldErrors';
      fieldErrors: Partial<Record<keyof BookFormInput, string>>;
    }
  | { kind: 'formError'; message: string };

async function deleteBookSafely(
  supabase: SupabaseClient,
  bookId: string,
): Promise<void> {
  const { error } = await supabase.from('books').delete().eq('id', bookId);
  if (error) {
    // 補償失敗は孤児として残る。α版は console.error のみ。RPC 化で根本解決(β宿題)。
    console.error('[createBookAction] 補償削除失敗', { bookId, error });
  }
}

export async function createBookAction(
  input: BookFormInput,
): Promise<CreateBookFailure | void> {
  // 1) サーバ側 Zod 再バリデーション(クライアントが壊れていても弾く)
  const parsed = bookFormSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Partial<Record<keyof BookFormInput, string>> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (
        typeof key === 'string' &&
        !fieldErrors[key as keyof BookFormInput]
      ) {
        fieldErrors[key as keyof BookFormInput] = issue.message;
      }
    }
    return { kind: 'fieldErrors', fieldErrors };
  }
  const { title, author, first_scene_name } = parsed.data;

  // 2) 認証ユーザー確認
  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (claimsError || !userId) {
    return { kind: 'formError', message: 'サインインが必要です' };
  }

  // 3) books INSERT
  const { data: bookRow, error: booksError } = await supabase
    .from('books')
    .insert({ user_id: userId, title, author })
    .select('id')
    .single();

  if (booksError || !bookRow) {
    return { kind: 'formError', message: '本の登録に失敗しました' };
  }
  const bookId: string = bookRow.id;

  // 4) scenes INSERT
  const { data: sceneRow, error: scenesError } = await supabase
    .from('scenes')
    .insert({ book_id: bookId, order_key: INITIAL_SCENE_ORDER_KEY })
    .select('id')
    .single();

  if (scenesError || !sceneRow) {
    await deleteBookSafely(supabase, bookId);
    return { kind: 'formError', message: '最初のシーンの作成に失敗しました' };
  }
  const sceneId: string = sceneRow.id;

  // 5) labels INSERT (type=chapter)
  const labelName =
    first_scene_name && first_scene_name.length > 0
      ? first_scene_name
      : DEFAULT_FIRST_SCENE_LABEL;

  const { data: labelRow, error: labelsError } = await supabase
    .from('labels')
    .insert({ book_id: bookId, name: labelName, type: 'chapter' })
    .select('id')
    .single();

  if (labelsError || !labelRow) {
    await deleteBookSafely(supabase, bookId);
    return { kind: 'formError', message: 'シーンラベルの作成に失敗しました' };
  }
  const labelId: string = labelRow.id;

  // 6) scene_labels INSERT (M:N 紐付け)
  const { error: sceneLabelsError } = await supabase
    .from('scene_labels')
    .insert({ scene_id: sceneId, label_id: labelId });

  if (sceneLabelsError) {
    await deleteBookSafely(supabase, bookId);
    return {
      kind: 'formError',
      message: 'シーンとラベルの紐付けに失敗しました',
    };
  }

  // 7) reading_progress INSERT
  const { error: rpError } = await supabase.from('reading_progress').insert({
    book_id: bookId,
    current_scene_id: sceneId,
    mode: 'reading',
  });

  if (rpError) {
    await deleteBookSafely(supabase, bookId);
    return { kind: 'formError', message: '読書進捗の初期化に失敗しました' };
  }

  // 8) 成功: 暫定で / に戻す。/books/{bookId} は Day 6(5/14) で配線
  redirect('/books');
  }