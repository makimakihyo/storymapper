# ADR-0003: Supabase ビューに security_invoker = true を必須化する

- ステータス: 採用
- 日付: 2026-05-09
- 関係者: makimaki

## コンテキスト

2026-05-08 (Week 1 Day 6) の Supabase CLI セットアップ・本番DB初期schema適用作業中に、初期 migration `20260428000000_initial_schema.sql` で作成された 5 つのビュー
(`visible_scenes` / `visible_memos` / `pending_memos` / `latest_visible_character_states` / `visible_characters`)
で `security_invoker` オプションが指定されていなかったことが判明した。

PostgreSQL のビューは `security_invoker` を指定しない場合、デフォルトでビュー所有者の権限で評価される
(`security_definer` 相当の挙動)。Supabase の標準環境ではビュー所有者は `postgres` ロールであり、
`postgres` は `BYPASSRLS` 属性を持つ。結果として:

- ビュー経由で実テーブルを参照すると RLS が一切評価されない
- アプリケーション層では `authenticated` ロールでアクセスしているつもりでも、
  ビューを介すれば他ユーザーのデータが取得可能な状態になる
- `visible_*` という命名で「ネタバレフィルタ済みの可視データ」のはずが、
  実際は全ユーザーの全データを見られる状態だった

幸い本番リリース前の検証段階で発見し、緊急 migration `set_views_security_invoker` を追加して
5 ビュー全てに `ALTER VIEW ... SET (security_invoker = true)` を適用済み。
RLS が実際に効いていることも `BEGIN; SET LOCAL ROLE authenticated; SET LOCAL "request.jwt.claims" TO '...'; ...` パターンで実証した。

しかしこれは「気付いて修正した」だけで、再発防止の制度化はできていない。
今後のスキーマ追加でも同じ事故が起き得るため、仕組みとして防ぐ必要がある。

## 決定

StoryMapper の Supabase スキーマで作成する全てのビューに、`security_invoker = true` を**必須**とする。

### 実装上の徹底ポイント

- 新規 migration で `CREATE VIEW ...` を書く際は、必ず `WITH (security_invoker = true)` を指定する
  ```sql
  CREATE VIEW visible_xxx WITH (security_invoker = true) AS
    SELECT ... FROM ... WHERE ...;
  ```
- 既存ビューは `set_views_security_invoker` migration で全て対応済み (2026-05-08)
- migration レビュー時のチェック項目に「ビュー定義に `security_invoker = true` があるか」を追加
- もし将来 `security_definer` 相当の挙動 (ビュー所有者権限で評価) が必要なケースが発生した場合は、
  個別の ADR を起票し、なぜ必要か・どう RLS を担保するかを明記する

### 関連する運用ルール

- ビュー所有者ロールの変更は行わない (Supabase の標準運用 = `postgres` のまま維持)
- `postgres` ロールが `BYPASSRLS` を持つ前提でスキーマ設計する
- RLS 検証は SQL Editor の `postgres` セッションでは無意味なので、
  必ず `SET LOCAL ROLE authenticated; SET LOCAL "request.jwt.claims" TO '...';` で
  ロールと JWT を切り替えた状態で確認する
  (詳細: `reference_supabase_rls_patterns.md` memory)

## 結果 (Consequences)

### ポジティブ

- ビュー経由の RLS バイパスによる情報漏洩リスクを構造的に防げる
- StoryMapper のネタバレ防止機能 (北極星に紐付く差別化要素) の信頼性が担保される
- スキーマレビューの観点が明確になり、レビュー漏れを減らせる
- 将来 CI で migration を静的解析する仕組みを入れる際のチェック項目が明確

### ネガティブ

- ビューでアグリゲーションや結合をする場合、呼び出しユーザーの権限で評価されるため、
  RLS により返却行が削られて意図と異なる集計結果になる可能性がある
  → これはむしろ「ユーザーが見られる範囲で集計する」という正しい挙動なので問題なし
- `security_definer` 的な挙動が必要なユースケース (システム集計、管理者ビュー等) では
  別途 ADR で個別判断する手間が増える
- 既存スキーマ知識のある協力者が将来加わった場合に「なぜ毎回これを書くのか」と疑問を持たれる可能性
  (Supabase の公式デフォルト挙動と異なるため) → ADR で根拠を示せばよい

## 検討した代替案

- **A. アプリケーション層でフィルタを徹底し、ビューを使わない**

  全クエリを `supabase.from('table').select()` ベースで RLS 任せにする。
  ビューを使わなければビュー所有者問題は発生しない。
  しかし複雑な JOIN・派生カラム (visible_scenes の `revealed_at` 計算等) を
  毎回アプリ層で組むのはコード重複と保守性低下を招く。
  SQL レベルで「フィルタ済みの論理ビュー」を提供する利点が大きく不採用。

- **B. ビュー所有者を BYPASSRLS のないカスタムロールに変更**

  Supabase 環境で `CREATE ROLE storymapper_view_owner NOBYPASSRLS` を作成し、
  ビュー所有者を切り替える方式。
  原理的には RLS をバイパスせずに済むが、Supabase 公式運用と乖離するため
  プラットフォームアップデートで壊れるリスクがあり、
  CLI による migration 管理との相性も悪い。運用負荷に見合わないため不採用。

- **C. 都度判断 (規約化しない)**

  各 migration で必要に応じて `security_invoker` を指定する。
  今回の事故 (= 指定漏れ) を再発させる可能性が高く不採用。

## 関連

- 検証パターン: `reference_supabase_rls_patterns.md` (memory)
- 北極星設計原則 (ネタバレ防止): `ADR-0001`
- 該当 migration: `supabase/migrations/<timestamp>_set_views_security_invoker.sql` (2026-05-08 適用済み)
- 初期スキーマ: `supabase/migrations/20260428000000_initial_schema.sql`
