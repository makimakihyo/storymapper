import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { CharacterForm } from './character-form';

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

  // 3. キャラ一覧(α版: characters 直読み・全件。ネタバレフィルタ=Week 8)
  const { data: characters } = await supabase
    .from('characters')
    .select('id, name, aliases, notes')
    .eq('book_id', id)
    .order('created_at', { ascending: true });

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

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground">
          キャラを追加
        </h2>
        <CharacterForm bookId={id} />
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-muted-foreground">
          一覧（{characters?.length ?? 0}）
        </h2>
        {characters && characters.length > 0 ? (
          <ul className="space-y-2">
            {characters.map((c) => (
              <li key={c.id} className="rounded border p-3">
                <p className="font-medium">{c.name}</p>
                {c.aliases && c.aliases.length > 0 && (
                  <p className="text-sm text-muted-foreground">
                    別名: {c.aliases.join('、')}
                  </p>
                )}
                {c.notes && (
                  <p className="text-sm text-muted-foreground">{c.notes}</p>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            まだキャラが登録されていません。
          </p>
        )}
      </section>
    </main>
  );
}
