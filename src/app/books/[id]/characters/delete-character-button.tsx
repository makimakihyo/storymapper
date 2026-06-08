'use client';

import { useTransition } from 'react';
import { Trash2Icon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { deleteCharacterAction } from './actions';

type Props = {
  bookId: string;
  characterId: string;
  characterName: string;
};

export function DeleteCharacterButton({
  bookId,
  characterId,
  characterName,
}: Props) {
  const [isPending, startTransition] = useTransition();

  const handleDelete = () => {
    if (!confirm(`「${characterName}」を削除しますか?`)) return;

    startTransition(async () => {
      const result = await deleteCharacterAction(bookId, characterId);
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
      aria-label={`${characterName}を削除`}
    >
      <Trash2Icon className="size-4 text-red-500" />
    </Button>
  );
}
