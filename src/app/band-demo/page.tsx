// =====================================================================
// 主要キャラ帯 DP-4 判定用【認証不要デモ・使い捨て】
// - メール/ログイン不要でタブレット実機からアクセスできる
// - ?bandPos=top|bottom で上部/下部sticky を切替（本文・スクロール量は読書ページ忠実）
// - 目的は「縦持ち片手で帯の親指到達性・読書位置の維持」を触ること(DP-4)
// - 本番採用しない。合格基準: docs/design/main-character-band-acceptance-criteria.md
// =====================================================================

import Link from 'next/link';
import { MainCharacterBand, type BandCharacter } from '../books/[id]/main-character-band';

type Props = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

// 実利用感を出すためのモック（実データ不要な物理テストなので固定値でよい）
const MOCK_CHARACTERS: BandCharacter[] = [
  {
    id: 'c1',
    name: '柊 アキラ',
    state: {
      current_location: '旧市街の下宿',
      goal: '失踪した姉の行方を追う',
      affiliation: '無所属（元・調査部）',
      raw_memo:
        '姉の手帳を見つけた。最後の記述は「灯台で待つ」。まだ誰にも話していない。ユキには近く打ち明けるつもり。',
    },
  },
  {
    id: 'c2',
    name: '南 ユキ',
    state: {
      current_location: '港の喫茶店',
      goal: 'アキラを助けつつ自分の過去を隠す',
      affiliation: '喫茶「灯」店員',
      raw_memo: 'アキラの姉とは面識があるらしい。だがそれを本人に言えずにいる。',
    },
  },
  {
    id: 'c3',
    name: '佐伯 先生',
    state: {
      current_location: '高校 資料室',
      goal: '生徒たちを事件から遠ざける',
      affiliation: '市立第一高校 教員',
      raw_memo: null,
    },
  },
  {
    id: 'c4',
    name: 'リョウ',
    state: {
      current_location: '不明（目撃情報のみ）',
      goal: '（まだ不明）',
      affiliation: '謎の組織？',
      raw_memo: '第3シーンで一瞬だけ登場。灯台の方角へ歩いていた。',
    },
  },
  {
    id: 'c5',
    name: '母',
    state: {
      current_location: '実家',
      goal: '子供たちを心配している',
      affiliation: '家族',
      raw_memo: null,
    },
  },
];

export default async function BandDemoPage({ searchParams }: Props) {
  const sp = await searchParams;
  const bandPos = sp.bandPos === 'bottom' ? 'bottom' : 'top'; // 既定は上部

  return (
    <main
      className={`container mx-auto max-w-2xl p-4${
        bandPos === 'bottom' ? ' pb-40' : ''
      }`}
    >
      {/* 主要キャラ帯【DP-4判定用】。上部sticky時はここ(フロー先頭)に貼り付く */}
      <MainCharacterBand characters={MOCK_CHARACTERS} bandPos={bandPos} />

      {/* 上部/下部の切替リンク（実機でその場で行き来できるように） */}
      <nav className="mb-4 flex gap-3 text-sm">
        <Link
          href="/band-demo?bandPos=top"
          className={
            bandPos === 'top'
              ? 'font-bold text-blue-600 underline'
              : 'text-blue-600 hover:underline'
          }
        >
          上部sticky
        </Link>
        <Link
          href="/band-demo?bandPos=bottom"
          className={
            bandPos === 'bottom'
              ? 'font-bold text-blue-600 underline'
              : 'text-blue-600 hover:underline'
          }
        >
          下部sticky
        </Link>
        <span className="text-gray-400">← タブレット縦持ち・片手で比較</span>
      </nav>

      {/* 書籍情報（読書ページ忠実のダミー） */}
      <header>
        <h1 className="text-2xl font-bold">灯台の待ち人</h1>
        <p className="mt-1 text-gray-600">架空 太郎</p>
        <div className="mt-2 flex items-center gap-3">
          <span className="inline-block rounded bg-blue-100 px-2 py-1 text-xs text-blue-800">
            読書中
          </span>
        </div>
      </header>

      {/* 現在シーン情報 */}
      <section className="mt-6 rounded border p-4">
        <div className="text-lg font-medium">第3シーン 港の別れ</div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-sm text-gray-500">シーン</span>
          <span className="text-2xl font-bold tabular-nums">3</span>
          <span className="text-sm text-gray-500">/ 全 12</span>
        </div>
        <div className="mt-3">
          <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
            <div
              className="h-full rounded-full bg-blue-600"
              style={{ width: '25%' }}
            />
          </div>
          <div className="mt-1 text-right text-xs text-gray-500">25%</div>
        </div>
      </section>

      {/* メモ・ブックマーク（ダミー） */}
      <section className="mt-6">
        <h2 className="mb-3 text-lg font-medium">メモ・ブックマーク</h2>
        <div className="space-y-2">
          <div className="rounded border p-3 text-sm">
            アキラが姉の手帳を見つける場面。「灯台で待つ」の一文が伏線か。
          </div>
          <div className="rounded border p-3 text-sm">
            ユキの態度が不自然。何か隠している。
          </div>
        </div>
      </section>

      {/* 登場人物への導線（ダミー） */}
      <section className="mt-4">
        <div className="flex items-center justify-between rounded border p-4">
          <span className="font-medium">登場人物</span>
          <span className="text-sm text-gray-500">一覧・状態を記録 →</span>
        </div>
      </section>

      {/* シーン移動（ダミー） */}
      <section className="mt-6">
        <div className="flex items-center gap-3">
          <span className="rounded border border-gray-300 px-4 py-2 text-gray-700">
            ← 戻る
          </span>
          <span className="rounded bg-blue-600 px-4 py-2 text-white">
            シーン進行 →
          </span>
        </div>
      </section>

      {/* スクロール確認用の余白（親指到達・sticky追従を実利用忠実に試す） */}
      <div
        aria-hidden
        className="flex items-start justify-center pt-8 text-xs text-gray-400"
        style={{ height: '140vh' }}
      >
        （デモ: スクロール確認用の余白）
      </div>
    </main>
  );
}
