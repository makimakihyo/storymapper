import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';

type Client = SupabaseClient<Database>;

/**
 * scene が指定 book に属するか。
 * RLS(scenes_owner_all USING)で「自分の book」に限定されるため、
 * .eq('book_id', bookId) と合わせて「自分の・同一 book の」scene のみ true。
 */
export async function sceneBelongsToBook(
  supabase: Client,
  bookId: string,
  sceneId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from('scenes')
    .select('id')
    .eq('id', sceneId)
    .eq('book_id', bookId)
    .maybeSingle();
  return !!data;
}

/** character が指定 book に属するか（同上）。 */
export async function characterBelongsToBook(
  supabase: Client,
  bookId: string,
  characterId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from('characters')
    .select('id')
    .eq('id', characterId)
    .eq('book_id', bookId)
    .maybeSingle();
  return !!data;
}
