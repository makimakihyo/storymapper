# storymapper

Reading companion service - track characters, scenes, and notes
読書中にキャラクターの動向や目的を忘れる問題を解決する Web サービス(α版開発中)。

## Status

- 設計フェーズ完了: 2026-04-30
- α版実装フェーズ着手: 2026-05-01
- α版マイルストーン目標: 2026-07-31

## Tech Stack (Phase 1-2)

- Next.js (App Router) + TypeScript
- Supabase (Auth, Postgres)
- Anthropic Claude API
- Vercel

## Development

(後日追記)

## License

Private (α版検証中)




## 開発環境セットアップ

### 前提
- Node.js v24 系
- npm
- Supabase CLI(Scoop経由インストール推奨: `scoop install supabase`)
- Git(Windows OpenSSH 推奨)

### 初回セットアップ
1. リポジトリをクローン
```bash
   git clone git@github.com:makimakihyo/storymapper.git
   cd storymapper
   npm install
```
2. 環境変数を設定
```bash
   cp .env.local.example .env.local
```
   `.env.local` に以下を設定:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

### 開発サーバー起動
```bash
npm run dev
```
http://localhost:3000 でアクセス可能(Turbopack 有効)。

### Supabase 連携(初回のみ)
```bash
supabase link --project-ref pzkpqbrmyfnssxyasfeu
supabase db push
```

### 主要スクリプト
- `npm run dev` — 開発サーバー(Turbopack)
- `npm run build` — 本番ビルド
- `npm run start` — 本番サーバー起動
- `npm run lint` — ESLint

### デプロイ
`main` ブランチへの push で Vercel が自動デプロイ。
本番URL: https://storymapper.vercel.app


