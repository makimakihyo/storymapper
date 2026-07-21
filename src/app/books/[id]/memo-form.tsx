'use client';

import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createMemoSchema, type CreateMemoInput } from '@/lib/schemas/memo';
import { createMemo } from './actions';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

interface MemoFormProps {
  bookId: string;
  currentSceneId: string;
}

export function MemoForm({ bookId, currentSceneId }: MemoFormProps) {
  const [open, setOpen] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<CreateMemoInput>({
    resolver: zodResolver(createMemoSchema),
    defaultValues: {
      scene_id: currentSceneId,
      body: '',
      is_bookmark: false,
    },
  });

  const onSubmit = (data: CreateMemoInput) => {
    setFormError(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set('scene_id', data.scene_id);
      formData.set('body', data.body);
      // N1: 書く入口は自由文の「書き留める」1つに集約。is_bookmark は常に false
      // （送らない＝createMemo 側で false 相当）。しおりは N2（独立ボタン）が引き取る。

      const result = await createMemo(bookId, formData);
      if (result?.error) {
        setFormError(result.error);
        return;
      }

      // 成功時: フォームクリア + Dialog 閉じる（reset 先行で isDirty=false に落とす）
      reset();
      setOpen(false);
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // N4: 書きかけ（dirty）があるまま閉じ要求（Escape・背景タップ・×）が来たら
        // 閉じさせずインライン確認へ。保存成功時は onSubmit が setOpen を直呼びし迂回。
        if (!next && isDirty) {
          setConfirmDiscard(true);
          return;
        }
        setOpen(next);
      }}
    >
      <DialogTrigger asChild>
        <Button>書き留める</Button>
      </DialogTrigger>
      <DialogContent>
        {confirmDiscard ? (
          <>
            <DialogHeader>
              <DialogTitle>破棄しますか？</DialogTitle>
              <DialogDescription>
                書きかけの覚書があります。破棄すると元に戻せません。
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setConfirmDiscard(false)}
              >
                編集に戻る
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  reset();
                  setConfirmDiscard(false);
                  setOpen(false);
                }}
              >
                破棄する
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>書き留める</DialogTitle>
              <DialogDescription>
                現在のシーンに覚書を書き留めます。
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <input type="hidden" {...register('scene_id')} />

              <div>
                <Label htmlFor="body">覚書</Label>
                <textarea
                  id="body"
                  {...register('body')}
                  className="mt-1 w-full rounded border p-2 min-h-[120px] text-sm"
                  placeholder="気づいたことを書き留める..."
                  disabled={isPending}
                />
                {errors.body && (
                  <p className="mt-1 text-sm text-red-600">{errors.body.message}</p>
                )}
              </div>

              {formError && (
                <p className="text-sm text-red-600">{formError}</p>
              )}

              <DialogFooter>
                <Button type="submit" disabled={isPending}>
                  {isPending ? '保存中...' : '追加'}
                </Button>
              </DialogFooter>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}