import { createClient as createSupabaseClient } from '@supabase/supabase-js'

export function createClient() {
  const url = import.meta.env.VITE_SUPABASE_URL
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_OR_ANON_KEY
  if (!url || !key) {
    // Best-effort: return a client that will error on usage, but avoid hard crash at import time
    // @ts-expect-error - allow undefined for dev ergonomics; downstream code handles errors
    return createSupabaseClient(url, key)
  }
  return createSupabaseClient(url, key)
}
