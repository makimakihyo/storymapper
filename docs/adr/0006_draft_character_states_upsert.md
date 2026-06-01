# ADR-0006: character_states の同シーンUPSERT方式

- ステータス: 採用
- 日付: 2026-06-01（Week 5 Day 3）
- 関係者: makimaki

---

## コンテキスト

キャラ三点セット設計（Week 5 Day 3）にて、キャラ状態スナップショットの入力UXを決定した。

`character_states` テーブルは「基本は追加（INSERT）、入力ミス修正は UPDATE」と設計補足メモ[2]に明記されている。
ただし、以下のユースケースが発生する：

- ユーザーが同じシーンで「状態を記録」ボタンを複数回押す（書き直し）
- キャラ詳細画面でプリフィルされた値を修正して再保存する

この場合、現スキーマでは `(character_id, scene_id)` に複数レコードが INSERT される。
`latest_visible_character_states` ビューは `ORDER BY s.order_key DESC` で最新を取るが、**同一シーン内の複数レコードはどれが選ばれるか不定**（`order_key` が同値のため）。

## 決定

`character_states` テーブルに `UNIQUE(character_id, scene_id)` 制約を追加し、アプリ層でUPSERTを使う。

```sql
-- マイグレーション: 20260601000000_character_states_unique_char_scene.sql
ALTER TABLE character_states
  ADD CONSTRAINT uq_character_states_char_scene
  UNIQUE (character_id, scene_id);
```

アプリ層のINSERT文:

```sql
INSERT INTO character_states
  (character_id, scene_id, observed_in_scene_id, current_location, goal, affiliation)
VALUES
  ($1, $2, $2, $3, $4, $5)
ON CONFLICT (character_id, scene_id)
DO UPDATE SET
  current_location     = EXCLUDED.current_location,
  goal                 = EXCLUDED.goal,
  affiliation          = EXCLUDED.affiliation,
  observed_in_scene_id = EXCLUDED.observed_in_scene_id,
  updated_at           = NOW();
```

※ `observed_in_scene_id = scene_id`（α版簡易運用。ネタバレフィルタ設計ノート §2.5 参照）

## 理由

### 採用しなかった代替案

**案ii（複数レコード許容）**:
- 同シーン複数レコードを許容し、ビューで最新を拾う
- `latest_visible_character_states` の ORDER BY に `cs.created_at DESC` を追加すれば回避可能だが、ビューの修正が別途必要になる
- 「同じシーンを何度でも上書きできる」という直感的なUXにならない

→ **UXの直感性 + ビュー修正不要** の点でUPSERTが優る。

### ADR-0005 非破壊原則との整合

ADR-0005 D2: 「β拡張は非破壊的な追加のみで実現する」
制約追加（`ADD CONSTRAINT`）は既存データを削除せず、既存カラムの型変更でもない。
非破壊的な追加として ADR-0005 D2 の範囲内。

### 既存データへの影響

本ADR適用時点では `character_states` にデータは存在しない（キャラ機能はWeek 6から実装）。
マイグレーション適用時の `UNIQUE` 違反リスクはゼロ。

## 影響

- **追加マイグレーション**: `20260601000000_character_states_unique_char_scene.sql`（Week 6 着手前に適用）
- **アプリ層**: キャラ状態保存のServer ActionでUPSERT構文を使用
- **ビュー変更なし**: `latest_visible_character_states` はそのまま使用可能
- **RLS変更なし**: `character_states_owner_all` ポリシーはそのまま

## 関連

- スキーマ v1: `supabase/migrations/20260428000000_initial_schema.sql`（補足メモ[2]参照）
- キャラ三点セット設計メモ: Cowork `storymapper_character_design_memo.md`（2026-06-01）
- 画面遷移マップ: `docs/design/screen-map-v1.md` §3.4 / 判断6
- ADR-0005 D2（非破壊原則）
- ネタバレフィルタ設計ノート §2.5（observed_in_scene_id の α版運用）
