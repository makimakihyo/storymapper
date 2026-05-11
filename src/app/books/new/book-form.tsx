'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { bookFormSchema, type BookFormInput } from '@/lib/schemas/book';

export function BookForm() {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<BookFormInput>({
    resolver: zodResolver(bookFormSchema),
    defaultValues: {
      title: '',
      author: '',
      first_scene_name: '',
    },
  });

  // Server Action は明日(5/12)に実装。今日はバリデーション動作確認まで
  const onSubmit = async (data: BookFormInput) => {
    console.log('submit', data);
    // TODO: Day 4 で createBook Server Action を呼ぶ
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
        <Label htmlFor="first_scene_name">最初のシーン名（任意）</Label>
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

      <Button type="submit" disabled={isSubmitting}>
        登録する
      </Button>
    </form>
  );
}