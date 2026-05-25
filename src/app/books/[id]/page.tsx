import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { MemoForm } from './memo-form';      // ← 追加
import { MemoList } from './memo-list';      // ← 追加
import { progressScene, regressScene } from './actions';   // regressScene を追加
import { SubmitButton } from './submit-button';            // 新規


type Props = {
  params: Promise<{ id: string }>;
};

export default async function BookPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();

  // 1. 認証ガード
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims) {
    redirect(`/signin?next=/books/${id}`);
  }

  // 2. 書籍取得(RLS で自分の本のみ取れる前提)
  const { data: book, error: bookError } = await supabase
    .from('books')
    .select('id, title, author')
    .eq('id', id)
    .single();

  if (bookError || !book) {
    notFound();
  }

  // 3. 読書進捗取得
  const { data: progress } = await supabase
    .from('reading_progress')
    .select('mode, current_scene_id')
    .eq('book_id', id)
    .single();

  // 4. シーン一覧取得(位置計算 + 総数)
  const { data: scenes } = await supabase
    .from('scenes')
    .select('id, order_key')
    .eq('book_id', id)
    .order('order_key', { ascending: true });

  const totalScenes = scenes?.length ?? 0;
  const currentSceneIndex = scenes?.findIndex(
    (s) => s.id === progress?.current_scene_id
  ) ?? -1;
  const currentScenePosition = currentSceneIndex >= 0 ? currentSceneIndex + 1 : 0;

// 現在シーンのメモ有無(案1: 空シーンからの新規作成を弾く)
  let currentSceneHasMemo = false;
  if (progress?.current_scene_id) {
    const { count } = await supabase
      .from('memos')
      .select('id', { count: 'exact', head: true })
      .eq('scene_id', progress.current_scene_id);
    currentSceneHasMemo = (count ?? 0) > 0;
  }

  // 進行/後退の可否
  const hasExistingNextScene =
    currentSceneIndex >= 0 && currentSceneIndex < totalScenes - 1;
  const canRegress = currentSceneIndex > 0;
  const canProgress = currentSceneHasMemo || hasExistingNextScene;

  // 5. 現在シーンの chapter ラベル取得
  let chapterLabelName: string | null = null;
  if (progress?.current_scene_id) {
    const { data: labelData } = await supabase
      .from('scene_labels')
      .select('labels!inner(name, type)')
      .eq('scene_id', progress.current_scene_id);

    // labels.type === 'chapter' のものを抽出
    const chapterEntry = labelData?.find(
      (entry) =>
        // Supabase の関係型は配列 or 単一オブジェクト(FKの設定次第)。両対応で安全に
        Array.isArray(entry.labels)
          ? entry.labels.some((l) => l.type === 'chapter')
          : entry.labels?.type === 'chapter'
    );
    if (chapterEntry) {
      chapterLabelName = Array.isArray(chapterEntry.labels)
        ? chapterEntry.labels.find((l) => l.type === 'chapter')?.name ?? null
        : chapterEntry.labels?.name ?? null;
    }
  }

  const isFinished = progress?.mode === 'finished';

  return (
    <main className="container mx-auto max-w-2xl p-4">
      {/* パンくず・戻る */}
      <nav className="mb-4">
        <Link href="/" className="text-sm text-blue-600 hover:underline">
          ← ホームへ戻る
        </Link>
      </nav>

      {/* 書籍情報 */}
      <header>
        <h1 className="text-2xl font-bold">{book.title}</h1>
        <p className="mt-1 text-gray-600">{book.author}</p>

        {/* 状態バッジ */}
        <div className="mt-2">
          <span
            className={`inline-block rounded px-2 py-1 text-xs ${
              isFinished
                ? 'bg-green-100 text-green-800'
                : 'bg-blue-100 text-blue-800'
            }`}
          >
            {isFinished ? '読了' : '読書中'}
          </span>
        </div>
      </header>

      {/* 現在シーン情報 */}
      <section className="mt-6 rounded border p-4">
        <div className="text-sm text-gray-500">
          シーン {currentScenePosition} / 全 {totalScenes} シーン
        </div>
        {chapterLabelName && (
          <div className="mt-1 text-lg font-medium">{chapterLabelName}</div>
        )}
        {!chapterLabelName && currentScenePosition > 0 && (
          <div className="mt-1 text-lg font-medium text-gray-400">
            (シーン名なし)
          </div>
        )}
      </section>

      {/* メモ・ブックマーク */}
      {progress?.current_scene_id && (
        <section className="mt-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-medium">メモ・ブックマーク</h2>
            <MemoForm
              key={progress.current_scene_id}
              bookId={book.id}
              currentSceneId={progress.current_scene_id}
            />
          </div>
          <MemoList
            bookId={book.id}
            currentSceneId={progress.current_scene_id}
          />
        </section>
      )}

      {/* POVキャラ・場所 (α版は枠だけ、空表示OK) */}
      <section className="mt-4 rounded border p-4 text-sm text-gray-500">
        <div>
          POVキャラ: <span className="italic">(α版未対応)</span>
        </div>
        <div className="mt-1">
          場所: <span className="italic">-</span>
        </div>
      </section>

      {/* シーン移動(後退 / 進行) */}
      <section className="mt-6">
        <div className="flex items-center gap-3">
          <form action={regressScene.bind(null, book.id)}>
            <SubmitButton
              disabled={!canRegress}
              className="rounded border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50 active:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
            >
              ← 戻る
            </SubmitButton>
          </form>

          <form action={progressScene.bind(null, book.id)}>
            <SubmitButton
              disabled={!canProgress}
              className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 active:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
              シーン進行 →
            </SubmitButton>
          </form>
        </div>

        <p className="mt-2 text-xs text-gray-500">
          {canProgress
            ? '次の既存シーンがあれば移動、無ければ新規シーンを作成します'
            : 'このシーンにメモを1件追加すると次へ進めます'}
        </p>
      </section>
    </main>
  );
}