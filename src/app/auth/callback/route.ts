import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// 失敗理由を signin に渡すヘルパ（診断用に本当のエラーを可視化する）
function backToSignin(origin: string, reason: string, detail?: string | null) {
  const p = new URLSearchParams({ error: reason })
  if (detail) p.set('detail', detail)
  return NextResponse.redirect(`${origin}/signin?${p.toString()}`)
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  // Supabase 側 verify が失敗すると redirect_to に error 系クエリを付けて戻す
  // （例: otp_expired = リンク期限切れ / 使用済み）。まずこれを拾う。
  const providerError = searchParams.get('error')
  const errorCode = searchParams.get('error_code')
  const errorDescription = searchParams.get('error_description')
  if (providerError || errorCode) {
    return backToSignin(
      origin,
      errorCode ?? providerError ?? 'auth',
      errorDescription,
    )
  }

  if (!code) {
    // code も error も無い = そもそも verify を通っていない/変なアクセス
    return backToSignin(origin, 'no_code', 'コードが URL にありません')
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    // ここが本命の診断対象: PKCE verifier 欠落なら "code verifier" 系のメッセージが出る
    return backToSignin(origin, 'exchange_failed', error.message)
  }

  // Open redirect 対策: 同一オリジン相対パスのみ許容
  const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/'
  return NextResponse.redirect(`${origin}${safeNext}`)
}
