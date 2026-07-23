# 入力IA 1入口化（B・案3先行）実装ハンドオフ — Claude Code 向け

> 作成: 2026-07-15(水) by Kai / 合格基準: `storymapper_input_ia_B_1entry_acceptance_draft.md`
> 実装は Claude Code 側（Kai は claudework を Edit しない）。本書は着手手順・触るファイル・再利用機構・落とし穴。
> Cowork が claudework を read マウントして実コード確認済み。行番号は 2026-07-15 時点。

## 0. 着手前に必ず片付ける（PowerShell 側）
- **ブランチ確認**（`feature/...` を切る。main 直コミット防止）。
- **未コミット WIP の退避**: stale-badge WIP（`characters/character-item.tsx`・`characters/characters-list.tsx`）が未コミット残置。N3 が `memo-list` 経由で状態フォームに触れ、隣接で紛れる。**commit / stash / 別ブランチのいずれかで先に切り離す**。
- サンドボックスの `git status` は CRLF 誤検知で当てにならない。実チェックアウトで確認。
- typecheck / lint はホスト（`npm run typecheck` / `npm run lint`）。マウント越し tsc は truncate 偽エラー。

## 1. 実装順序（推奨）
**N1（1入口・核）→ N4（その中断復帰ガード）→ N3（覚書→人物へ送る）**。N2（しおり独立ボタン）は他と直交＝独立に着手可（先頭ウォームアップ or 最後、どちらでも）。

死守: **帯（read側）と `latest_visible_character_states` ビューに触らない**。**migration は N2 のしおり以外で増やさない**（初期スキーマは `body=''` 想定済みでしおりにも migration 不要）。

---

## 2. 現状の把握（実コード）
- 読書ページ `books/[id]/page.tsx`:
  - **書く入口が2つに割れている**。①「メモ・ブックマーク」節（283–299行）に `MemoForm`（Dialog・本文＋「これをブックマークにする」チェック）②「登場人物」節（301–310行）＝`/books/[id]/characters` への `Link`（→ `@modal` インターセプトモーダル → 一覧 → 各カードの `#2` インライン状態フォーム）。
- `memo-form.tsx`: `createMemoSchema`（`body` 必須＋`is_bookmark`）で `createMemo` を叩く Dialog。成功で `reset()`＋close。
- `actions.ts`（books/[id]）: `createMemo(bookId, formData)` が `memos` に INSERT（body・is_bookmark）。`deleteMemo` あり。
- `memo-list.tsx`: **server component**。現在シーンの memos を `.eq('scene_id', currentSceneId)` で取得し map 表示（`is_bookmark` でアイコン分岐）。**scene_id は select していない**が、クエリ条件上ここに出る memo はすべて現在シーン＝送信先 scene は自明。
- `characters/actions.ts`:
  - `saveCharacterStateAction(bookId, characterId, sceneId, input)` ＝**scene_id を引数で受けて upsert（`onConflict: 'character_id,scene_id'`）**。→ **N3 のスナップショットはこのアクションに memo の scene_id を渡すだけで実現。アクション改修不要**。
  - `extractCharacterStateAction(...)` ＝自由文→3欄抽出（prefill 用に既存）。
- `characters/character-state-form.tsx`: `initial`（現在シーンの既存state）で prefill、`currentSceneId` を受けて「メモから抽出」→3欄→「現在シーンで記録」。

---

## 3. N1: 1入口「書き留める」
**目的**: 読書ページの自由文の書き口を1つに。書く瞬間に分岐を出さない。

**やること（骨子）**
- `MemoForm` を「書き留める」単一入口へ。**本文（覚書）専用**にし、**`is_bookmark` チェックを撤去**（役割は N2 の独立ボタンへ移す。同居を残すと書き分けの再発）。保存は従来どおり `createMemo`＝`memos.body` へ append。
- 「登場人物」節（301–310行）は**参照（読む）導線として残す**（帯・一覧を見る口）。`#2` を書く導線は N3 の「送る」に寄せ、読書ページ上の**同格の書く入口としては前に出さない**（＝1入口の趣旨）。
- ラベルは仮（「書き留める」等）。実機で調整。

**受け入れ**: 合格基準 N1-1〜N1-5。特に N1-5（ソフトキーボード展開時に保存が隠れない）。

**落とし穴**
- `createMemoSchema` は `is_bookmark: boolean` を持つ。チェック撤去後、`MemoForm` は常に `is_bookmark=false` を送る形でよい（スキーマ改変は必須でない）。スキーマから外すなら `createMemo` の parse/insert も合わせる＝**任意**、最小改修なら据え置き。

## 4. N4: 中断復帰の安全（N1 の入口に対して）
**目的**: 読書中断で書きかけが無警告で消えない。

