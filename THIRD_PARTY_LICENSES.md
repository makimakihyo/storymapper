# Third-Party Licenses

StoryMapper uses third-party open source software. Their licenses and
copyright notices are listed below.

This file is a starter template. The full list can be regenerated with:

```
npx license-checker --production --json > third-party-licenses.json
```

を、Phase 3 課金化前(2026/11 想定)までに実施し、本ファイルを最新化する。

---

## 主要依存(初期想定)

| パッケージ | ライセンス | 用途 |
|---|---|---|
| Next.js | MIT | Web フレームワーク |
| React | MIT | UI ライブラリ |
| Tailwind CSS | MIT | CSS フレームワーク |
| TypeScript | Apache-2.0 | 型システム |
| @supabase/supabase-js | MIT | Supabase クライアント |
| @supabase/ssr | MIT | Next.js 用 Supabase ヘルパー |
| shadcn/ui (コードコピー) | MIT | UI コンポーネント |
| Radix UI | MIT | shadcn の基盤 |
| lucide-react | ISC | アイコン |
| react-hook-form | MIT | フォーム管理 |
| zod | MIT | バリデーション |

※ 上記は初期実装時点の想定。実際の依存ツリーは `package.json` および
`package-lock.json` を正とする。
