import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/lib/supabase/database.types'  // ← 追加

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  )
}