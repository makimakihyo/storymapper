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
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
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
      if (data.is_bookmark) {
        formData.set('is_bookmark', 'on');
      }

      const result = await createMemo(bookId, formData);
      if (result?.error) {
        setFormError(result.error);
        return;
      }

      // 成功時: フォームクリア + Dialog 閉じる
      reset();
      setOpen(false);
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>メモを追加</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>メモを追加</DialogTitle>
          <DialogDescription>
            現在のシーンにメモまたはブックマークを追加します。
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <input type="hidden" {...register('scene_id')} />

          <div>
            <Label htmlFor="body">本文</Label>
            <textarea
              id="body"
              {...register('body')}
              className="mt-1 w-full rounded border p-2 min-h-[120px] text-sm"
              placeholder="メモを書く..."
              disabled={isPending}
            />
            {errors.body && (
              <p className="mt-1 text-sm text-red-600">{errors.body.message}</p>
            )}
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is_bookmark"
              {...register('is_bookmark')}
              disabled={isPending}
              className="h-4 w-4"
            />
            <Label htmlFor="is_bookmark" className="cursor-pointer">
              これをブックマークにする
            </Label>
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
      </DialogContent>
    </Dialog>
  );
}