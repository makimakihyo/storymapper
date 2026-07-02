import { redirect, notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { CharactersList } from '../../characters/characters-list';
import { CharactersModal } from './characters-modal';

type Props = {
  params: Promise<{ id: string }>;
};

export default async function CharactersModalPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();

  // 1. 認証ガード（モーダル経由でも独立して必須＝多重防御）
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims) {
    redirect(`/signin?next=/books/${id}/characters`);
  }

  // 2. 書籍の存在確認(RLS で自分の本のみ取れる前提)
  const { data: book, error: bookError } = await supabase
    .from('books')
    .select('id')
    .eq('id', id)
    .single();

  if (bookError || !book) {
    notFound();
  }

  return (
    <CharactersModal>
      <CharactersList bookId={id} />
    </CharactersModal>
  );
}