'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';

import { createClient } from '@/lib/supabase/server';
import { sanitizeNext } from '@/lib/auth/safe-next';

const SignInSchema = z.object({
  email: z
    .string()
    .trim()
    .email({ message: 'メールアドレスの形式が正しくありません' }),
  next: z.string().optional(),
});

export type SignInState =
  | { status: 'idle' }
  | { status: 'sent'; email: string }
  | { status: 'error'; message: string };

// 6桁OTPコードの検証。リンクを踏まないためGmailのプリフェッチ消費・
// cookie跨ぎ(PKCE code_verifier欠落)の影響を受けない。
const VerifyOtpSchema = z.object({
  email: z.string().trim().email(),
  token: z
    .string()
    .trim()
    .regex(/^\d{6}$/, { message: '6桁の数字コードを入力してください' }),
  next: z.string().optional(),
});

export type VerifyOtpState =
  | { status: 'idle' }
  | { status: 'error'; message: string };

async function resolveOrigin(): Promise<string> {
  const headerList = await headers();
  const explicit = headerList.get('origin');
  if (explicit) return explicit;

  const host = headerList.get('host');
  if (!host) return 'http://localhost:3000';
  const proto =
    headerList.get('x-forwarded-proto') ??
    (host.startsWith('localhost') ? 'http' : 'https');
  return `${proto}://${host}`;
}

export async function signInAction(
  _prev: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const parsed = SignInSchema.safeParse({
    email: formData.get('email'),
    next: formData.get('next'),
  });
  if (!parsed.success) {
    return {
      status: 'error',
      message:
        parsed.error.issues[0]?.message ??
        'メールアドレスの形式が正しくありません',
    };
  }

  const supabase = await createClient();
  const origin = await resolveOrigin();
  const next = sanitizeNext(parsed.data.next);

  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: {
      emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });

  if (error) {
    return { status: 'error', message: error.message };
  }

  return { status: 'sent', email: parsed.data.email };
}

export async function verifyOtpAction(
  _prev: VerifyOtpState,
  formData: FormData,
): Promise<VerifyOtpState> {
  const parsed = VerifyOtpSchema.safeParse({
    email: formData.get('email'),
    token: formData.get('token'),
    next: formData.get('next'),
  });
  if (!parsed.success) {
    return {
      status: 'error',
      message:
        parsed.error.issues[0]?.message ?? '6桁の数字コードを入力してください',
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    email: parsed.data.email,
    token: parsed.data.token,
    type: 'email',
  });

  if (error) {
    return { status: 'error', message: error.message };
  }

  // 成功。セッションcookieはserver clientが書き込み済み。目的地へ。
  redirect(sanitizeNext(parsed.data.next));
}