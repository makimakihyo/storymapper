import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { MemoForm } from './memo-form';      // ← 追加
import { MemoList } from './memo-list';      // ← 追加
import { progressScene, regressScene, toggleReadingMode } from './actions';
import { SubmitButton } from './submit-button';            // 新規
import { SceneNameEditor } from './scene-name-editor';
import { MainCharacterBand, type BandCharacter } from './main-character-band'; // 【試作】

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>; // 【試作】?bandPos
};

export default async function BookPage({ params, searchParams }: Props) {
  const { id } = await params;
  const sp = await searchParams;                              // 【試作】
  const bandPos = sp.bandPos === 'bottom' ? 'bottom' : 'top'; // 【試作】既定は上部
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

  // 4. シーン一覧取得(位置計算 + 総数 + summary)
  const { data: scenes } = await supabase
    .from('scenes')
    .select('id, order_key, summary')   // ← summary 追加
    .eq('book_id', id)
    .order('order_key', { ascending: true });

  const totalScenes = scenes?.length ?? 0;
  const currentSceneIndex = scenes?.findIndex(
    (s) => s.id === progress?.current_scene_id
  ) ?? -1;
  const currentScenePosition = currentSceneIndex >= 0 ? currentSceneIndex + 1 : 0;

   // 追加: 現在シーンの summary
  const currentSceneSummary =
    scenes?.find((s) => s.id === progress?.current_scene_id)?.summary ?? null;

  // 追加: 進捗率(%)
  const progressPct =
    totalScenes > 0
      ? Math.round((currentScenePosition / totalScenes) * 100)
      : 0;

// ===== 主要キャラ帯 プロトタイプ用データ【試作・DP-4判定用】 =====
  // 登場頻度順(記録シーン数降順・同数は直近更新でタイブレーク)の上位5名を、
  // 現在位置(order_key)以前の character_states から JS 集計で算出。
  // 各キャラの「最新の可視状態」(scene order_key 最大)を raw_memo 込みで拾う。
  // 注: 本実装(step3)は latest_visible_character_states ビューを使う予定だが、
  //     現状ビューは raw_memo 未収録(cs.* 凍結)のため、試作は基底テーブルを直接集計する。
  const currentOrderKey =
    currentSceneIndex >= 0 ? scenes![currentSceneIndex].order_key : null;
  let bandCharacters: BandCharacter[] = [];
  if (currentOrderKey !== null) {
    const { data: chars } = await supabase
      .from('characters')
      .select('id, name')
      .eq('book_id', id);
    if (chars && chars.length > 0) {
      const sceneOrderById = new Map(
        (scenes ?? []).map((s) => [s.id, s.order_key]),
      );
      const { data: states } = await supabase
        .from('character_states')
        .select(
          'character_id, scene_id, current_location, goal, affiliation, raw_memo, updated_at',
        )
        .in(
          'character_id',
          chars.map((c) => c.id),
        );
      type StateRow = NonNullable<typeof states>[number];
      type Agg = {
        count: number;
        maxUpdatedAt: string;
        latestOrder: string;
        latestState: StateRow;
      };
      const agg = new Map<string, Agg>();
      for (const s of states ?? []) {
        const ok = sceneOrderById.get(s.scene_id);
        if (ok === undefined || ok > currentOrderKey) continue; // ネタバレフィルタ
        const prev = agg.get(s.character_id);
        if (!prev) {
          agg.set(s.character_id, {
            count: 1,
            maxUpdatedAt: s.updated_at,
            latestOrder: ok,
            latestState: s,
          });
        } else {
          prev.count += 1;
          if (s.updated_at > prev.maxUpdatedAt) prev.maxUpdatedAt = s.updated_at;
          if (ok > prev.latestOrder) {
            prev.latestOrder = ok;
            prev.latestState = s;
          }
        }
      }
      const nameById = new Map(chars.map((c) => [c.id, c.name]));
      bandCharacters = [...agg.entries()]
        .sort(
          (a, b) =>
            b[1].count - a[1].count ||
            (b[1].maxUpdatedAt > a[1].maxUpdatedAt ? 1 : -1),
        )
        .slice(0, 5)
        .map(([cid, a]) => ({
          id: cid,
          name: nameById.get(cid) ?? '(名称不明)',
          state: {
            current_location: a.latestState.current_location,
            goal: a.latestState.goal,
            affiliation: a.latestState.affiliation,
            raw_memo: a.latestState.raw_memo,
          },
        }));
    }
  }

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
    <main
      className={`container mx-auto max-w-2xl p-4${
        bandPos === 'bottom' ? ' pb-40' : ''
      }`}
    >
      {/* 主要キャラ帯【試作・DP-4判定用】。上部sticky時はここ(フロー先頭)に貼り付く */}
      {bandCharacters.length > 0 && (
        <MainCharacterBand characters={bandCharacters} bandPos={bandPos} />
      )}

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

        {/* 状態バッジ + 読了切替 */}
        <div className="mt-2 flex items-center gap-3">
          <span
            className={`inline-block rounded px-2 py-1 text-xs ${
              isFinished
                ? 'bg-green-100 text-green-800'
                : 'bg-blue-100 text-blue-800'
            }`}
          >
            {isFinished ? '読了' : '読書中'}
          </span>
          {progress && (
            <form action={toggleReadingMode.bind(null, book.id)}>
              <SubmitButton className="rounded border px-3 py-1 text-xs text-gray-600 hover:bg-gray-100">
                {isFinished ? '読書中に戻す' : '読了にする'}
              </SubmitButton>
            </form>
          )}
        </div>
      </header>

      {/* 現在シーン情報: シーン名編集 + 位置 + 進捗 */}
      <section className="mt-6 rounded border p-4">
        {/* シーン名(クリックでインライン編集)。優先度: summary → 章ラベル → なし */}
        <SceneNameEditor
          bookId={book.id}
          sceneId={progress?.current_scene_id ?? null}
          summary={currentSceneSummary}
          chapterLabel={chapterLabelName}
        />

        {/* 位置(強調) */}
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-sm text-gray-500">シーン</span>
          <span className="text-2xl font-bold tabular-nums">
            {currentScenePosition > 0 ? currentScenePosition : '—'}
          </span>
          <span className="text-sm text-gray-500">/ 全 {totalScenes}</span>
        </div>

        {/* 進捗バー */}
        <div className="mt-3">
          <div
            className="h-2 w-full overflow-hidden rounded-full bg-gray-200"
            role="progressbar"
            aria-valuenow={progressPct}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className="h-full rounded-full bg-blue-600 transition-all"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <div className="mt-1 text-right text-xs text-gray-500">
            {progressPct}%
          </div>
        </div>
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

      {/* 登場人物への導線(旧 POVキャラ枠を置換) */}
      <section className="mt-4">
        <Link
          href={`/books/${book.id}/characters`}
          className="flex items-center justify-between rounded border p-4 hover:bg-gray-50"
        >
          <span className="font-medium">登場人物</span>
          <span className="text-sm text-gray-500">一覧・状態を記録 →</span>
        </Link>
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

      {/* 【試作】スクロール確認用の余白。sticky/親指到達を実利用忠実に試すため、
          本文が短くても必ずスクロールが発生するようにする(合格基準§3運用メモ)。 */}
      <div
        aria-hidden
        className="flex items-start justify-center pt-8 text-xs text-muted-foreground/50"
        style={{ height: '140vh' }}
      >
        （試作: スクロール確認用の余白）
      </div>
    </main>
  );
}