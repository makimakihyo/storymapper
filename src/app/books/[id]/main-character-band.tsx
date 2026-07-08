'use client';

// =====================================================================
// 主要キャラ帯 常時表示【DP-4 判定用プロトタイプ・使い捨て】
// - 上部sticky / 下部sticky を ?bandPos=top|bottom で切替（本番採用しない）
// - 上部=展開が本文を下に押す / 下部=カードが上にせり出す（本番忠実に別実装）
// - AI要約は載せない（読み取り専用）。合格基準: docs/design/main-character-band-acceptance-criteria.md
// =====================================================================

import { useState } from 'react';

export type BandCharacter = {
  id: string;
  name: string;
  state: {
    current_location: string | null;
    goal: string | null;
    affiliation: string | null;
    raw_memo: string | null;
  } | null;
};

type Props = {
  characters: BandCharacter[];
  bandPos: 'top' | 'bottom';
};

export function MainCharacterBand({ characters, bandPos }: Props) {
  // 単一オープン（同時に開くのは1件）
  const [openId, setOpenId] = useState<string | null>(null);
  const open = characters.find((c) => c.id === openId) ?? null;

  const chips = (
    <div className="flex gap-2 overflow-x-auto px-3 py-2">
      {characters.map((c) => (
        <button
          key={c.id}
          type="button"
          onClick={() => setOpenId((v) => (v === c.id ? null : c.id))}
          className={`min-h-[44px] shrink-0 rounded-full border px-4 text-sm ${
            openId === c.id
              ? 'bg-primary text-primary-foreground'
              : 'bg-background'
          }`}
        >
          {c.name}
        </button>
      ))}
    </div>
  );

  const card = open && (
    <div className="border-t bg-muted/40 px-4 py-3 text-sm">
      <div className="mb-1 font-medium">{open.name}</div>
      {open.state ? (
        <div className="space-y-0.5">
          {open.state.current_location && (
            <p>
              <span className="text-muted-foreground">居場所 </span>
              {open.state.current_location}
            </p>
          )}
          {open.state.goal && (
            <p>
              <span className="text-muted-foreground">目的 </span>
              {open.state.goal}
            </p>
          )}
          {open.state.affiliation && (
            <p>
              <span className="text-muted-foreground">所属 </span>
              {open.state.affiliation}
            </p>
          )}
          {open.state.raw_memo && (
            <p className="mt-1 whitespace-pre-wrap text-muted-foreground">
              {open.state.raw_memo}
            </p>
          )}
        </div>
      ) : (
        <p className="text-muted-foreground">
          現在位置までの状態記録はありません。
        </p>
      )}
    </div>
  );

  const label = (pos: string) => (
    <div className="px-3 pt-1 text-[10px] text-muted-foreground">
      主要キャラ（登場頻度順・{pos}試作）
    </div>
  );

  if (bandPos === 'bottom') {
    // 下部固定: カードは帯の「上」にせり出す（本文を上方向に覆う）
    return (
      <div
        className="fixed inset-x-0 bottom-0 z-40 border-t bg-background shadow-[0_-2px_8px_rgba(0,0,0,0.08)]"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {card}
        {label('下部sticky')}
        {chips}
      </div>
    );
  }

  // 上部sticky: 通常フローに置き、カードは「下」に展開して本文を押し下げる
  return (
    <div className="sticky top-0 z-40 border-b bg-background shadow-sm">
      {label('上部sticky')}
      {chips}
      {card}
    </div>
  );
}
