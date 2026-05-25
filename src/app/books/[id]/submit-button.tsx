'use client';

import { useFormStatus } from 'react-dom';

type Props = {
  children: React.ReactNode;
  disabled?: boolean;
  className?: string;
};

/**
 * useFormStatus で親 <form> の送信中(pending)を読み、送信ボタンを無効化する。
 * disabled は呼び出し側の可否(進行可否・後退可否)と OR で合成。
 * pending 中に押せないので連打・二重送信を物理的に防ぐ。
 */
export function SubmitButton({ children, disabled = false, className }: Props) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={disabled || pending} className={className}>
      {pending ? '処理中…' : children}
    </button>
  );
}