import type { Metadata } from 'next';

import { SigninForm } from './signin-form';
import { sanitizeNext } from '@/lib/auth/safe-next';

export const metadata: Metadata = {
  title: 'サインイン | StoryMapper',
  description: 'StoryMapper にサインインします。',
};

type SearchParams = Promise<{ next?: string | string[] }>;

export default async function SigninPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const next = sanitizeNext(params.next);

  return (
    <main className="flex flex-1 items-center justify-center bg-zinc-50 px-4 py-16 dark:bg-black">
      <div className="w-full max-w-sm space-y-6 rounded-lg border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
            サインイン
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            メールアドレスを入力すると、サインイン用のリンクを送信します。
          </p>
        </header>
        <SigninForm next={next} />
      </div>
    </main>
  );
}