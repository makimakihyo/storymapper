'use client';

import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  characterStateFormSchema,
  type CharacterStateFormInput,
} from '@/lib/schemas/character';
import { saveCharacterStateAction } from './actions';

// 現在シーンの既存 state（プリフィル元）。無ければ null。
export type CharacterStatePrefill = {
  current_location: string | null;
  goal: string | null;
  affiliation: string | null;
};

type Props = {
  bookId: string;
  characterId: string;
  currentSceneId: string | null;
  initial: CharacterStatePrefill | null;
  onSaved?: () => void;
  onCancel?: () => void;
};

export function CharacterStateForm({
  bookId,
  characterId,
  currentSceneId,
  initial,
  onSaved,
  onCancel,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<CharacterStateFormInput>({
    resolver: zodResolver(characterStateFormSchema),
    // プリフィル＝現在シーンの既存record、無ければ空
    defaultValues: {
      current_location: initial?.current_location ?? '',
      goal: initial?.goal ?? '',
      affiliation: initial?.affiliation ?? '',
    },
  });

  // 現在シーンが無い（本を開いていない/シーン未作成）なら記録不可。
  if (!currentSceneId) {
    return (
      <p className="text-sm text-muted-foreground">
        現在シーンが未設定のため状態を記録できません。本を開いてシーンを進めてください。
      </p>
    );
  }

  const onSubmit = (data: CharacterStateFormInput) => {
    setServerError(null);
    startTransition(async () => {
      const result = await saveCharacterStateAction(
        bookId,
        characterId,
        currentSceneId,
        data,
      );
      // 成功時は Server Action 側で revalidate のみ → result は void
      if (!result) {
        onSaved?.();
        return;
      }
      if (result.kind === 'fieldErrors') {
        for (const [field, message] of Object.entries(result.fieldErrors)) {
          if (message) {
            setError(field as keyof CharacterStateFormInput, {
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
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-3" noValidate>
      <div className="space-y-1">
        <Label htmlFor={`loc-${characterId}`}>居場所</Label>
        <Input
          id={`loc-${characterId}`}
          placeholder="例: 面壁計画の地下施設"
          aria-invalid={!!errors.current_location}
          {...register('current_location')}
        />
        {errors.current_location && (
          <p className="text-sm text-destructive">
            {errors.current_location.message}
          </p>
        )}
      </div>

      <div className="space-y-1">
        <Label htmlFor={`goal-${characterId}`}>目的</Label>
        <Input
          id={`goal-${characterId}`}
          placeholder="例: 三体問題を逆手に取る呪文の準備"
          aria-invalid={!!errors.goal}
          {...register('goal')}
        />
        {errors.goal && (
          <p className="text-sm text-destructive">{errors.goal.message}</p>
        )}
      </div>

      <div className="space-y-1">
        <Label htmlFor={`aff-${characterId}`}>所属</Label>
        <Input
          id={`aff-${characterId}`}
          placeholder="例: 面壁者（味方）"
          aria-invalid={!!errors.affiliation}
          {...register('affiliation')}
        />
        {errors.affiliation && (
          <p className="text-sm text-destructive">
            {errors.affiliation.message}
          </p>
        )}
      </div>

      {/* refine「いずれか必須」エラーは path:['current_location'] に乗るため居場所欄下に出る */}
      {serverError && (
        <p role="alert" className="text-sm text-destructive">
          {serverError}
        </p>
      )}

      <div className="flex gap-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? '記録中…' : '現在シーンで記録'}
        </Button>
        {onCancel && (
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isPending}
          >
            閉じる
          </Button>
        )}
      </div>
    </form>
  );
}