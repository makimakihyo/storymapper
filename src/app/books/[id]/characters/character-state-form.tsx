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
import {
  saveCharacterStateAction,
  extractCharacterStateAction,
} from './actions';

// 現在シーンの既存 state（プリフィル元）。無ければ null。
export type CharacterStatePrefill = {
  raw_memo: string | null;
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
  const [isExtracting, startExtract] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const [extractError, setExtractError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    setValue,
    getValues,
    formState: { errors },
  } = useForm<CharacterStateFormInput>({
    resolver: zodResolver(characterStateFormSchema),
    // プリフィル＝現在シーンの既存record、無ければ空
    defaultValues: {
      raw_memo: initial?.raw_memo ?? '',
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

  // 自由文メモ → AI抽出 → 3欄を prefill（保存はしない）。
  const handleExtract = () => {
    setExtractError(null);
    const memo = (getValues('raw_memo') ?? '').trim();
    if (!memo) {
      setExtractError('メモを入力してから抽出してください');
      return;
    }
    startExtract(async () => {
      const res = await extractCharacterStateAction(
        bookId,
        characterId,
        currentSceneId,
        memo,
      );
      if (res.ok) {
        setValue('current_location', res.fields.current_location, {
          shouldDirty: true,
        });
        setValue('goal', res.fields.goal, { shouldDirty: true });
        setValue('affiliation', res.fields.affiliation, { shouldDirty: true });
      } else {
        setExtractError(res.message);
      }
    });
  };

  const onSubmit = (data: CharacterStateFormInput) => {
    setServerError(null);
    startTransition(async () => {
      const result = await saveCharacterStateAction(
        bookId,
        characterId,
        currentSceneId,
        data,
      );
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
      {/* 自由文メモ（canonical）＋ 抽出ボタン */}
      <div className="space-y-1">
        <Label htmlFor={`memo-${characterId}`}>状態メモ（自由文）</Label>
        <textarea
          id={`memo-${characterId}`}
          rows={3}
          placeholder="例: 港町の酒場にいる。灯台の鍵を探している。組合と対立中。"
          aria-invalid={!!errors.raw_memo}
          className="flex min-h-[72px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          {...register('raw_memo')}
        />
        {errors.raw_memo && (
          <p className="text-sm text-destructive">{errors.raw_memo.message}</p>
        )}
        <div className="flex items-center gap-2 pt-1">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={handleExtract}
            disabled={isExtracting || isPending}
          >
            {isExtracting ? '抽出中…' : 'メモから抽出'}
          </Button>
          <span className="text-xs text-muted-foreground">
            抽出結果は下の3欄に入ります。編集して記録できます。
          </span>
        </div>
        {extractError && (
          <p role="alert" className="text-sm text-destructive">
            {extractError}
          </p>
        )}
      </div>

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

      {serverError && (
        <p role="alert" className="text-sm text-destructive">
          {serverError}
        </p>
      )}

      <div className="flex gap-2">
        <Button type="submit" disabled={isPending || isExtracting}>
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