import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { SubmitButton } from './[id]/submit-button';
import { toggleReadingMode } from './[id]/actions';
import { signOut } from '@/app/signout/actions';

export default async function BooksPage() {
  const supabase = await createClient();

  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims) {
    redirect('/signin?next=/books');
  }

  const { data: books } = await supabase
    .from('books')
    .select('id, title, author')
    .order('created_at', { ascending: false });

  const bookIds = books?.map((b) => b.id) ?? [];

  const { data: progressList } =
    bookIds.length > 0
      ? await supabase
          .from('reading_progress')
          .select('book_id, mode')
          .in('book_id', bookIds)
      : { data: [] };

  const progressMap = new Map(
    (progressList ?? []).map((p) => [p.book_id, p.mode]),
  );

  return (
    <main className="container mx-auto max-w-2xl p-4">
      <header className="mb-6 flex items-center justify-between">
      <h1 className="text-2xl font-bold">本棚</h1>
      <div className="flex items-center gap-2">
      <Link
        href="/books/new"
        className="rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
      >
       本を登録
    </Link>
  <form action={signOut}>
    <SubmitButton className="rounded border px-4 py-2 text-sm text-gray-600 hover:bg-gray-100">
       ログアウト
    </SubmitButton>
  </form>
  </div>
</header>


      {!books || books.length === 0 ? (
        <p className="text-gray-500">まだ本が登録されていません。</p>
      ) : (
        <ul className="space-y-3">
          {books.map((book) => {
            const mode = progressMap.get(book.id);
            const isFinished = mode === 'finished';

            return (
              <li
                key={book.id}
                className="flex items-center justify-between rounded border p-4"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    className={`shrink-0 inline-block rounded px-2 py-1 text-xs ${
                      isFinished
                        ? 'bg-green-100 text-green-800'
                        : 'bg-blue-100 text-blue-800'
                    }`}
                  >
                    {isFinished ? '読了' : '読書中'}
                  </span>
                  <div className="min-w-0">
                    <Link
                      href={`/books/${book.id}`}
                      className="block truncate font-medium hover:underline"
                    >
                      {book.title}
                    </Link>
                    {book.author && (
                      <p className="truncate text-sm text-gray-500">
                        {book.author}
                      </p>
                    )}
                  </div>
                </div>
                {isFinished && (
                  <form action={toggleReadingMode.bind(null, book.id)}>
                    <SubmitButton className="ml-3 shrink-0 rounded border px-3 py-1 text-xs text-gray-600 hover:bg-gray-100">
                      読書中に戻す
                    </SubmitButton>
                  </form>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}