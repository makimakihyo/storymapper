import { createClient } from '@/lib/supabase/server'
import { signOut } from '@/app/signout/actions'

export default async function Home() {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  const email = data?.claims?.email ?? '(unknown)'

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-6">
      <h1 className="text-2xl font-bold">StoryMapper</h1>
      <p>ログイン中: {email}</p>
      <form action={signOut}>
        <button
          type="submit"
          className="rounded border px-4 py-2 hover:bg-gray-100"
        >
          ログアウト
        </button>
      </form>
    </main>
  )
}