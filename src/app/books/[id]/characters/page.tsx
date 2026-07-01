import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { CharacterForm } from './character-form';
import { CharacterItem } from './character-item';
import type { CharacterStatePrefill } from './character-state-form';

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

  // 4. 現在シーン(状態記録の UPSERT キー / プリフィルのスコープ)
  const { data: progress } = await supabase
    .from('reading_progress')
    .select('current_scene_id')
    .eq('book_id', id)
    .single();
  const currentSceneId = progress?.current_scene_id ?? null;

  // 4.5 シーン一覧から現在シーンの位置・名前(summary)を導出
  const { data: scenes } = await supabase
    .from('scenes')
    .select('id, order_key, summary')
    .eq('book_id', id)
    .order('order_key', { ascending: true });
  const currentSceneIndex =
    scenes?.findIndex((s) => s.id === currentSceneId) ?? -1;
  const currentScenePosition =
    currentSceneIndex >= 0 ? currentSceneIndex + 1 : 0;
  const currentSceneName =
    currentSceneIndex >= 0 ? (scenes![currentSceneIndex].summary ?? null) : null;

  // 5. 現在シーンの既存 state を一括取得 → characterId -> state の Map(プリフィル元)
  const stateByCharacter = new Map<string, CharacterStatePrefill>();
  if (currentSceneId && characters && characters.length > 0) {
    const { data: states } = await supabase
      .from('character_states')
      .select('character_id, raw_memo, current_location, goal, affiliation')
      .eq('scene_id', currentSceneId)
      .in(
        'character_id',
        characters.map((c) => c.id),
      );
    for (const s of states ?? []) {
      stateByCharacter.set(s.character_id, {
        raw_memo: s.raw_memo,
        current_location: s.current_location,
        goal: s.goal,
        affiliation: s.affiliation,
      });
    }
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
              <CharacterItem
                key={c.id}
                bookId={id}
                character={c}
                currentSceneId={currentSceneId}
                currentScenePosition={currentScenePosition}
                currentSceneName={currentSceneName}
                currentState={stateByCharacter.get(c.id) ?? null}
              />
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
