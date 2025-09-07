import { Button } from '@/shadcn/components/ui/button'

export function AuthConfirm(){
  return (
    <div className="rounded border p-4 space-y-3">
      <div className="font-medium">验证成功</div>
      <div className="text-sm text-muted-foreground">账户已验证，您现在可以进入受保护区域。</div>
      <div>
        <Button asChild>
          <a href="#/protected/dev">进入 Dev 面板</a>
        </Button>
      </div>
    </div>
  )
}
