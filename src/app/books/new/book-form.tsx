'use client';

import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { bookFormSchema, type BookFormInput } from '@/lib/schemas/book';
import { createBookAction } from './actions';

export function BookForm() {
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<BookFormInput>({
    resolver: zodResolver(bookFormSchema),
    defaultValues: {
      title: '',
      author: '',
      first_scene_name: '',
    },
  });

  const onSubmit = (data: BookFormInput) => {
    setServerError(null);
    startTransition(async () => {
      const result = await createBookAction(data);
      // 成功時は Server Action 側で redirect されるのでここに戻ってこない
      if (!result) return;

      if (result.kind === 'fieldErrors') {
        for (const [field, message] of Object.entries(result.fieldErrors)) {
          if (message) {
            setError(field as keyof BookFormInput, {
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
        <Label htmlFor="title">タイトル</Label>
        <Input
          id="title"
          placeholder="例: 三体"
          aria-invalid={!!errors.title}
          {...register('title')}
        />
        {errors.title && (
          <p className="text-sm text-destructive">{errors.title.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="author">著者</Label>
        <Input
          id="author"
          placeholder="例: 劉慈欣"
          aria-invalid={!!errors.author}
          {...register('author')}
        />
        {errors.author && (
          <p className="text-sm text-destructive">{errors.author.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="first_scene_name">最初のシーン名(任意)</Label>
        <Input
          id="first_scene_name"
          placeholder="例: プロローグ"
          aria-invalid={!!errors.first_scene_name}
          {...register('first_scene_name')}
        />
        <p className="text-sm text-muted-foreground">
          空欄の場合は「シーン1」が自動で作成されます。
        </p>
        {errors.first_scene_name && (
          <p className="text-sm text-destructive">
            {errors.first_scene_name.message}
          </p>
        )}
      </div>

      {serverError && (
        <p role="alert" className="text-sm text-destructive">
          {serverError}
        </p>
      )}

      <Button type="submit" disabled={isPending}>
        {isPending ? '登録中…' : '登録する'}
      </Button>
    </form>
  );
}