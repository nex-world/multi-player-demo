import { useEffect, useRef, useState } from 'react'
import { useAuthStore } from '@/stores/auth'
import { Button } from '@/shadcn/components/ui/button'
import { Input } from '@/shadcn/components/ui/input'
import { BackBar } from '@/components/BackBar'
import { BaseUrlInput } from '@/components/BaseUrlInput'

export function DevPage(){
  const { accessToken, userEmail, setAuth } = useAuthStore()
  const [tokenDraft, setTokenDraft] = useState(accessToken ?? '')
  const [roomId, setRoomId] = useState('room-1')
  const [wsUrl, setWsUrl] = useState('')
  const wsRef = useRef<WebSocket|null>(null)
  const [logs, setLogs] = useState<string[]>([])
  const [chat, setChat] = useState('')
  const [jwtInfo, setJwtInfo] = useState<{ alg?: string, kid?: string, exp?: number, sub?: string } | null>(null)

  // load/save token from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('access_token')
    const email = localStorage.getItem('user_email')
    if (saved || email) setAuth(saved, email)
  }, [setAuth])

  useEffect(() => {
    setTokenDraft(accessToken ?? '')
    try {
      if (accessToken) setJwtInfo(inspectJwt(accessToken))
      else setJwtInfo(null)
    } catch {
      setJwtInfo(null)
    }
  }, [accessToken])

  // load persisted ws base url and room id
  useEffect(() => {
    try {
      const bu = localStorage.getItem('ws_base_url') || ''
      const rid = localStorage.getItem('room_id') || 'room-1'
      if (bu) setWsUrl(bu)
      if (rid) setRoomId(rid)
    } catch {}
  }, [])

  function persistToken(){
    localStorage.setItem('access_token', tokenDraft || '')
    if (userEmail) localStorage.setItem('user_email', userEmail)
    setAuth(tokenDraft || null, userEmail)
    try { setJwtInfo(tokenDraft ? inspectJwt(tokenDraft) : null) } catch { setJwtInfo(null) }
  }

  function connect(){
    if (wsRef.current) { try { wsRef.current.close() } catch {} wsRef.current = null }
    if (!wsUrl) { setLogs((l)=>[...l, '[warn] 请先填写 WS Base URL']); return }
    const base = normalizeWsBase(wsUrl)
    const tokenQ = accessToken ? `?token=${encodeURIComponent(accessToken)}` : ''
    const url = `${base}/room/${encodeURIComponent(roomId)}${tokenQ}`
    setLogs((l)=>[...l, `[connecting] ${url}`])
    let ws: WebSocket
    try {
      ws = new WebSocket(url)
    } catch (e: any) {
      setLogs((l)=>[...l, `[error] 无法创建连接：${e?.message || String(e)}（请确认以 ws:// 或 wss:// 开头，或使用 http(s) 自动转换）`])
      return
    }
    wsRef.current = ws
    ws.onopen = () => setLogs((l)=>[...l, `[open] ${url}`])
    ws.onmessage = (ev) => setLogs((l)=>[...l, `[message] ${ev.data}`])
    ws.onclose = (ev) => setLogs((l)=>[...l, `[close] code=${ev.code} reason=${ev.reason || '-'} wasClean=${ev.wasClean}`])
  ws.onerror = () => setLogs((l)=>[...l, `[error] WebSocket 错误`])
    // hello for snapshot
    ws.addEventListener('open', ()=> ws.send(JSON.stringify({type:'hello'})))
    try {
      localStorage.setItem('ws_base_url', wsUrl)
      localStorage.setItem('room_id', roomId)
    } catch {}
  }

  function normalizeWsBase(input: string): string {
    const raw = (input || '').trim()
    const noTrail = raw.replace(/\/$/, '')
    if (/^wss?:\/\//i.test(noTrail)) return noTrail
    if (/^https?:\/\//i.test(noTrail)) return noTrail.replace(/^http/i, 'ws')
    // fallback assume wss
    return `wss://${noTrail}`
  }

  function sendSay(){
    const ws = wsRef.current
    if (!ws) return
    const playerId = userEmail || 'anon'
    const text = chat.trim() || 'hello from dev'
    ws.send(JSON.stringify({ type:'say', playerId, text }))
    setChat('')
  }

  function inspectJwt(token: string){
    const [h, p] = token.split('.')
    if (!h || !p) return null
    const header = JSON.parse(b64urlToJson(h))
    const payload = JSON.parse(b64urlToJson(p))
    return { alg: header.alg, kid: header.kid, exp: payload.exp, sub: payload.sub }
  }

  function b64urlToJson(seg: string){
    let s = seg.replace(/-/g,'+').replace(/_/g,'/')
    const pad = s.length % 4
    if (pad) s += '='.repeat(4-pad)
    const bin = atob(s)
    let out = ''
    for (let i=0;i<bin.length;i++) out += String.fromCharCode(bin.charCodeAt(i))
    return out
  }

  return (
    <div className="p-0">
      <BackBar />
      <div className="p-4 space-y-4">
      <h2 className="font-semibold">Developer Panel</h2>
      <div className="space-y-2">
        <div className="text-xs text-muted-foreground">Email: {userEmail || 'N/A'}</div>
        <div className="flex gap-2">
          <Input placeholder="access_token" value={tokenDraft} onChange={(e)=>setTokenDraft(e.target.value)} />
          <Button variant="outline" onClick={persistToken}>保存 Token</Button>
        </div>
      </div>

      <div className="space-y-2">
        <BaseUrlInput value={wsUrl} onChange={setWsUrl} />
        <div className="flex gap-2">
          <Input placeholder="room id" value={roomId} onChange={(e)=>setRoomId(e.target.value)} />
          <Button onClick={connect}>连接房间</Button>
          <Button variant="outline" onClick={sendSay}>发送 say</Button>
        </div>
      </div>

      <div className="space-y-1">
        <div className="text-sm font-medium">JWT Inspector</div>
        <div className="rounded border p-2 text-xs space-y-1">
          <div>alg: {jwtInfo?.alg || '-'}</div>
          <div>kid: {jwtInfo?.kid || '-'}</div>
          <div>sub: {jwtInfo?.sub || '-'}</div>
          <div>exp: {jwtInfo?.exp ? `${jwtInfo.exp} (${new Date(jwtInfo.exp*1000).toLocaleString()})` : '-'}</div>
        </div>
      </div>

      <div className="flex gap-2">
        <Input placeholder="输入聊天内容，回车发送" value={chat} onChange={(e)=>setChat(e.target.value)} onKeyDown={(e)=>{ if(e.key==='Enter'){ e.preventDefault(); sendSay() } }} />
        <Button variant="outline" onClick={sendSay}>发送</Button>
      </div>

      <div className="space-y-1">
        <div className="text-sm font-medium">Logs</div>
        <div className="h-48 overflow-auto rounded border p-2 text-xs whitespace-pre-wrap">
          {logs.map((l,i)=>(<div key={i}>{l}</div>))}
        </div>
      </div>
    </div>
    </div>
  )
}