**やること（骨子）**
- `MemoForm` の Dialog を dirty 時にガード。**`onInteractOutside`＋`onEscapeKeyDown` で `e.preventDefault()`**→確認（「破棄する／編集に戻る」）。`onOpenChange` の bool だけでは閉じを止められない。
- dirty 判定は RHF `formState.isDirty`。`defaultValues` は既に `{scene_id, body:'', is_bookmark:false}` で入っており誤検知の下地なし。
- **保存成功時は確認を出さない**: `createMemo` 成功後に `reset()` してから close（`isDirty` を false へ戻す）。
- 旧 M2 ハンドオフ（`storymapper_week11_m2_handoff_draft.md`）の dirty/Radix 論点を**ここで必要分だけ再利用**（対象が単一 Dialog なので #2 の2階層問題より軽い）。

**受け入れ**: N4-1・N4-2。**スワイプバック/ブラウザ戻る（popstate）は捕捉しきれない**＝主経路（背景タップ・Escape）を塞げば dogfood 実害は防げる、を許容線に。

**落とし穴**: 一時保持（下書き永続化）は**作らない**（本人既決 2026-07-13）。確認ダイアログで表層完結。

## 5. N3: 覚書 →「人物の状態へ送る」（案3の核）
> **【改訂 2026-07-20】Miru査読Q1サブ確定を反映**：「送る」は**テキストのコピーでなくルーティング**。`raw_memo` は memo.body でなく **initial（送信先の既存 state のメモ）から prefill**。旧記述（`raw_memo=memo.body`）は破棄。

