'use client';

import { useState, useRef, useEffect, useTransition } from 'react';
import { BookmarkIcon } from 'lucide-react';
import { updateSceneSummaryAction } from './actions';

type Props = {
  bookId: string;
  sceneId: string | null;
  summary: string | null;
  chapterLabel: string | null;
};

export function SceneNameEditor({
  bookId,
  sceneId,
  summary,
  chapterLabel,
}: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 表示優先度: summary → 章ラベル(フォールバック) → なし
  const displayName = summary ?? chapterLabel ?? '';
  const hasName = displayName.length > 0;
  const isFallback = !summary && !!chapterLabel; // 章ラベルをシーン名位置に出している
  // de-dup: 章ラベル文脈行は「summaryがある」かつ「章ラベルと異なる」ときだけ
  const showChapterContext =
    !!summary && !!chapterLabel && chapterLabel !== summary;

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditing]);

  const save = (value: string) => {
    if (!sceneId) return;
    // 変更なし(現 summary と同じ)なら何もしない
    const current = summary ?? '';
    if (value.trim() === current.trim()) {
      setIsEditing(false);
      return;
    }
    startTransition(async () => {
      const result = await updateSceneSummaryAction(bookId, sceneId, value);
      if (result?.error) {
        setError(result.error);
        return; // 編集状態を維持
      }
      setError(null);
      setIsEditing(false);
    });
  };

  // 現在シーンが無いときは静的表示のみ(編集不可)
  if (!sceneId) {
    return hasName ? (
      <div className="text-lg font-medium text-gray-500">{displayName}</div>
    ) : (
      <div className="text-lg font-medium italic text-gray-400">
        (シーン未設定)
      </div>
    );
  }

  if (isEditing) {
    return (
      <div className="space-y-1">
        <input
          ref={inputRef}
          type="text"
          defaultValue={summary ?? chapterLabel ?? ''}
          maxLength={200}
          disabled={isPending}
          className="w-full max-w-md rounded border px-2 py-1 text-lg font-medium"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              save((e.target as HTMLInputElement).value);
            } else if (e.key === 'Escape') {
              e.preventDefault();
              setError(null);
              setIsEditing(false);
            }
          }}
          onBlur={(e) => save(e.target.value)}
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <p className="text-xs text-gray-500">
          Enter / フォーカスを外すと保存、Esc で取消。空にすると未設定に戻ります。
        </p>
      </div>
    );
  }

  return (
    <div>
      {showChapterContext && (
        <div className="flex items-center gap-1 text-sm text-gray-500">
          <BookmarkIcon className="size-3.5" />
          <span>{chapterLabel}</span>
        </div>
      )}
      <button
        type="button"
        onClick={() => {
          setError(null);
          setIsEditing(true);
        }}
        className={`text-left text-lg font-medium hover:underline ${
          hasName
            ? isFallback
              ? 'text-gray-500'
              : 'text-gray-900'
            : 'italic text-gray-400'
        }`}
      >
        {hasName ? displayName : '＋ シーン名を追加'}
      </button>
    </div>
  );
}