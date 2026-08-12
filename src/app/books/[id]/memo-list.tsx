import { createClient } from '@/lib/supabase/server';
import { BookmarkIcon, MessageSquareIcon } from 'lucide-react';
import { DeleteMemoButton } from './delete-memo-button';
import { SendToCharacter, type SendCharacterChoice } from './send-to-character';
import type { CharacterStatePrefill } from './characters/character-state-form';

interface MemoListProps {
  bookId: string;
  currentSceneId: string;
  // 現在シーンの絶対位置N（§9 上書き文言・送信先 scene 表記に使う）。
  currentSceneN: number;
}

export async function MemoList({
  bookId,
  currentSceneId,
  currentSceneN,
}: MemoListProps) {
  const supabase = await createClient();

  const { data: memos, error } = await supabase
    .from('memos')
    // N3: scene_id 追加＝送信先 scene を明示的に持ち回る（スナップショット堅牢化）。
    .select('id, body, is_bookmark, created_at, scene_id')
    .eq('scene_id', currentSceneId)
    .order('created_at', { ascending: false });

  if (error) {
    return (
      <p className="text-sm text-red-600">
        メモ取得エラー: {error.message}
      </p>
    );
  }

  if (!memos || memos.length === 0) {
    return (
      <p className="text-sm text-gray-500">
        まだメモがありません。「書き留める」から始めましょう。
      </p>
    );
  }

  // N3「この人物の状態へ送る」用の先読み。
  //   memo-list は現在シーンの memo のみ＝送信先 scene は currentSceneId（=各 memo.scene_id）。
  //   prefill 元 state は (character × 送信先scene) の既存 state（コピーでなくルーティング）。
  const { data: characters } = await supabase
    .from('characters')
    .select('id, name')
    .eq('book_id', bookId)
    .order('created_at', { ascending: true });

  const initialByCharacter = new Map<string, CharacterStatePrefill>();
  if (characters && characters.length > 0) {
    const { data: states } = await supabase
      .from('character_states')
      .select('character_id, raw_memo, current_location, goal, affiliation')
      .eq('scene_id', currentSceneId)
      .in(
        'character_id',
        characters.map((c) => c.id),
      );
    for (const s of states ?? []) {
      initialByCharacter.set(s.character_id, {
        raw_memo: s.raw_memo,
        current_location: s.current_location,
        goal: s.goal,
        affiliation: s.affiliation,
      });
    }
  }

  const characterChoices: SendCharacterChoice[] = (characters ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    initial: initialByCharacter.get(c.id) ?? null,
  }));

  return (
    <ul className="space-y-3">
      {memos.map((memo) => (
        <li
          key={memo.id}
          className="flex items-start gap-3 rounded border p-3"
        >
          <div className="flex-shrink-0 mt-1">
            {memo.is_bookmark ? (
              <BookmarkIcon className="size-4 text-amber-500" />
            ) : (
              <MessageSquareIcon className="size-4 text-gray-400" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm whitespace-pre-wrap break-words">
              {memo.body}
            </p>
            <p className="mt-1 text-xs text-gray-500">
              {new Date(memo.created_at).toLocaleString('ja-JP')}
            </p>
            {/* 非しおり memo にのみ「送る」導線（しおりは body 空＝送る対象外）。 */}
            {!memo.is_bookmark && (
              <SendToCharacter
                bookId={bookId}
                sceneId={memo.scene_id}
                sceneN={currentSceneN}
                characters={characterChoices}
              />
            )}
          </div>
          <DeleteMemoButton bookId={bookId} memoId={memo.id} />
        </li>
      ))}
    </ul>
  );
}
