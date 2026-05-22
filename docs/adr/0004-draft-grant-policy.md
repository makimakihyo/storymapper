# ADR-0004: 新規テーブルの GRANT 規約(Supabase Data API ロックダウン対応)

- ステータス: 提案(本人レビュー後に採用へ)
- 日付: 2026-05-22
- 関係者: makimaki
- 注: 本ファイルは Cowork 上のたたき。本人レビュー後 PowerShell で claudework に取り込み

## コンテキスト

### 告知の一次情報

2026-04-28 に Supabase が公式 Changelog を公開。2026-05-13 に告知メールを受領(発端)。

- 一次情報: [GitHub Discussion #45329](https://github.com/orgs/supabase/discussions/45329)
- 概要: public スキーマに作成したテーブルを Data API(PostgREST / GraphQL)経由で使うには、**明示的な GRANT** が必要になる

### ロールアウト日程(確定)

| 日付 | 内容 |
|---|---|
| 2026-04-28 | Changelog 公開。プロジェクト作成時のオプトイン設定が利用可能に |
| **2026-05-30** | 新規プロジェクト作成時のデフォルトが新動作(GRANT 必須)に |
| **2026-10-30** | 既存プロジェクトにも新動作を適用(以降の新規テーブル作成から GRANT 必須) |

### 既存テーブルへの影響(重要)

> "Existing tables are not affected in your project, they keep their current grants and stay reachable."
> — GitHub Discussion #45329

**既存テーブルの grants は永続的に維持される。** Oct 30 は「既存プロジェクトへ新ルールが適用開始される日」であって、「既存テーブルの grant が剥奪される日」ではない。

Oct 30 以降に既存プロジェクトで起きることは以下のとおりです。

```sql
-- Supabase が内部で適用する変更(future tables にのみ影響)
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLES FROM anon, authenticated, service_role;
```

これは **将来作成するテーブルの GRANT デフォルト動作を変更するだけ**。既存テーブルはそのまま動き続ける。

### StoryMapper の現状

- 既存 9 テーブルは現行 grants が永続的に維持される → **棚卸し不要**
- α版では新規テーブル追加の予定なし → 本規約は α版実装には影響しない
- **Oct 30 以降の新規テーブル追加(β以降)から本規約が効いてくる**

### 技術的背景

Supabase の Data API は PostgREST 上に構築されており、テーブルへ API 経由でアクセスするには ロール(anon / authenticated / service_role)に対する**テーブルレベルの GRANT** が必要。

GRANT(テーブルレベル: アクセスの可否)と RLS(行レベル: 見える行のフィルタ)は別レイヤーで、両方を意図的に設計する必要がある。**GRANT がなければ RLS の設定に関わらず PostgREST は 42501 エラーを返す。**

```json
{
  "code": "42501",
  "message": "permission denied for table your_table",
  "hint": "Grant the required privileges to the current role with: GRANT SELECT ON public.your_table TO anon;"
}
```

StoryMapper は `@supabase/ssr` の `createServerClient`(`authenticated` ロール)+ `.from()` で Data API 経由アクセスしている → `authenticated` への GRANT は必須前提。

### 各ロールの役割

| ロール | 用途 | StoryMapper α版での要否 |
|---|---|---|
| `anon` | 未ログインユーザー | **不要**(全ページ認証必須、未ログインがデータにアクセスする導線なし) |
| `authenticated` | ログイン済みユーザー(JWT) | **必要**(全テーブル) |
| `service_role` | RLS バイパス管理操作、バッチ処理 | **α版不要**(service_role 経由の Server Action なし。β以降で管理機能・バッチ作成時に要追加) |

### 問題

このまま規約化しないと、β以降の新規テーブル追加時に GRANT を忘れ、「ローカルでは動くが本番でテーブルにアクセスできない(42501)」事故が起きうる。逆に過剰な GRANT は不要な API 露出や RLS 前提の崩れを招く。

## 決定

新規テーブルを作成する migration には、**必ず明示的な GRANT 文を最小権限で含める**ことを規約とする。

### 標準 migration テンプレ(GRANT セクション)

```sql
-- ① テーブル作成
CREATE TABLE public.xxx (
  ...
);

-- ② GRANT(ロール別に明示。不要ロールはコメントアウトのまま残す)
-- authenticated: ログインユーザーが読み書きする全テーブルに付与
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.xxx TO authenticated;
-- service_role: 将来の管理機能・バッチ処理向け。現α版では基本コメントアウト
-- GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.xxx TO service_role;
-- anon: 未ログインにも見せる公開系テーブルのみ。StoryMapperでは原則不使用
-- GRANT SELECT ON TABLE public.xxx TO anon;

-- ③ SERIAL / IDENTITY 列やシーケンスがある場合
-- GRANT USAGE ON SEQUENCE public.xxx_id_seq TO authenticated;

-- ④ RLS 有効化(ADR-0003 と連携、必須)
ALTER TABLE public.xxx ENABLE ROW LEVEL SECURITY;

-- ⑤ RLS ポリシー(ADR-0003 準拠)
CREATE POLICY "..." ON public.xxx ...;
```

### 実装上の徹底ポイント

- コメントアウトされたロール行は**削除せず残す** → 「意図的に付与しなかった」の証跡になる
- `service_role` 経由のみでアクセスするテーブル(API 非公開)は `anon`/`authenticated` を外す → GRANT の有無で「API に出すか出さないか」を明示管理
- migration テンプレの本格整備は Week 4(本 ADR 起票のみ Week 3)

### 関連する運用ルール

- 既存 9 テーブルの grants は変更しない(永続的に現行維持確定、棚卸し不要)
- GRANT を含む migration も「DB 適用 = リポにコミット」を1セット(reference_supabase_rls_patterns の db push 後 commit 運用に準拠)

## 結果(Consequences)

### ポジティブ

- Oct 30 以降の新規テーブルが確実に Data API から使える(GRANT 漏れ事故を構造的に防ぐ)
- 「API に露出するテーブル」を GRANT の有無で明示管理でき、不要な露出を減らせる
- PostgREST の 42501 エラーがヒント付きで出るため、GRANT 漏れを早期に検知できる
- RLS(ADR-0003)と GRANT の二層を意識する設計文化が定着

### ネガティブ

- 新規テーブルごとに GRANT 文を書く手間(テンプレ化で軽減)
- GRANT と RLS の両方を設計する認知コスト(ただし本来必要な設計)

## 検討した代替案

- **A. Data API を使わず Server Action + service_role に寄せる**
  GRANT 管理は不要になるが、RLS による多層防御の恩恵を捨て、全アクセス制御をアプリ層に背負う。コード重複と事故リスクが増えるため不採用。
- **B. 都度判断(規約化しない)**
  GRANT 漏れ事故の再発可能性が高い。ADR-0003 と同じ理由で不採用。
- **C. 旧デフォルト(自動 GRANT)維持を期待**
  Oct 30 以降の新規テーブルで破綻する。不採用。

## 関連

- ADR-0003: Supabase ビューに security_invoker = true を必須化する
- ADR-0005: ソーシャル拡張データモデル(GRANT 文は本 ADR に従うと記載)
- 検証パターン: `reference_supabase_rls_patterns`(memory)
- 一次情報: [GitHub Discussion #45329](https://github.com/orgs/supabase/discussions/45329)(2026-04-28 公開)
- 発端: 告知メール受領 2026-05-13、日次ログ記録 2026-05-14
- データモデル v1: `supabase/migrations/20260428000000_initial_schema.sql`
