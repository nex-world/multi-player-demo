import Hello from "@/components/Hello"
import { useEffect, useState } from "react"
import { supabase, isSupabaseConfigured, supabaseConfigMessage } from "@/lib/supabase"
import { LoginForm } from "@/components/login-form"
import { Button } from "@/shadcn/components/ui/button"
import { Link } from 'react-router'
import type { AuthChangeEvent, Session } from "@supabase/supabase-js"
import { useAuthStore } from "@/stores/auth"
import { maskEmailForDisplay } from "@/lib/mask"

export default function App(){
  return <AuthGate/>
}

function AuthGate(){
  const [loading, setLoading] = useState(true)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const { setAuth } = useAuthStore()

  useEffect(() => {
    let mounted = true
    const url = new URL(window.location.href)
    const hasCode = url.searchParams.get("code")
    const hasError = url.searchParams.get("error_description")

    const bootstrap = async () => {
      // If supabase is not configured, skip auth bootstrap and stop loading
      if (!isSupabaseConfigured) {
        setLoading(false)
        return
      }
      if (hasError) {
        // eslint-disable-next-line no-console
        console.error("OAuth error:", hasError)
      }
      if (hasCode) {
        try {
          await supabase.auth.exchangeCodeForSession(window.location.href)
          // Clean URL params after exchange
          // 清理查询参数但保留 hash（兼容 Hash Router）
          window.history.replaceState({}, document.title, url.origin + url.pathname + url.hash)
        } catch (e) {
          // eslint-disable-next-line no-console
          console.error("Failed to exchange code for session", e)
        }
      }
      const { data }: { data: { session: Session | null } } = await supabase.auth.getSession()
      if (!mounted) return
      const email = data.session?.user?.email ?? null
      const token = data.session?.access_token ?? null
      setUserEmail(email)
      setAuth(token, email)
      if (token) localStorage.setItem('access_token', token)
      if (email) localStorage.setItem('user_email', email)
      setLoading(false)
    }
    bootstrap()
    const { data: sub } = supabase.auth.onAuthStateChange((
      _event: AuthChangeEvent,
      session: Session | null,
    ) => {
      const email = session?.user?.email ?? null
      const token = session?.access_token ?? null
      setUserEmail(email)
      setAuth(token, email)
      if (token) localStorage.setItem('access_token', token)
      else localStorage.removeItem('access_token')
      if (email) localStorage.setItem('user_email', email)
      else localStorage.removeItem('user_email')
    })
    return () => {
      mounted = false
      sub.subscription.unsubscribe()
    }
  }, [])

  if (loading) return <div className="p-6">Loading...</div>

  if (!isSupabaseConfigured) {
    return (
      <div className="mx-auto max-w-xl p-6">
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-4">
          <div className="font-medium mb-1">需要配置 Supabase 环境变量</div>
          <div className="text-sm text-muted-foreground">
            {supabaseConfigMessage || '请在项目根目录创建 .env.local 并设置 VITE_SUPABASE_URL 与 VITE_SUPABASE_ANON_KEY，然后重新启动开发服务器。'}
          </div>
          <div className="mt-3 text-xs text-muted-foreground">
            示例：
            <pre className="mt-1 rounded bg-background p-2 overflow-auto">{`VITE_SUPABASE_URL=your-url
VITE_SUPABASE_ANON_KEY=your-anon-key`}</pre>
          </div>
        </div>
      </div>
    )
  }

  if (!userEmail) {
    return (
      <div className="mx-auto max-w-sm p-6">
        <LoginForm />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-4">
      <div className="text-sm text-muted-foreground">已登录：{maskEmailForDisplay(userEmail)}</div>
      <div className="flex gap-2">
        <Button
          variant="outline"
          onClick={() => {
            supabase.auth.signOut()
          }}
        >
          退出登录
        </Button>
        <Button asChild>
          <Link to="/room">进入房间</Link>
        </Button>
        {/* <Button asChild variant="secondary">
          <Link to="/dev">开发者面板</Link>
        </Button> */}
      </div>
      <Hello />
    </div>
  )
}
