'use client';

// =====================================================================
// 主要キャラ帯 常時表示（Week10 / recall課題対策・本実装）
// 設計: docs/design/main-character-band-acceptance-criteria.md
// - 配置=下部sticky（DP-4確定）。詳細=タップでインライン展開（B・単一オープン）、
//   帯は隠さず同時表示。カードは帯の「上」にfixedオーバーレイでせり出し本文を
//   リフローさせない（§1: 読書位置を失わない）。閉じる=点灯中の同じチップを再タップ。
// - 読み取り専用（§6）。編集・状態記録・AI要約は載せない（/characters モーダルへ）。
// - as-of: 表示状態の由来シーンを絶対番号「シーンN時点」で明示（読む側の正確性）。
// - チップは横スクロール（案C）。名前は省略しない（認識用途を壊さない）。
// =====================================================================

import { useState } from 'react';

export type BandCharacter = {
  id: string;
  name: string;
  /** 表示状態の由来シーンの絶対位置（1始まり）。導出できなければ null */
  asOfSceneN: number | null;
  state: {
    current_location: string | null;
    goal: string | null;
    affiliation: string | null;
    raw_memo: string | null;
  } | null;
};

type Props = {
  characters: BandCharacter[];
};

// 横スクロールの端フェード（続きがあることを可視化。§3運用メモ）。
// チップ列の内側パディング px-5(20px) と合わせ、端20pxのみ淡くする。
// 左パディングを16→20pxに広げているのは、rank1チップを画面左端に密着させると
// iPad Safari の左端"戻る"スワイプ領域と競合してタップが取りこぼされるため、
// 先頭チップをOSエッジゾーンの外へ逃がす狙い（2026-07-11 実機で左端反応不良）。
const EDGE_FADE = {
  WebkitMaskImage:
    'linear-gradient(to right, transparent, #000 20px, #000 calc(100% - 20px), transparent)',
  maskImage:
    'linear-gradient(to right, transparent, #000 20px, #000 calc(100% - 20px), transparent)',
} as const;

export function MainCharacterBand({ characters }: Props) {
  // 単一オープン（同時に開くのは1件）
  const [openId, setOpenId] = useState<string | null>(null);
  const open = characters.find((c) => c.id === openId) ?? null;

  const hasAnyField =
    !!open?.state &&
    [
      open.state.current_location,
      open.state.goal,
      open.state.affiliation,
      open.state.raw_memo,
    ].some((v) => v && v.length > 0);

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-background shadow-[0_-2px_8px_rgba(0,0,0,0.08)]"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {/* 詳細カード: 帯の上にせり出す（本文リフローなし）。
          長文 raw_memo は max-height＋内部スクロールで有界化し、現在の読書行を隠さない（§1/§7）。 */}
      {open && (
        <div className="max-h-[40vh] overflow-y-auto border-b bg-muted/40 px-4 py-3 text-sm">
          <div className="mb-1 flex items-baseline gap-2">
            <span className="font-medium">{open.name}</span>
            {open.asOfSceneN !== null && (
              <span className="shrink-0 text-[10px] text-muted-foreground">
                シーン{open.asOfSceneN}時点
              </span>
            )}
          </div>

          {hasAnyField ? (
            <div className="space-y-0.5">
              {open.state!.current_location && (
                <p>
                  <span className="text-muted-foreground">居場所 </span>
                  {open.state!.current_location}
                </p>
              )}
              {open.state!.goal && (
                <p>
                  <span className="text-muted-foreground">目的 </span>
                  {open.state!.goal}
                </p>
              )}
              {open.state!.affiliation && (
                <p>
                  <span className="text-muted-foreground">所属 </span>
                  {open.state!.affiliation}
                </p>
              )}
              {open.state!.raw_memo && (
                <p className="mt-1 whitespace-pre-wrap text-muted-foreground">
                  {open.state!.raw_memo}
                </p>
              )}
            </div>
          ) : (
            // 薄い/全null状態（§7: 描画定義）
            <p className="text-muted-foreground">
              現在位置までの状態記録はありません。
            </p>
          )}
        </div>
      )}

      <div className="px-4 pt-1 text-[10px] text-muted-foreground">
        主要キャラ（登場頻度順）
      </div>

      {/* チップ: 横スクロール（案C）。初期位置=rank1先頭（先頭要素）。
          名前は truncation しない＝長名はチップが横に伸びる。 */}
      <div
        className="flex gap-2 overflow-x-auto overscroll-x-contain px-5 py-2"
        style={EDGE_FADE}
      >
        {characters.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setOpenId((v) => (v === c.id ? null : c.id))}
            aria-pressed={openId === c.id}
            className={`min-h-[44px] shrink-0 touch-manipulation whitespace-nowrap rounded-full border px-4 text-sm ${
              openId === c.id
                ? 'bg-primary text-primary-foreground'
                : 'bg-background'
            }`}
          >
            {c.name}
          </button>
        ))}
      </div>
    </div>
  );
}
