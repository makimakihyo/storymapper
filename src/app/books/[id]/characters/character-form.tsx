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
import { createCharacterAction } from './actions';

type Props = {
  bookId: string;
};

export function CharacterForm({ bookId }: Props) {
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<CharacterFormInput>({
    resolver: zodResolver(characterFormSchema),
    defaultValues: {
      name: '',
      aliases: '',
      notes: '',
    },
  });

  const onSubmit = (data: CharacterFormInput) => {
    setServerError(null);
    startTransition(async () => {
      const result = await createCharacterAction(bookId, data);
      // 成功時は Server Action 側で revalidate のみ(redirect しない) → result は void
      if (!result) {
        reset();
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

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <div className="space-y-2">
        <Label htmlFor="name">キャラ名</Label>
        <Input
          id="name"
          placeholder="例: 羅輯"
          aria-invalid={!!errors.name}
          {...register('name')}
        />
        {errors.name && (
          <p className="text-sm text-destructive">{errors.name.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="aliases">別名(任意・カンマ区切り)</Label>
        <Input
          id="aliases"
          placeholder="例: luo ji, 面壁者"
          aria-invalid={!!errors.aliases}
          {...register('aliases')}
        />
        <p className="text-sm text-muted-foreground">
          複数ある場合はカンマ「,」で区切ってください。
        </p>
        {errors.aliases && (
          <p className="text-sm text-destructive">{errors.aliases.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">メモ(任意)</Label>
        <Input
          id="notes"
          placeholder="例: 社会学者。面壁計画の四人目"
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

      <Button type="submit" disabled={isPending}>
        {isPending ? '登録中…' : '追加する'}
      </Button>
    </form>
  );
}
