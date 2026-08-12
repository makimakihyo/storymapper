import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { MemoForm } from './memo-form';      // ← 追加
import { MemoList } from './memo-list';      // ← 追加
import { progressScene, regressScene, toggleReadingMode } from './actions';
import { SubmitButton } from './submit-button';            // 新規
import { SceneNameEditor } from './scene-name-editor';
import { MainCharacterBand, type BandCharacter } from './main-character-band';

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

// ===== 主要キャラ帯 常時表示（step3 本実装） =====
  // 表示状態は latest_visible_character_states ビューから取得（ネタバレ＋RLSを
  //   DB側で担保。DP-7。ビューは raw_memo込み・scene_id付きで再作成済み）。
  // 順位は「登場頻度順＝可視範囲の記録シーン数」を character_states 集計で算出
  //   （DP-1/2。同数は直近更新でタイブレーク）。上位5名。
  // as-of は各表示状態の由来 scene_id → シーン絶対位置N を導出し「シーンN時点」で出す。
  const currentOrderKey =
    currentSceneIndex >= 0 ? scenes![currentSceneIndex].order_key : null;
  let bandCharacters: BandCharacter[] = [];
  {
    const { data: chars } = await supabase
      .from('characters')
      .select('id, name')
      .eq('book_id', id);

    if (chars && chars.length > 0) {
      const charIds = chars.map((c) => c.id);
      const nameById = new Map(chars.map((c) => [c.id, c.name]));

      // scene_id -> order_key（順位カウントのネタバレフィルタ用）/ 位置N（as-of用）
      const sceneOrderById = new Map(
        (scenes ?? []).map((s) => [s.id, s.order_key]),
      );
      const scenePositionById = new Map(
        (scenes ?? []).map((s, i) => [s.id, i + 1]),
      );

      // (1) 表示状態: ビューからキャラごと最新1件（raw_memo込み・由来scene_id付き）
      const { data: latestStates } = await supabase
        .from('latest_visible_character_states')
        .select(
          'character_id, scene_id, current_location, goal, affiliation, raw_memo',
        )
        .in('character_id', charIds);

      // (2) 順位カウント: 可視範囲の記録シーン数（同数は直近更新でタイブレーク）
      const rankByChar = new Map<
        string,
        { count: number; maxUpdatedAt: string }
      >();
      if (currentOrderKey !== null) {
        const { data: countRows } = await supabase
          .from('character_states')
          .select('character_id, scene_id, updated_at')
          .in('character_id', charIds);
        for (const r of countRows ?? []) {
          const ok = sceneOrderById.get(r.scene_id);
          if (ok === undefined || ok > currentOrderKey) continue; // ネタバレフィルタ
          const prev = rankByChar.get(r.character_id);
          if (!prev) {
            rankByChar.set(r.character_id, {
              count: 1,
              maxUpdatedAt: r.updated_at,
            });
          } else {
            prev.count += 1;
            if (r.updated_at > prev.maxUpdatedAt) prev.maxUpdatedAt = r.updated_at;
          }
        }
      }

      bandCharacters = (latestStates ?? [])
        // ビュー列は生成型では nullable。character_id が無い行は集計不能なので除外。
        .filter(
          (st): st is typeof st & { character_id: string } =>
            st.character_id !== null,
        )
        .map((st) => ({
          characterId: st.character_id,
          count: rankByChar.get(st.character_id)?.count ?? 0,
          maxUpdatedAt: rankByChar.get(st.character_id)?.maxUpdatedAt ?? '',
          asOfSceneN: st.scene_id
            ? scenePositionById.get(st.scene_id) ?? null
            : null,
          state: {
            current_location: st.current_location,
            goal: st.goal,
            affiliation: st.affiliation,
            raw_memo: st.raw_memo,
          },
        }))
        .sort(
          (a, b) =>
            b.count - a.count || (b.maxUpdatedAt > a.maxUpdatedAt ? 1 : -1),
        )
        .slice(0, 5)
        .map((e) => ({
          id: e.characterId,
          name: nameById.get(e.characterId) ?? '(名称不明)',
          asOfSceneN: e.asOfSceneN,
          state: e.state,
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
    // pb-28: 下部固定の主要キャラ帯（閉時=ラベル+チップ）に本文末尾が隠れないよう余白を確保
    <main className="container mx-auto max-w-2xl p-4 pb-28">
      {/* 主要キャラ帯 常時表示（下部固定）。fixed配置なのでDOM上の位置は不問 */}
      {bandCharacters.length > 0 && (
        <MainCharacterBand characters={bandCharacters} />
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
            currentSceneN={currentScenePosition}
          />
        </section>
      )}

      {/* 登場人物への参照(read)導線。
          N1: 書く導線は「書き留める」1入口に集約し、能動的な"書く"は後段 N3「送る」へ寄せる。
          ここはラベルを参照専用に後退させる（リンク先・機能は不変、表示のみ後退）。 */}
      <section className="mt-4">
        <Link
          href={`/books/${book.id}/characters`}
          className="flex items-center justify-between rounded border p-4 hover:bg-gray-50"
        >
          <span className="font-medium">登場人物</span>
          <span className="text-sm text-gray-500">一覧・状態を確認 →</span>
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
    </main>
  );
}