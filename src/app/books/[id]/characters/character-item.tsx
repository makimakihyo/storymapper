'use client';

import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  characterFormSchema,
  type CharacterFormInput,
} from '@/lib/schemas/character';
import { updateCharacterAction } from './actions';
import { DeleteCharacterButton } from './delete-character-button';

export type CharacterListItem = {
  id: string;
  name: string;
  aliases: string[] | null;
  notes: string | null;
};

type Props = {
  bookId: string;
  character: CharacterListItem;
};

export function CharacterItem({ bookId, character }: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);

  const defaults: CharacterFormInput = {
    name: character.name,
    aliases: character.aliases?.join(', ') ?? '',
    notes: character.notes ?? '',
  };

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<CharacterFormInput>({
    resolver: zodResolver(characterFormSchema),
    defaultValues: defaults,
  });

  const startEdit = () => {
    reset(defaults); // 最新の表示値でプリフィルし直す
    setServerError(null);
    setIsEditing(true);
  };

  const cancelEdit = () => {
    setServerError(null);
    setIsEditing(false);
  };

  const onSubmit = (data: CharacterFormInput) => {
    setServerError(null);
    startTransition(async () => {
      const result = await updateCharacterAction(bookId, character.id, data);
      // 成功時は revalidate のみ(redirect しない) → result は void
      if (!result) {
        setIsEditing(false);
        return;
      }
      if (result.kind === 'fieldErrors') {
        for (const [field, message] of Object.entries(result.fieldErrors)) {
          if (message) {
            setError(field as keyof CharacterFormInput, {
              type: 'server',
              message,
            });
          }
        }
        return;
      }
      setServerError(result.message);
    });
  };

  if (!isEditing) {
    return (
      <li className="rounded border p-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-medium">{character.name}</p>
            {character.aliases && character.aliases.length > 0 && (
              <p className="text-sm text-muted-foreground">
                別名: {character.aliases.join('、')}
              </p>
            )}
            {character.notes && (
              <p className="text-sm text-muted-foreground">{character.notes}</p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Button type="button" variant="outline" size="sm" onClick={startEdit}>
              編集
            </Button>
            <DeleteCharacterButton
              bookId={bookId}
              characterId={character.id}
              characterName={character.name}
            />
          </div>
        </div>
      </li>
    );
  }

  return (
    <li className="rounded border p-3">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3" noValidate>
        <div className="space-y-1">
          <Label htmlFor={`name-${character.id}`}>キャラ名</Label>
          <Input
            id={`name-${character.id}`}
            aria-invalid={!!errors.name}
            {...register('name')}
          />
          {errors.name && (
            <p className="text-sm text-destructive">{errors.name.message}</p>
          )}
        </div>

        <div className="space-y-1">
          <Label htmlFor={`aliases-${character.id}`}>
            別名(任意・カンマ区切り)
          </Label>
          <Input
            id={`aliases-${character.id}`}
            aria-invalid={!!errors.aliases}
            {...register('aliases')}
          />
          {errors.aliases && (
            <p className="text-sm text-destructive">{errors.aliases.message}</p>
          )}
        </div>

        <div className="space-y-1">
          <Label htmlFor={`notes-${character.id}`}>メモ(任意)</Label>
          <Input
            id={`notes-${character.id}`}
            aria-invalid={!!errors.notes}
            {...register('notes')}
          />
          {errors.notes && (
            <p className="text-sm text-destructive">{errors.notes.message}</p>
          )}
        </div>

        {serverError && (
          <p role="alert" className="text-sm text-destructive">
            {serverError}
          </p>
        )}

        <div className="flex gap-2">
          <Button type="submit" disabled={isPending}>
            {isPending ? '保存中…' : '保存'}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={cancelEdit}
            disabled={isPending}
          >
            キャンセル
          </Button>
        </div>
      </form>
    </li>
  );
}
