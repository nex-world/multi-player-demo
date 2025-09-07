import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { supabase } from '@/lib/supabase'
import { maskEmailForDisplay } from '@/lib/mask'
import { Input } from '@/shadcn/components/ui/input'
import { Label } from '@/shadcn/components/ui/label'
import { Button } from '@/shadcn/components/ui/button'
import { Eye, EyeOff } from 'lucide-react'

function isHexColor(str: string) {
  return /^#?[0-9a-fA-F]{6}$/.test(str)
}

export function StartPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState<string>('')
  const [showEmail, setShowEmail] = useState(false)
  const [fullName, setFullName] = useState('')
  const [preferredColor, setPreferredColor] = useState('#64748b') // slate-500 as default
  const [nickname, setNickname] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    const bootstrap = async () => {
      const { data } = await supabase.auth.getSession()
      const session = data.session
      if (!session) {
        navigate('/auth/login', { replace: true })
        return
      }
      if (!mounted) return
      const user = session.user
      setEmail(user.email || '')
      const meta = (user.user_metadata || {}) as Record<string, any>
      setFullName(meta.full_name || '')
      const color = meta.preferred_color || '#64748b'
      setPreferredColor(color.startsWith('#') ? color : `#${color}`)
      setNickname(meta.nickname || (user.email ? user.email[0]?.toUpperCase() : ''))
      setLoading(false)
    }
    bootstrap()
    return () => {
      mounted = false
    }
  }, [navigate])

  const avatarChar = useMemo(() => (nickname?.trim()?.[0] || '?').toUpperCase(), [nickname])
  const displayEmail = useMemo(() => {
    if (!email) return ''
    return showEmail ? email : maskEmailForDisplay(email)
  }, [email, showEmail])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setMessage(null)
    setError(null)
    try {
      const color = preferredColor.startsWith('#') ? preferredColor : `#${preferredColor}`
      if (!isHexColor(color)) throw new Error('preferred_color 需为 6 位十六进制颜色，例如 #22c55e')
      const { data, error } = await supabase.auth.updateUser({
        data: {
          full_name: fullName,
          preferred_color: color.toLowerCase(),
          nickname,
        },
      })
      if (error) throw error
      // 采用服务端返回的最新用户数据刷新本地显示
      const updatedUser = (data as any)?.user
      if (updatedUser) {
        const meta = (updatedUser.user_metadata || {}) as Record<string, any>
        setFullName(meta.full_name ?? fullName)
        const nextColor = (meta.preferred_color || color).toString()
        setPreferredColor(nextColor.startsWith('#') ? nextColor : `#${nextColor}`)
        setNickname(meta.nickname ?? nickname)
      }
      // 触发一次 session 读取以便其他订阅方获取到最新 user_metadata（幂等）
      try { await supabase.auth.getSession() } catch {}
      setMessage('已保存')
    } catch (err: any) {
      setError(err?.message ?? '保存失败，请重试')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="p-6">Loading...</div>

  return (
    <div className="mx-auto max-w-xl p-6 space-y-6">
      <div className="flex items-center gap-4">
        <div
          className="flex h-16 w-16 items-center justify-center rounded-full text-xl font-bold text-white shadow"
          style={{ backgroundColor: preferredColor }}
          aria-label="avatar"
          title={nickname}
        >
          {avatarChar}
        </div>
        <div className="flex-1">
          <div className="text-sm text-muted-foreground">当前账户</div>
          <div className="flex items-center gap-2">
            <span className="font-medium">{displayEmail}</span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setShowEmail((v) => !v)}
              aria-label={showEmail ? '隐藏邮箱' : '显示邮箱'}
              title={showEmail ? '隐藏邮箱' : '显示邮箱'}
            >
              {showEmail ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-4">
        <div className="grid gap-2">
          <Label htmlFor="full_name">Full Name</Label>
          <Input id="full_name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="nickname">Nickname</Label>
          <Input id="nickname" value={nickname} onChange={(e) => setNickname(e.target.value)} />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="preferred_color">Preferred Color (hex)</Label>
          <Input
            id="preferred_color"
            value={preferredColor}
            onChange={(e) => setPreferredColor(e.target.value)}
            placeholder="#64748b"
          />
        </div>

        {message && <div className="text-sm text-green-500">{message}</div>}
        {error && <div className="text-sm text-red-500">{error}</div>}

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={saving}>
            {saving ? 'Saving...' : 'Save'}
          </Button>
          <Button type="button" variant="secondary" onClick={() => navigate('/connect-room')}>
            前往加入房间
          </Button>
          <Button type="button" variant="outline" onClick={() => navigate('/auth/update-password')}>
            修改密码
          </Button>
        </div>
      </form>
    </div>
  )
}
