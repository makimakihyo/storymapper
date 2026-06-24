'use client';

import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { BookmarkIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  characterFormSchema,
  type CharacterFormInput,
} from '@/lib/schemas/character';
import { updateCharacterAction, summarizeCharacterAction } from './actions';
import { DeleteCharacterButton } from './delete-character-button';
import {
  CharacterStateForm,
  type CharacterStatePrefill,
} from './character-state-form';


export type CharacterListItem = {
  id: string;
  name: string;
  aliases: string[] | null;
  notes: string | null;
};

type Props = {
  bookId: string;
  character: CharacterListItem;
  currentSceneId: string | null;
  currentScenePosition: number;
  currentSceneName: string | null;
  currentState: CharacterStatePrefill | null;
};

export function CharacterItem({
  bookId,
  character,
  currentSceneId,
  currentScenePosition,
  currentSceneName,
  currentState,
}: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [isSummarizing, startSummarize] = useTransition();

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
    reset(defaults);
    setServerError(null);
    setIsRecording(false);
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

  const handleSummarize = () => {
    setSummary(null);
    setSummaryError(null);
    startSummarize(async () => {
      const res = await summarizeCharacterAction(bookId, character.id);
      if (res.ok) {
        setSummary(res.summary);
      } else {
        setSummaryError(res.message);
      }
    });
  };

  // === 編集モード(① キャラクター設定の編集) ===
  if (isEditing) {
    return (
      <li className="rounded border p-3">
        <div className="mb-2 text-xs text-muted-foreground">
          キャラクター設定を編集
        </div>
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
              <p className="text-sm text-destructive">
                {errors.aliases.message}
              </p>
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

  // 現在シーンstateの1行サマリー(ラベル付き)
  const hasState =
    !!currentState &&
    [
      currentState.current_location,
      currentState.goal,
      currentState.affiliation,
    ].some((s) => s && s.length > 0);

  // 「シーンN: 名前 に記録」ラベル
  const sceneLabel =
    currentScenePosition > 0
      ? `シーン ${currentScenePosition}${
          currentSceneName ? `: ${currentSceneName}` : ''
        } に記録`
      : '現在シーン未設定';

  // === 通常表示(二ゾーン) ===
  return (
    <li className="overflow-hidden rounded border">
      {/* ① キャラクター設定(本を通じて) */}
      <div className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="text-[11px] text-muted-foreground">
              キャラクター設定（本を通じて）
            </div>
            <p className="mt-0.5 font-medium">{character.name}</p>
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
      </div>

      {/* ② 現在の状態(シーン毎) */}
      <div className="border-t bg-muted/40 p-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="text-[11px] text-muted-foreground">
              現在の状態（シーン毎）
            </div>
            {hasState ? (
              <p className="mt-0.5 text-sm">
                {currentState!.current_location && (
                  <>
                    <span className="text-muted-foreground">居場所 </span>
                    {currentState!.current_location}　
                  </>
                )}
                {currentState!.goal && (
                  <>
                    <span className="text-muted-foreground">目的 </span>
                    {currentState!.goal}　
                  </>
                )}
                {currentState!.affiliation && (
                  <>
                    <span className="text-muted-foreground">所属 </span>
                    {currentState!.affiliation}
                  </>
                )}
              </p>
            ) : (
              <p className="mt-0.5 text-sm text-muted-foreground">
                このシーンでは未記録
              </p>
            )}
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0"
            onClick={() => setIsRecording((v) => !v)}
          >
            {isRecording ? '閉じる' : '状態を記録'}
          </Button>
        </div>

        {isRecording && (
          <div className="mt-3">
            <div className="mb-2 inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs text-muted-foreground">
              <BookmarkIcon className="size-3.5" />
              {sceneLabel}
            </div>
            <CharacterStateForm
              bookId={bookId}
              characterId={character.id}
              currentSceneId={currentSceneId}
              initial={currentState}
              onSaved={() => setIsRecording(false)}
              onCancel={() => setIsRecording(false)}
            />
          </div>
        )}
      </div>

      {/* ③ ここまでの動向(AI要約) */}
      <div className="border-t p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="text-[11px] text-muted-foreground">
            ここまでの動向（AI要約・ネタバレなし）
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0"
            onClick={handleSummarize}
            disabled={isSummarizing || currentScenePosition === 0}
          >
            {isSummarizing ? '要約中…' : summary ? '再要約' : '要約する'}
          </Button>
        </div>

        {summaryError && (
          <p role="alert" className="mt-2 text-sm text-destructive">
            {summaryError}
          </p>
        )}

        {summary && (
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">
            {summary}
          </p>
        )}
      </div>
    </li>
  );
}