**目的**: 書いた覚書を起点に、特定人物の状態(#2)カードへ橋渡し（ルーティング）する。scene はスナップショット。覚書本文は memo-list に残り、ユーザーはそれを見ながら状態を書く/上書きする。

**やること（骨子）**
- `memo-list.tsx` の各**非しおり memo** に「この人物の状態へ送る」導線を追加。MemoList は server component なので、**送る操作は client 子コンポーネントに切り出す**（キャラ選択 UI＋遷移/モーダル起動）。この際 `memo-list` の select に **`scene_id` を追加**（送信先 scene を明示的に持ち回るため。現状は未 select）。
- 選択フロー: memo の `scene_id` を持って、キャラを選び、**`character-state-form` をそのキャラ×memo.scene_id で開く**。以降は既存の「抽出→3欄→記録」に乗る。**「送る」は状態カードへのルーティングであり、memo 本文を抽出フィールドに流し込まない**。
- **scene スナップショット**: フォームの記録先 scene は **memo の `scene_id`** を使う（`reading_progress.current` を使わない）。`saveCharacterStateAction` は既に `sceneId` 引数を取るので、ここに memo.scene_id を渡す。
- **prefill 元 state（＝raw_memo の優先順位）**: upsert(1人1シーン1件)の意味を保つため、**その (characterId, memo.scene_id) の既存 state を initial として prefill**（現在シーンの既存ではなく、送信先 scene の既存）。**`raw_memo` もこの initial から**（既存stateのメモ優先／既存が無ければ空）。→ **新規シーンは raw_memo 空＝「メモから抽出」不可**（`character-state-form.tsx:78` が空を弾く＝想定挙動。エラーではない）。dogfood で「送った直後に抽出→"メモを入力してから"」が不自然でないかだけ確認、作り込み不要。
- **N3-4 上書き認知**: 既存があれば上書き。見せ方は §9 の**Q2確定版文言（`isOverwrite = initial != null` 分岐＋"シーンN"表記＋確定ボタンに"上書き"の語）を正本とする**。diff/履歴/undo は作らない。
- **元覚書は消さない**（#2 へ upsert されるだけ。memo 行は残す）＝N3-5 の受け皿。

**受け入れ**: N3-1〜N3-5。

**設計サブ決定（Miru モードB査読で 2026-07-20 確定）**
- 送信先フォームを**どこで開くか＝ハイブリッド確定**＝**(ii)軽量モーダルの器を読書ページに新設＋中身は既存 `character-state-form` 本体を再利用**。根拠＝scene-lock はフォーム本体でなく上位データ取得層（`characters-list.tsx` が `progress.current_scene_id` を自前取得）にある。フォームは `currentSceneId`/`initial` を props で受けるだけ＝**scene 非ロック**。→ (i)全面再利用は共有 server component の外科手術＝`/characters` 本体への巻き添えリスク＝**却下**。sceneId=memo.scene_id、initial=(character×memo.scene_id)の既存 state を読書ページ側で1件先読みして渡す。
- キャラ選択 UI の形（全キャラ一覧 chips か、検索か）。α のキャラ数なら chips で十分の想定。

**落とし穴**
- `memo-list` は現在シーンの memo しか出さない＝送信先 scene は基本 memo の scene で自明。ただし**フォームを開いてから scene 進行した場合に備え、`reading_progress.current` ではなく memo.scene_id を明示的に持ち回る**こと（スナップショットの堅牢化）。
- `saveCharacterStateAction` の所有ガード（`sceneBelongsToBook`）は通る（同一 book の scene）。

## 6. N2: しおり独立ボタン（旧 M1・独立着手可）
**目的**: 本文なし・1タップで現在シーンにしおり。

**やること（骨子）**
- `lib/schemas/memo.ts` に **`createBookmarkSchema`（`scene_id` のみ）** を追加。`createMemoSchema` の本文必須は緩めない。
- `actions.ts` に **しおり作成/トグルの server action** を追加（`memos` に `body=''`, `is_bookmark=true` で INSERT。**同一シーンに既存の「`body='' かつ is_bookmark=true`」があれば削除＝トグル解除**。本文ありレコードは対象外＝初期スキーマの昇格運用と非干渉）。
- 読書ページに**独立「しおり」ボタン**（client・1タップ・現在シーンのしおり有無を状態表示）。`MemoForm` からは `is_bookmark` チェックを撤去済み（N1）。
- `memo-list.tsx` は `is_bookmark` で既にアイコン分岐（44行）＝本文空でも表示は壊れない。表示の微調整のみ。

**受け入れ**: N2-1〜N2-5。`pending_memos` ビューの意味（`body=''` を整理待ちで拾う）を壊さない。

**落とし穴**: トグル削除の対象を**厳密に**（`scene_id` 一致＋`is_bookmark=true`＋`body=''`）。本文ありメモを消さない。

---

## 7. 全体の受け入れ（合格基準 §8・§9）
- `npm run typecheck` / `npm run lint` グリーン（ホスト）。
- 帯（表示・インライン展開・as-of・横スクロール・並び順）が従来どおり＝**回帰していない**。
- migration は N2 しおり以外で増えていない。
- **実機（iPad・タッチ・片手・ソフトキーボード）**で N1（保存が隠れない）・N2（親指1タップ）・N4（中断復帰で消えない）・N3（上書き認知）を確認。PC のみは不合格。
- dogfood 1回: 「書き留める」「しおり」「人物へ送る」を各1回通す。

## 8. スコープガード
- 案2（AI 昇格提案）を今やりたくなったら赤信号＝**先に案3で dogfood → 的中率計測 → 後乗せ**。
- 帯を触りたくなったら赤信号（read-only・7/10）。案C（帯からの書き込み）はスコープ外。
- タイムボックス＝**Week12 いっぱいで設計確定＋実装着手判断**。超えそうなら現在地で相談。

## 9. Miru モードB査読（2026-07-20 完了・決定を反映済み）
査読結果（3点＋Q1サブ）は本人合意でロック。詳細は `_現在地.md`（Week12 Day3 エントリ）。要点：
1. **送信先フォームの開き方＝(ii)器新設＋`character-state-form`再利用のハイブリッド**（§5設計サブ決定参照）。(i)全面再利用は却下。
2. **N3-4 上書き認知＝下記【Q2確定版】文言を正本**（prefill だけでは伝わらない → 派生テキストで補う。diff/履歴/undoは作らない）。
3. **N1「登場人物」導線＝参照専用化で進める（dogfoodまで様子見）**。戻り口は**主要キャラ帯に付けない**（帯は read-only・案C＝帯からの書込みはスコープ外）。≤1タップ要件は「モーダルを閉じれば読書ページの常時ある『書き留める』入口」で担保。

### 【Q2確定版】N3-4 上書き文言（`character-state-form.tsx` 差し込み・正本）
分岐キー：`const isOverwrite = initial != null;` ／ `sceneN: number` を1プロップ追加（`scenePositionById` で既算出・再計算不要）

| 位置 | 条件 | 確定文言 |
|---|---|---|
| DialogTitle | 共通 | 〈キャラ名〉の状態 |
| DialogDescription | 共通 | シーンN時点の記録として保存します |
| 上部muted一行 | isOverwrite | このシーン（N）には既に記録があります。保存すると内容を置き換えます。 |
| 上部muted一行 | !isOverwrite（任意・削可） | シーンNの初回記録です |
| 送信ボタン（:218差替） | — | `isPending ? (isOverwrite ? '上書き中…' : '記録中…') : (isOverwrite ? '上書きする' : '記録する')` |

要点＝①「現在シーン」でなく必ず**"シーンN"**表記（N4復帰で覚書の scene_id が今と食い違う事故止め）②確定ボタンに**"上書き"の語**（親指が乗る直前の最後の歯止め）。
