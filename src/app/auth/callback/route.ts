import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// 失敗理由を signin に渡すヘルパ。
// URL に載せるのは既知の error コードのみ。生のエラー文字列は載せない:
// 任意文字列を「公式なサインインエラー」に見せかける悪用(フィッシング)や、
// 認証内部情報の露出を防ぐため。詳細はサーバーログ側で確認する。
function backToSignin(origin: string, reason: string) {
  const p = new URLSearchParams({ error: reason })
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
    // エラーは握りつぶさない。生の詳細はサーバーログにだけ残す。
    console.error('[auth/callback] provider error', {
      error: providerError,
      error_code: errorCode,
      error_description: errorDescription,
    })
    return backToSignin(origin, errorCode ?? providerError ?? 'auth')
  }

  if (!code) {
    // code も error も無い = そもそも verify を通っていない/変なアクセス
    console.error('[auth/callback] missing code in callback URL')
    return backToSignin(origin, 'no_code')
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    // 本命の診断対象: PKCE verifier 欠落なら "code verifier" 系のメッセージが出る。
    // 生メッセージはログにのみ出し、画面には固定文言のみを見せる。
    console.error('[auth/callback] exchangeCodeForSession failed:', error.message)
    return backToSignin(origin, 'exchange_failed')
  }

  // Open redirect 対策: 同一オリジン相対パスのみ許容
  const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/'
  return NextResponse.redirect(`${origin}${safeNext}`)
}
