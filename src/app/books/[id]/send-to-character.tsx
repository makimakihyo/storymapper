'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  CharacterStateForm,
  type CharacterStatePrefill,
} from './characters/character-state-form';

// キャラ選択チップ1件分。initial＝(このキャラ × 送信先scene)の既存 state（prefill 元）。
export type SendCharacterChoice = {
  id: string;
  name: string;
  initial: CharacterStatePrefill | null;
};

type Props = {
  bookId: string;
  // 送信先 scene＝覚書の scene_id スナップショット（reading_progress.current を使わない）。
  sceneId: string;
  // 送信先 scene の絶対位置N（§9 上書き文言用）。
  sceneN: number;
  characters: SendCharacterChoice[];
};

/**
 * N3: 覚書カードから「この人物の状態へ送る」。
 * チップでキャラを選ぶ → 軽量モーダルに既存 character-state-form を再利用して開く。
 * 「送る」はテキストのコピーでなくルーティング＝raw_memo は memo.body でなく
 * 送信先(character × scene)の既存 state から prefill（無ければ空）。
 */
export function SendToCharacter({ bookId, sceneId, sceneN, characters }: Props) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = characters.find((c) => c.id === selectedId) ?? null;

  const closeModal = () => setSelectedId(null);

  return (
    <>
      <div className="mt-2">
        {!pickerOpen ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-auto px-2 py-1 text-xs text-muted-foreground"
            onClick={() => setPickerOpen(true)}
          >
            この人物の状態へ送る
          </Button>
        ) : characters.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            登場人物がまだ登録されていません。
          </p>
        ) : (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-muted-foreground">送り先:</span>
            {characters.map((c) => (
              <Button
                key={c.id}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setSelectedId(c.id)}
              >
                {c.name}
              </Button>
            ))}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-xs text-muted-foreground"
              onClick={() => setPickerOpen(false)}
            >
              やめる
            </Button>
          </div>
        )}
      </div>

      {/* 軽量モーダルの器＝新設。中身は既存 character-state-form を再利用（scene 非ロック）。 */}
      <Dialog
        open={selected != null}
        onOpenChange={(next) => {
          if (!next) closeModal();
        }}
      >
        <DialogContent>
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle>{selected.name}の状態</DialogTitle>
                <DialogDescription>
                  シーン{sceneN}時点の記録として保存します
                </DialogDescription>
              </DialogHeader>
              <CharacterStateForm
                bookId={bookId}
                characterId={selected.id}
                currentSceneId={sceneId}
                initial={selected.initial}
                sceneN={sceneN}
                onSaved={() => {
                  closeModal();
                  setPickerOpen(false);
                }}
                onCancel={closeModal}
              />
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
