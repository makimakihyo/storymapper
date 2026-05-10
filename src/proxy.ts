import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/proxy'

export async function proxy(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    /*
     * 以下を除く全パスで proxy を実行:
     * - api ルート
     * - _next/static (静的ファイル)
     * - _next/image (画像最適化)
     * - favicon.ico, robots.txt, sitemap.xml (Metadata Files)
     * - 拡張子付きファイル全般 (画像/フォント等)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\..*).*)',
  ],
}