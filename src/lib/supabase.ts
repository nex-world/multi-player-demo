import { createClient } from "@supabase/supabase-js"

// Read Vite env vars
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)
export const supabaseConfigMessage = isSupabaseConfigured
  ? null
  : "[Supabase] 缺少 VITE_SUPABASE_URL 或 VITE_SUPABASE_ANON_KEY，请在项目根目录创建 .env.local 并设置它们。"

type SupabaseLike = {
  auth: {
    exchangeCodeForSession: (url: string) => Promise<void>
    getSession: () => Promise<{ data: { session: any | null } }>
    onAuthStateChange: (
      cb: (event: any, session: any | null) => void
    ) => { data: { subscription: { unsubscribe: () => void } } }
    signOut: () => Promise<void>
    signInWithOtp: (
      options: any
    ) => Promise<{ data?: any; error?: Error | null }>
  }
}

let supabase: SupabaseLike

if (isSupabaseConfigured) {
  supabase = createClient(supabaseUrl as string, supabaseAnonKey as string, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      flowType: "pkce",
    },
  }) as unknown as SupabaseLike
} else {
  // eslint-disable-next-line no-console
  console.warn(supabaseConfigMessage)
  // Provide a safe stub to avoid runtime crashes when env vars are missing
  const notConfigured = () =>
    new Error(
      "Supabase 未配置：请在 .env.local 中设置 VITE_SUPABASE_URL 和 VITE_SUPABASE_ANON_KEY。"
    )
  supabase = {
    auth: {
      async exchangeCodeForSession() {
        throw notConfigured()
      },
      async getSession() {
        return { data: { session: null } }
      },
      onAuthStateChange() {
        return { data: { subscription: { unsubscribe() {} } } }
      },
      async signOut() {
        // no-op
      },
      async signInWithOtp() {
        return { error: notConfigured() }
      },
    },
  }
}

export { supabase }
