import { Link } from 'react-router'

export function BackBar(){
  return (
    <div className="sticky top-0 z-10 mb-3 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-10 max-w-screen-md items-center gap-3 px-3">
        <Link to="/" className="text-sm hover:underline">← 返回主页</Link>
        <div className="ml-auto text-xs text-muted-foreground">Multi-player demo</div>
      </div>
    </div>
  )
}
