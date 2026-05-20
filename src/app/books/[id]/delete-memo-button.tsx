'use client';

import { useTransition } from 'react';
import { deleteMemo } from './actions';
import { Button } from '@/components/ui/button';
import { Trash2Icon } from 'lucide-react';

interface DeleteMemoButtonProps {
  bookId: string;
  memoId: string;
}

export function DeleteMemoButton({ bookId, memoId }: DeleteMemoButtonProps) {
  const [isPending, startTransition] = useTransition();

  const handleDelete = () => {
    if (!confirm('このメモを削除しますか?')) return;

    startTransition(async () => {
      const result = await deleteMemo(bookId, memoId);
      if (result?.error) {
        alert(`削除に失敗しました: ${result.error}`);
      }
    });
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      onClick={handleDelete}
      disabled={isPending}
      aria-label="メモを削除"
    >
      <Trash2Icon className="size-4 text-red-500" />
    </Button>
  );
}