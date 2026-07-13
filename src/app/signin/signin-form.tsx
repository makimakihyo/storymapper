'use client'

import { useActionState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

import {
  signInAction,
  verifyOtpAction,
  type SignInState,
  type VerifyOtpState,
} from './actions'

const INITIAL_STATE: SignInState = { status: 'idle' }
const INITIAL_VERIFY_STATE: VerifyOtpState = { status: 'idle' }

type SigninFormProps = {
  next?: string
}

export function SigninForm({ next = '/' }: SigninFormProps) {
  const [state, formAction, pending] = useActionState(signInAction, INITIAL_STATE)
  // フックは無条件で呼ぶ（'sent' 分岐の中で呼ぶと Hooks 規則違反になる）
  const [verifyState, verifyAction, verifyPending] = useActionState(
    verifyOtpAction,
    INITIAL_VERIFY_STATE,
  )

  // メール送信済み: 6桁コードを入力してもらう（リンクは踏ませない）
  if (state.status === 'sent') {
    return (
      <div className="flex flex-col gap-4">
        <div
          role="status"
          aria-live="polite"
          className="rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100"
        >
          <p className="font-medium">確認コードを送信しました。</p>
          <p className="mt-1 text-emerald-800 dark:text-emerald-200">
            {state.email} 宛のメールに記載された6桁のコードを入力してください。
          </p>
        </div>

        <form action={verifyAction} className="flex flex-col gap-4">
          <input type="hidden" name="email" value={state.email} />
          <input type="hidden" name="next" value={next} />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="token">6桁コード</Label>
            <Input
              id="token"
              name="token"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="\d{6}"
              maxLength={6}
              required
              autoFocus
              placeholder="123456"
              className="text-center text-lg tracking-[0.5em]"
              aria-describedby={
                verifyState.status === 'error' ? 'verify-error' : undefined
              }
              aria-invalid={verifyState.status === 'error'}
            />
          </div>

          {verifyState.status === 'error' && (
            <p
              id="verify-error"
              role="alert"
              className="text-sm text-red-600 dark:text-red-400"
            >
              {verifyState.message}
            </p>
          )}

          <Button type="submit" disabled={verifyPending}>
            {verifyPending ? '確認中…' : 'サインイン'}
          </Button>

          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            コードの有効期限が切れた場合は、メールアドレスを入力し直して再送してください。
          </p>
        </form>
      </div>
    )
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="next" value={next} />
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
        {pending ? '送信中…' : '確認コードを送る'}
      </Button>

      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        パスワード不要です。メールに届く6桁コードでサインインできます。
      </p>
    </form>
  )
}
