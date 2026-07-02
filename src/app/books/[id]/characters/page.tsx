import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { CharactersList } from './characters-list';

type Props = {
  params: Promise<{ id: string }>;
};

export default async function CharactersPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();

  // 1. 認証ガード
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims) {
    redirect(`/signin?next=/books/${id}/characters`);
  }

  // 2. 書籍取得(RLS で自分の本のみ取れる前提)
  const { data: book, error: bookError } = await supabase
    .from('books')
    .select('id, title')
    .eq('id', id)
    .single();

  if (bookError || !book) {
    notFound();
  }

  return (
    <main className="mx-auto max-w-2xl space-y-6 p-4">
      <div className="space-y-1">
        <Link
          href={`/books/${id}`}
          className="text-sm text-muted-foreground underline"
        >
          ← {book.title}
        </Link>
        <h1 className="text-xl font-bold">登場人物</h1>
      </div>

      <CharactersList bookId={id} />
    </main>
  );
}