'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { incrementOrderKey } from '@/lib/scenes/order-key';
import { createMemoSchema } from '@/lib/schemas/memo';

export async function progressScene(bookId: string): Promise<void> {
  const supabase = await createClient();

  // 1. 認証確認(RLS の防衛線は別途あるが、手前で弾く)
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims) {
    throw new Error('Unauthorized');
  }

  // 2. 現在の reading_progress を取得
  const { data: progress, error: progressError } = await supabase
    .from('reading_progress')
    .select('current_scene_id')
    .eq('book_id', bookId)
    .single();

  if (progressError || !progress?.current_scene_id) {
    throw new Error(`Reading progress not found: ${progressError?.message}`);
  }

  // 3. 現在シーンの order_key を取得
  const { data: currentScene, error: currentSceneError } = await supabase
    .from('scenes')
    .select('order_key')
    .eq('id', progress.current_scene_id)
    .single();

  if (currentSceneError || !currentScene) {
    throw new Error(`Current scene not found: ${currentSceneError?.message}`);
  }

  // 4. 次の既存シーンを探す(order_key で次に来るもの)
  const { data: nextScene } = await supabase
    .from('scenes')
    .select('id')
    .eq('book_id', bookId)
    .gt('order_key', currentScene.order_key)
    .order('order_key', { ascending: true })
    .limit(1)
    .maybeSingle();

  let nextSceneId: string;
  if (nextScene) {
    // 4a. 既存シーンがある → そこへ移動
    nextSceneId = nextScene.id;
  } else {
    // 4b. 既存シーンが無い → 新規 INSERT(label 無し、自動連番)
    const newOrderKey = incrementOrderKey(currentScene.order_key);
    const { data: created, error: insertError } = await supabase
      .from('scenes')
      .insert({
        book_id: bookId,
        order_key: newOrderKey,
      })
      .select('id')
      .single();

    if (insertError || !created) {
      throw new Error(`Failed to create scene: ${insertError?.message}`);
    }
    nextSceneId = created.id;
  }

  // 5. reading_progress.current_scene_id を更新
  const { error: updateError } = await supabase
    .from('reading_progress')
    .update({ current_scene_id: nextSceneId })
    .eq('book_id', bookId);

  if (updateError) {
    throw new Error(`Failed to update reading_progress: ${updateError.message}`);
  }

  // 6. ページ再描画
  revalidatePath(`/books/${bookId}`);
}

// =====================================================================
// メモ・ブックマーク作成・削除
// =====================================================================

export type MemoActionFailure = { error: string };

export async function createMemo(
  bookId: string,
  formData: FormData,
): Promise<MemoActionFailure | void> {
  const parsed = createMemoSchema.safeParse({
    scene_id: formData.get('scene_id'),
    body: formData.get('body'),
    is_bookmark: formData.get('is_bookmark') === 'on',
  });

  if (!parsed.success) {
    return { error: parsed.error.issues.map((i) => i.message).join(' / ') };
  }

  const supabase = await createClient();

  // 認証確認(progressScene と同パターン、手前で弾く)
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims) {
    return { error: 'Unauthorized' };
  }

  const { error } = await supabase.from('memos').insert({
    scene_id: parsed.data.scene_id,
    body: parsed.data.body,
    is_bookmark: parsed.data.is_bookmark,
    // is_flashback_ref / refers_to_scene_id / bookmark_note は DEFAULT/NULL のまま
  });

  if (error) {
    return { error: `メモ作成に失敗しました: ${error.message}` };
  }

  revalidatePath(`/books/${bookId}`);
}

export async function deleteMemo(
  bookId: string,
  memoId: string,
): Promise<MemoActionFailure | void> {
  const supabase = await createClient();

  // 認証確認
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims) {
    return { error: 'Unauthorized' };
  }

  const { error } = await supabase.from('memos').delete().eq('id', memoId);

  if (error) {
    return { error: `メモ削除に失敗しました: ${error.message}` };
  }

  revalidatePath(`/books/${bookId}`);
}