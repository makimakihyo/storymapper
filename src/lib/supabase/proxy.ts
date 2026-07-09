import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// 未認証でも通すパス(/signin と /auth/* と /signout)
// /band-demo は DP-4 判定用の使い捨て公開デモ（本実装では削除する）
const PUBLIC_PATH_PREFIXES = ['/signin', '/auth', '/signout', '/band-demo']

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATH_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p + '/')
  )
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANT: getClaims はトークンリフレッシュも兼ねるため必ず呼ぶ
  const { data } = await supabase.auth.getClaims()
  const isAuthenticated = !!data?.claims

  const { pathname } = request.nextUrl

  if (!isAuthenticated && !isPublicPath(pathname)) {
    const url = request.nextUrl.clone()
    url.pathname = '/signin'
    url.searchParams.set('next', pathname) // 戻り先を保持
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}