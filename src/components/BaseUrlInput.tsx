import { useEffect, useMemo, useState } from 'react'
import { Input } from '@/shadcn/components/ui/input'
import { Button } from '@/shadcn/components/ui/button'

const KEY = 'ws_base_urls'

function loadHistory(): string[]{
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const arr = JSON.parse(raw)
    if (Array.isArray(arr)) return arr.filter(Boolean)
  } catch {}
  return []
}

function saveHistory(list: string[]){
  try { localStorage.setItem(KEY, JSON.stringify(list.slice(0, 10))) } catch {}
}

export function BaseUrlInput({ value, onChange }: { value: string, onChange: (v: string)=>void }){
  const [history, setHistory] = useState<string[]>([])
  const [open, setOpen] = useState(false)

  useEffect(() => { setHistory(loadHistory()) }, [])

  function addToHistory(v: string){
    if (!v) return
    const next = [v, ...history.filter(h => h !== v)]
    setHistory(next)
    saveHistory(next)
  }

  function pick(h: string){ onChange(h); setOpen(false) }

  const placeholder = useMemo(() => (
    '例如：wss://your-worker.subdomain.workers.dev'
  ), [])

  return (
    <div className="space-y-1">
      <div className="flex gap-2">
        <Input
          placeholder={placeholder}
          value={value}
          onChange={e=>onChange(e.target.value)}
          onBlur={()=> addToHistory(value)}
        />
        <Button type="button" variant="outline" onClick={()=>setOpen(v=>!v)}>
          历史
        </Button>
      </div>
      {open && history.length > 0 && (
        <div className="max-h-40 overflow-auto rounded border text-sm">
          {history.map((h, i) => (
            <div key={i} className="cursor-pointer truncate px-2 py-1 hover:bg-accent" onClick={()=>pick(h)}>
              {h}
            </div>
          ))}
        </div>
      )}
      <div className="text-xs text-muted-foreground">
        支持 ws:// 或 wss://，不要以斜杠结尾。
      </div>
    </div>
  )
}
