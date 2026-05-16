import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { BookForm } from './book-form';

export default async function NewBookPage() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();

  if (!claimsData?.claims) {
    redirect('/signin?next=/books/new');
  }

  return (
    <main className="container mx-auto max-w-md py-8">
      <h1 className="mb-6 text-2xl font-bold">本を登録する</h1>
      <BookForm />
    </main>
  );
}