'use client'

import { useActionState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

import { signInAction, type SignInState } from './actions'

const INITIAL_STATE: SignInState = { status: 'idle' }

export function SigninForm() {
  const [state, formAction, pending] = useActionState(signInAction, INITIAL_STATE)

  if (state.status === 'sent') {
    return (
      <div
        role="status"
        aria-live="polite"
        className="rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100"
      >
        <p className="font-medium">サインインリンクを送信しました。</p>
        <p className="mt-1 text-emerald-800 dark:text-emerald-200">
          {state.email} 宛にメールを送りました。受信トレイのリンクをクリックしてサインインを完了してください。
        </p>
      </div>
    )
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">メールアドレス</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="you@example.com"
          aria-describedby={state.status === 'error' ? 'signin-error' : undefined}
          aria-invalid={state.status === 'error'}
        />
      </div>

      {state.status === 'error' && (
        <p
          id="signin-error"
          role="alert"
          className="text-sm text-red-600 dark:text-red-400"
        >
          {state.message}
        </p>
      )}

      <Button type="submit" disabled={pending}>
        {pending ? '送信中…' : 'サインインリンクを送る'}
      </Button>

      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        パスワード不要です。届いたメールのリンクから本サービスにサインインできます。
      </p>
    </form>
  )
}
