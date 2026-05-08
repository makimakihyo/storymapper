'use server'

import { headers } from 'next/headers'
import { z } from 'zod'

import { createClient } from '@/lib/supabase/server'

const SignInSchema = z.object({
  email: z.string().trim().email({ message: 'メールアドレスの形式が正しくありません' }),
})

export type SignInState =
  | { status: 'idle' }
  | { status: 'sent'; email: string }
  | { status: 'error'; message: string }

async function resolveOrigin(): Promise<string> {
  const headerList = await headers()
  const explicit = headerList.get('origin')
  if (explicit) return explicit

  const host = headerList.get('host')
  if (!host) return 'http://localhost:3000'
  const proto = headerList.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https')
  return `${proto}://${host}`
}

export async function signInAction(
  _prev: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const parsed = SignInSchema.safeParse({ email: formData.get('email') })
  if (!parsed.success) {
    return {
      status: 'error',
      message: parsed.error.issues[0]?.message ?? 'メールアドレスの形式が正しくありません',
    }
  }

  const supabase = await createClient()
  const origin = await resolveOrigin()

  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: {
      // /auth/callback ハンドラは Day 5 後半で実装予定。
      // それまではメールのリンクを踏むと 404 で着地する想定。
      emailRedirectTo: `${origin}/auth/callback`,
    },
  })

  if (error) {
    return { status: 'error', message: error.message }
  }

  return { status: 'sent', email: parsed.data.email }
}
