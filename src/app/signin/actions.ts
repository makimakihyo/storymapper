'use server';

import { headers } from 'next/headers';
import { z } from 'zod';

import { createClient } from '@/lib/supabase/server';

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

function sanitizeNext(value: string | undefined): string {
  if (!value) return '/';
  if (!value.startsWith('/')) return '/';
  if (value.startsWith('//')) return '/';
  return value;
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