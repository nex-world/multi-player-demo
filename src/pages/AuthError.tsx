import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/shadcn/components/ui/button'

function parseErrorFromLocation(): { error?: string|null, error_description?: string|null }{
  try {
    const url = new URL(window.location.href)
    // Try search first
    let err = url.searchParams.get('error')
    let desc = url.searchParams.get('error_description')
    // If inside hash, e.g. #/auth/error?error=...&error_description=...
    if ((!err && !desc) && url.hash.includes('?')){
      const hashQuery = url.hash.split('?')[1] || ''
      const params = new URLSearchParams(hashQuery)
      err = params.get('error')
      desc = params.get('error_description')
    }
    return { error: err, error_description: desc }
  } catch { return {} }
}

export function AuthError(){
  const [cleared, setCleared] = useState(false)
  const { error, error_description } = useMemo(parseErrorFromLocation, [])

  useEffect(() => {
    // cleanup search params to avoid repeat errors when navigating back
    try {
      const url = new URL(window.location.href)
      if (url.search) {
        const clean = `${url.origin}${url.pathname}${url.hash.split('?')[0]}`
        window.history.replaceState({}, document.title, clean)
        setCleared(true)
      }
    } catch {}
  }, [])

  const message = useMemo(() => {
    const raw = decodeURIComponent(error_description || error || '')
    if (/otp_expired|invalid/i.test(raw)){
      return '登录链接已失效或不正确，请回到登录页重新发送邮件。'
    }
    if (/access_denied/i.test(raw)){
      return '访问被拒绝，请重试或更换登录方式。'
    }
    return raw || '登录失败，请重试。'
  }, [error, error_description])

  function goHome(){
    window.location.hash = '#/'
  }

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-xl font-semibold">登录错误</h1>
      <div className="text-sm text-red-500">{message}</div>
      <div className="text-xs text-muted-foreground">
        {error && <div>error: {error}</div>}
        {error_description && <div>detail: {decodeURIComponent(error_description)}</div>}
        {cleared && <div>已清理地址栏参数。</div>}
      </div>
      <div>
        <Button onClick={goHome}>返回登录页</Button>
      </div>
    </div>
  )
}
