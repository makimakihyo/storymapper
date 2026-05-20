import { createClient } from '@/lib/supabase/server';
import { BookmarkIcon, MessageSquareIcon } from 'lucide-react';
import { DeleteMemoButton } from './delete-memo-button';

interface MemoListProps {
  bookId: string;
  currentSceneId: string;
}

export async function MemoList({ bookId, currentSceneId }: MemoListProps) {
  const supabase = await createClient();

  const { data: memos, error } = await supabase
    .from('memos')
    .select('id, body, is_bookmark, created_at')
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
        まだメモがありません。「メモを追加」から始めましょう。
      </p>
    );
  }

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
          </div>
          <DeleteMemoButton bookId={bookId} memoId={memo.id} />
        </li>
      ))}
    </ul>
  );
}