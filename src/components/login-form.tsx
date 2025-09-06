import { useEffect, useState } from "react"
import { GalleryVerticalEnd } from "lucide-react"

import { cn } from "@/shadcn/lib/utils"
import { Button } from "@/shadcn/components/ui/button"
import { Input } from "@/shadcn/components/ui/input"
import { Label } from "@/shadcn/components/ui/label"
import { supabase } from "@/lib/supabase"

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  // 邮件 6 位验证码登录当前未启用

  async function handleEmailLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setMessage(null)
    setError(null)
    try {
      // 不再覆盖重定向地址，改为使用 Supabase 项目中配置的 Site URL
      // 如果需要自定义，可传入 options.emailRedirectTo
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: true },
      })
      if (error) throw error
  setMessage("魔法链接已发送到邮箱，请在该设备浏览器中打开链接完成登录。")
    } catch (err: any) {
      setError(err?.message ?? "登录失败，请重试。")
    } finally {
      setLoading(false)
    }
  }

  // 验证码登录逻辑已下线（保留注释以便未来开启）
  // async function handleVerifyCode(e: React.FormEvent) { /* ... */ }

  // 显示 URL 中的错误（如 OTP 过期）
  useEffect(() => {
    const url = new URL(window.location.href)
    const errDesc = url.searchParams.get('error_description')
    const err = url.searchParams.get('error')
    if (errDesc || err) {
      const raw = decodeURIComponent(errDesc || err || '')
      const pretty = /otp_expired|invalid/i.test(raw)
        ? '登录链接已失效或不正确，请在本页重新发送邮件。'
        : raw
      setError(pretty)
      // 清理地址栏参数，避免反复提示
      window.history.replaceState({}, document.title, url.origin + url.pathname + url.hash)
    }
  }, [])

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <form onSubmit={handleEmailLogin}>
        <div className="flex flex-col gap-6">
          <div className="flex flex-col items-center gap-2">
            <a
              href="#"
              className="flex flex-col items-center gap-2 font-medium"
            >
              <div className="flex size-8 items-center justify-center rounded-md">
                <GalleryVerticalEnd className="size-6" />
              </div>
              <span className="sr-only">Acme Inc.</span>
            </a>
            <h1 className="text-xl font-bold">Welcome to Acme Inc.</h1>
            <div className="text-center text-sm">
              Don&apos;t have an account?{" "}
              <a href="#" className="underline underline-offset-4">
                Sign up
              </a>
            </div>
          </div>
          <div className="flex flex-col gap-6">
            <div className="grid gap-3">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="m@example.com"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Sending..." : "Login via Magic Link"}
            </Button>
          </div>
          {message && (
            <div className="text-sm text-green-500">{message}</div>
          )}
          {error && <div className="text-sm text-red-500">{error}</div>}
          {/* 6 位验证码登录暂未开启 */}
          {/* 第三方登录暂不支持，界面移除 */}
        </div>
      </form>
      <div className="text-muted-foreground *:[a]:hover:text-primary text-center text-xs text-balance *:[a]:underline *:[a]:underline-offset-4">
        By clicking continue, you agree to our <a href="#">Terms of Service</a>{" "}
        and <a href="#">Privacy Policy</a>.
      </div>
    </div>
  )
}
