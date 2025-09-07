import { Outlet, Link } from 'react-router'

export function AuthLayout() {
  return (
    <div className="min-h-dvh grid place-items-center p-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <div className="text-2xl font-semibold">账户</div>
          <div className="text-sm text-muted-foreground">注册、登录与找回密码</div>
        </div>
        <Outlet />
        <div className="text-center text-xs text-muted-foreground">
          <Link to="/">返回首页</Link>
        </div>
      </div>
    </div>
  )
}
