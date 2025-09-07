import { useEffect, useRef, useState } from 'react'
import { Input } from '@/shadcn/components/ui/input'
import { Button } from '@/shadcn/components/ui/button'
import { useAuthStore } from '@/stores/auth'
import { BackBar } from '@/components/BackBar'
// import { BaseUrlInput } from '@/components/BaseUrlInput'
import { supabase } from '@/lib/supabase'
import { idbGetRoom, idbPutMany, type ChatItem } from '@/lib/idb-chat'
import { maskEmailForDisplay, maskEmailsInText } from '@/lib/mask'

type Player = { id: string, x: number, y: number, name: string, color: string }
type ChatMsg = { playerId?: string, name?: string, color?: string, text: string, t: number, kind?: 'system' | 'chat' }

export function ConnectRoom(){
  const { userEmail, accessToken, setAuth } = useAuthStore()
  const [baseUrl, setBaseUrl] = useState('')
  const [roomId, setRoomId] = useState('room-1')
  const wsRef = useRef<WebSocket|null>(null)
  const [chat, setChat] = useState('')
  const [messages, setMessages] = useState<ChatMsg[]>([])
  const [players, setPlayers] = useState<Map<string, Player>>(new Map())
  const [selfId, setSelfId] = useState<string>('')
  const [wsEnvError, setWsEnvError] = useState<string | null>(null)
  // refs to avoid stale closures inside animation loop
  const playersRef = useRef<Map<string, Player>>(new Map())
  const selfIdRef = useRef<string>('')
  const canvasRef = useRef<HTMLCanvasElement|null>(null)
  const animRef = useRef<number|undefined>(undefined)
  const keysRef = useRef<Record<string, boolean>>({})
  const mouseRef = useRef<{x:number,y:number}>({x:0,y:0})
  const worldRef = useRef<{w:number,h:number}>({w:800,h:600})
  // smooth sync for remote players
  const targetsRef = useRef<Map<string, {x:number,y:number}>>(new Map())
  // throttle for move reporting
  const lastSendRef = useRef<number>(0)
  // debounce-batch for system messages (join/leave)
  const sysBufRef = useRef<{ join: string[]; leave: string[] }>({ join: [], leave: [] })
  const sysTimerRef = useRef<number | undefined>(undefined)
  // movement gating flags
  const windowFocusedRef = useRef<boolean>(true)
  const pageVisibleRef = useRef<boolean>(true)
  const inputFocusedRef = useRef<boolean>(false)

  function isEditableElement(el: Element | null): boolean {
    if (!el) return false
    const tag = (el as HTMLElement).tagName
    const ce = (el as HTMLElement).isContentEditable
    if (ce) return true
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
  }
  function canMove(): boolean {
    return windowFocusedRef.current && pageVisibleRef.current && !inputFocusedRef.current
  }

  // helpers
  function enqueueSystem(kind: 'join' | 'leave', name: string) {
    const buf = sysBufRef.current
    buf[kind].push(name)
    if (sysTimerRef.current == null) {
      sysTimerRef.current = window.setTimeout(() => {
        const now = Date.now()
        const joins = buf.join.splice(0)
        const leaves = buf.leave.splice(0)
        if (joins.length) {
          setMessages((m) => [...m.slice(-199), { kind: 'system', text: `${joins.join('、')} 加入房间`, t: now }])
        }
        if (leaves.length) {
          setMessages((m) => [...m.slice(-199), { kind: 'system', text: `${leaves.join('、')} 离开房间`, t: now }])
        }
        if (sysTimerRef.current) { clearTimeout(sysTimerRef.current); sysTimerRef.current = undefined }
      }, 500)
    }
  }

  // load ws base from env and room id (ws must come from env as requirement)
  // Deduplicate messages by a stable key (t|playerId|text)
  function dedupMessages(list: ChatMsg[]): ChatMsg[] {
    const sorted = [...list].sort((a,b)=>a.t-b.t)
    const map = new Map<string, ChatMsg>()
    for (const m of sorted) {
      const key = `${m.t}|${m.playerId ?? ''}|${m.text ?? ''}`
      map.set(key, m)
    }
    return Array.from(map.values())
  }

  useEffect(() => {
    try {
      const envUrl = import.meta.env?.VITE_WEBSOCKET_URL as string | undefined
      const bu = (envUrl && String(envUrl).trim()) || ''
      const rid = localStorage.getItem('room_id') || 'room-1'
      setBaseUrl(bu)
      setRoomId(rid)
      if (!envUrl) {
        setWsEnvError('缺少 VITE_WEBSOCKET_URL 环境变量，请在项目根目录创建 .env.local 并配置。')
      }
    } catch {}
  }, [])

  // load local history when roomId changes (offline available)
  useEffect(() => {
    let cancelled = false
    async function loadLocal() {
      if (!roomId) return
      const items = await idbGetRoom(roomId, 200)
      if (cancelled) return
      if (items.length) {
        const mapped = items.map(m => ({ kind: m.kind || 'chat', playerId: m.playerId, name: m.name, color: m.color, text: m.text, t: m.t }))
        setMessages(dedupMessages(mapped))
      } else {
        setMessages([])
      }
    }
    loadLocal()
    return () => { cancelled = true }
  }, [roomId])

  // restore auth on refresh (direct landing on /room)
  useEffect(() => {
    let cancelled = false
    async function restore(){
      if (!accessToken) {
        try {
          const { data } = await supabase.auth.getSession()
          if (!cancelled) {
            const email = (data.session?.user?.email ?? localStorage.getItem('user_email')) || null
            const token = (data.session?.access_token ?? localStorage.getItem('access_token')) || null
            setAuth(token, email)
          }
        } catch {
          const email = localStorage.getItem('user_email') || null
          const token = localStorage.getItem('access_token') || null
          if (!cancelled) setAuth(token, email)
        }
      }
    }
    restore()
    return () => { cancelled = true }
  }, [])

  // keep refs fresh
  useEffect(() => { playersRef.current = players }, [players])
  useEffect(() => { selfIdRef.current = selfId }, [selfId])

  function connect(){
    if (wsRef.current) { try { wsRef.current.close() } catch {} wsRef.current = null }
    if (animRef.current) { cancelAnimationFrame(animRef.current); animRef.current = undefined }
    if (!baseUrl) {
      setMessages((m)=>[...m.slice(-199), { kind:'system', text:'无法连接：未配置 WebSocket 服务器地址 (VITE_WEBSOCKET_URL)。', t: Date.now() }])
      return
    }
    const tokenQ = accessToken ? `?token=${encodeURIComponent(accessToken)}` : ''
    const base = normalizeWsBase(baseUrl)
    const url = `${base}/room/${encodeURIComponent(roomId)}${tokenQ}`
    const ws = new WebSocket(url)
    wsRef.current = ws
    ws.onopen = () => {
      ensureSelf()
      ws.send(JSON.stringify({type:'hello'}))
    }
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(String(ev.data))
        if (msg.type === 'welcome') {
          setSelfId(msg.userId)
          const cur = playersRef.current.get(msg.userId)
          upsertPlayer({ id: msg.userId, x: cur?.x ?? 400, y: cur?.y ?? 300, name: msg.name, color: msg.color })
          if (playersRef.current.has('self')) { updatePlayers((m)=>{ m.delete('self') }) }
        }
        if (msg.type === 'snapshot') {
          const map = new Map<string, Player>(playersRef.current)
          for (const p of (msg.positions || [])) {
            map.set(p.playerId, { id: p.playerId, x: p.x ?? 0, y: p.y ?? 0, name: p.name ?? `user-${String(p.playerId).slice(0,6)}`, color: p.color ?? '#999' })
          }
          playersRef.current = map
          setPlayers(map)
        }
        if (msg.type === 'pos') {
          if (selfIdRef.current && msg.playerId === selfIdRef.current) {
            // ignore echo for self
          } else {
            const existing = playersRef.current.get(msg.playerId)
            const name = msg.name ?? existing?.name ?? `user-${String(msg.playerId).slice(0,6)}`
            const color = msg.color ?? existing?.color ?? '#999'
            if (!existing) { upsertPlayer({ id: msg.playerId, x: msg.x ?? 0, y: msg.y ?? 0, name, color }) }
            else if (existing.name !== name || existing.color !== color) { upsertPlayer({ ...existing, name, color }) }
            const tx = msg.x ?? existing?.x ?? 0
            const ty = msg.y ?? existing?.y ?? 0
            const next = new Map(targetsRef.current)
            next.set(msg.playerId, { x: tx, y: ty })
            targetsRef.current = next
          }
        }
        if (msg.type === 'history') {
          // 合并并去重历史（允许与本地略有时间差的重复消息聚合）
          const hist: ChatMsg[] = (msg.messages || []).map((it: any) => ({ kind: 'chat', playerId: it.playerId, name: it.name, color: it.color, text: it.text, t: it.t }))
          if (hist.length) {
            idbPutMany(hist.map(h => ({ roomId, ...h }))).catch(()=>{})
            setMessages((m) => dedupMessages([...m, ...hist]).slice(-200))
          }
        }
        if (msg.type === 'chat') {
          const item: ChatItem = { roomId, kind: 'chat', playerId: msg.playerId, name: msg.name ?? 'user', color: msg.color ?? '#999', text: msg.text ?? '', t: msg.t ?? Date.now() }
          idbPutMany([item]).catch(()=>{})
          const cm: ChatMsg = { kind: 'chat', playerId: item.playerId, name: item.name, color: item.color, text: item.text, t: item.t }
          setMessages((m) => [...m.slice(-199), cm])
        }
        if (msg.type === 'join') {
          upsertPlayer({ id: msg.playerId, x: playersRef.current.get(msg.playerId)?.x ?? 400, y: playersRef.current.get(msg.playerId)?.y ?? 300, name: msg.name ?? `user-${String(msg.playerId).slice(0,6)}`, color: msg.color ?? '#999' })
          enqueueSystem('join', msg.name || `user-${String(msg.playerId).slice(0,6)}`)
        }
        if (msg.type === 'leave') {
          updatePlayers((m)=>{ m.delete(msg.playerId) })
          const nextT = new Map(targetsRef.current)
          nextT.delete(msg.playerId)
          targetsRef.current = nextT
          enqueueSystem('leave', msg.name || `user-${String(msg.playerId).slice(0,6)}`)
        }
      } catch {}
    }
    ws.onclose = () => { if (animRef.current) cancelAnimationFrame(animRef.current); animRef.current = undefined }
    ws.onerror = () => {}
  try { localStorage.setItem('room_id', roomId) } catch {}
    startLoop()
  }

  function normalizeWsBase(input: string): string {
    const raw = (input || '').trim()
    const noTrail = raw.replace(/\/$/, '')
    if (/^wss?:\/\//i.test(noTrail)) return noTrail
    if (/^https?:\/\//i.test(noTrail)) return noTrail.replace(/^http/i, 'ws')
    return `wss://${noTrail}`
  }

  function say(){
    const ws = wsRef.current
    if (!ws) return
    const text = chat.trim()
    if (!text) return
    ws.send(JSON.stringify({ type:'say', text }))
    setChat('')
    // 不做乐观落地，等待服务器回传 chat 再写入，避免时间戳不一致导致的重复
  }

  function leaveRoom(){
    // Notify server explicitly then close WS
    try { wsRef.current?.send(JSON.stringify({ type: 'leave' })) } catch {}
    if (wsRef.current) { try { wsRef.current.close() } catch {}; wsRef.current = null }
    // Stop animation loop
    if (animRef.current) { cancelAnimationFrame(animRef.current); animRef.current = undefined }
    // Clear refs and states
    targetsRef.current = new Map()
    playersRef.current = new Map()
    selfIdRef.current = ''
    keysRef.current = {}
    mouseRef.current = {x:0,y:0}
    setPlayers(new Map())
    setSelfId('')
    // 清空 canvas
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d')
      if (ctx) ctx.clearRect(0,0,canvasRef.current.width,canvasRef.current.height)
    }
    // Add a local system message
    setMessages((m)=>[...m.slice(-199), { kind:'system', text:'你已离开房间', t: Date.now() }])
  }

  function upsertPlayer(p: Player){ updatePlayers((m)=>{ m.set(p.id, p) }) }

  function updatePlayers(mutator: (m: Map<string, Player>)=>void){
    const next = new Map(playersRef.current)
    mutator(next)
    playersRef.current = next
    setPlayers(next)
  }

  function ensureSelf(){
    const id = selfIdRef.current || 'self'
    if (!playersRef.current.has(id)) {
      updatePlayers((m)=>{ m.set(id, { id, x: 400, y: 300, name: userEmail || id, color: '#888' }) })
    }
  }

  function startLoop(){
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const W = (canvas.width = worldRef.current.w)
    const H = (canvas.height = worldRef.current.h)
    const speed = 180
    const remoteLerpK = 10
    let last = performance.now()

    function step(now: number){
      const dt = Math.min(0.05, (now - last)/1000)
      last = now

  // local player movement (only when page active and not typing)
  if (selfIdRef.current && canMove()) {
        const p = playersRef.current.get(selfIdRef.current)
        if (p) {
          let vx = 0, vy = 0
          if (keysRef.current['KeyW']) vy -= 1
          if (keysRef.current['KeyS']) vy += 1
          if (keysRef.current['KeyA']) vx -= 1
          if (keysRef.current['KeyD']) vx += 1
          if (vx || vy) {
            const len = Math.hypot(vx, vy) || 1
            const nx = p.x + (vx/len) * speed * dt
            const ny = p.y + (vy/len) * speed * dt
            const nxc = clamp(nx, 10, W-10), nyc = clamp(ny, 10, H-10)
            if (Math.abs(nxc - p.x) > 0.5 || Math.abs(nyc - p.y) > 0.5) {
              const updated = { ...p, x: nxc, y: nyc }
              updatePlayers((m)=>{ m.set(p.id, updated) })
              const nowMs = performance.now()
              if (nowMs - lastSendRef.current > 50) {
                lastSendRef.current = nowMs
                wsRef.current?.send(JSON.stringify({ type:'move', x: nxc, y: nyc, t: Date.now() }))
              }
            }
          }
        }
      }

      // smooth remote players toward targets
      if (targetsRef.current.size) {
        const alpha = 1 - Math.exp(-remoteLerpK * dt)
        const nextMap = new Map(playersRef.current)
        let changed = false
        for (const [id, target] of targetsRef.current) {
          if (id === selfIdRef.current) continue
          const p = nextMap.get(id)
          if (!p) continue
          const nx = p.x + (target.x - p.x) * alpha
          const ny = p.y + (target.y - p.y) * alpha
          if (Math.abs(nx - p.x) > 0.01 || Math.abs(ny - p.y) > 0.01) {
            nextMap.set(id, { ...p, x: nx, y: ny })
            changed = true
          }
        }
        if (changed) { playersRef.current = nextMap; setPlayers(nextMap) }
      }

      // draw
      ctx.clearRect(0,0,W,H)
      drawGrid(ctx, W, H)
      const hover = mouseRef.current
      let hoverId: string | null = null
      for (const p of playersRef.current.values()){
        const r = 8
        ctx.beginPath()
        ctx.arc(p.x, p.y, r, 0, Math.PI*2)
        ctx.fillStyle = p.color
        ctx.fill()
        if (distance(hover.x, hover.y, p.x, p.y) <= r+4){ hoverId = p.id }
      }
      if (hoverId){
        const p = playersRef.current.get(hoverId)!
        drawLabel(ctx, maskEmailForDisplay(p.name), p.x, p.y - 14)
      }

      animRef.current = requestAnimationFrame(step)
    }

    animRef.current = requestAnimationFrame(step)
  }

  // global listeners: keyboard (WASD), pointer, focus/visibility gating
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { keysRef.current[e.code] = e.type === 'keydown' }
    const onMouse = (e: MouseEvent) => {
      const rect = canvasRef.current?.getBoundingClientRect()
      if (!rect) return
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      const W = worldRef.current.w
      const H = worldRef.current.h
      const nx = (x / rect.width) * W
      const ny = (y / rect.height) * H
      mouseRef.current = { x: nx, y: ny }
    }
    const onWinFocus = () => { windowFocusedRef.current = true }
    const onWinBlur = () => { windowFocusedRef.current = false }
    const onVis = () => { pageVisibleRef.current = document.visibilityState === 'visible' }
    const onFocusIn = () => { inputFocusedRef.current = isEditableElement(document.activeElement) }
    const onFocusOut = () => { inputFocusedRef.current = isEditableElement(document.activeElement) }

    window.addEventListener('keydown', onKey)
    window.addEventListener('keyup', onKey)
    window.addEventListener('mousemove', onMouse)
    window.addEventListener('focus', onWinFocus)
    window.addEventListener('blur', onWinBlur)
    document.addEventListener('visibilitychange', onVis)
    document.addEventListener('focusin', onFocusIn)
    document.addEventListener('focusout', onFocusOut)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('keyup', onKey)
      window.removeEventListener('mousemove', onMouse)
      window.removeEventListener('focus', onWinFocus)
      window.removeEventListener('blur', onWinBlur)
      document.removeEventListener('visibilitychange', onVis)
      document.removeEventListener('focusin', onFocusIn)
      document.removeEventListener('focusout', onFocusOut)
      if (animRef.current) cancelAnimationFrame(animRef.current)
    }
  }, [])

  function drawGrid(ctx: CanvasRenderingContext2D, W:number, H:number){
    ctx.save()
    ctx.strokeStyle = 'rgba(255,255,255,0.06)'
    ctx.lineWidth = 1
    for(let x=0; x<=W; x+=40){ ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke() }
    for(let y=0; y<=H; y+=40){ ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke() }
    ctx.restore()
  }

  function drawLabel(ctx: CanvasRenderingContext2D, text:string, x:number, y:number){
    ctx.save()
    ctx.font = '12px system-ui, sans-serif'
    const pad = 4
    const w = ctx.measureText(text).width + pad*2
    const h = 16
    ctx.fillStyle = 'rgba(0,0,0,0.6)'
    ctx.fillRect(x-w/2, y-h, w, h)
    ctx.fillStyle = 'white'
    ctx.fillText(text, x-w/2+pad, y-4)
    ctx.restore()
  }

  function clamp(v:number, min:number, max:number){ return Math.max(min, Math.min(max, v)) }
  function distance(x1:number,y1:number,x2:number,y2:number){ const dx=x1-x2, dy=y1-y2; return Math.hypot(dx,dy) }

  return (
    <div className="p-0">
      <BackBar />
      <div className="p-4 grid gap-3 md:grid-cols-[1fr_320px]">
        <div className="space-y-3">
          <div className="text-sm text-muted-foreground">当前用户：{userEmail ? maskEmailForDisplay(userEmail) : '未登录'}</div>
          {wsEnvError && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm">
              <div className="font-medium mb-1">需要配置 WebSocket 服务地址</div>
              <div className="text-muted-foreground">{wsEnvError}</div>
              <div className="mt-2 text-xs text-muted-foreground">
                示例：
                <pre className="mt-1 rounded bg-background p-2 overflow-auto">{`VITE_WEBSOCKET_URL=wss://example.com/ws`}</pre>
              </div>
            </div>
          )}
          {/* 环境变量已提供时展示当前地址以便确认 */}
          {baseUrl && (
            <div className="text-xs text-muted-foreground">WS: {baseUrl}</div>
          )}
          <div className="flex gap-2">
            <Input placeholder="room id" value={roomId} onChange={e=>setRoomId(e.target.value)} />
            <Button onClick={connect} disabled={!baseUrl || !!wsRef.current}>连接</Button>
            <Button variant="destructive" onClick={leaveRoom}>离开房间</Button>
          </div>
          {/* Self color indicator */}
          <div className="text-sm flex items-center gap-2">
            <span>你的角色：</span>
            {(() => {
              const selfP =
                players.get(selfId) ||
                players.get('self') ||
                playersRef.current.get(selfIdRef.current) ||
                playersRef.current.get('self')
              const name = maskEmailForDisplay(selfP?.name || (selfId ? `user-${String(selfId).slice(0,6)}` : ''))
              return (
                <span className="inline-flex items-center gap-2">
                  <span className="inline-block h-3 w-3 rounded-full border" style={{ background: selfP?.color || '#888' }} title={name} />
                  <span className="text-muted-foreground">{name || '准备中…'}</span>
                </span>
              )
            })()}
          </div>
          {/* Aspect-ratio container 4:3 */}
          <div className="relative w-full aspect-[4/3] rounded border bg-background overflow-hidden">
            <canvas
              ref={canvasRef}
              className="absolute inset-0 w-full h-full"
            />
          </div>
        </div>
        <div className="flex h-[640px] flex-col gap-2">
          <div className="text-sm font-medium">玩家</div>
          <div className="rounded border p-2 text-sm max-h-56 overflow-auto space-y-1">
            {Array.from(players.values()).map(p => (
              <div key={p.id} className="flex items-center gap-2">
                <span className="inline-block h-3 w-3 rounded-full border" style={{ background: p.color }} />
                <span>{maskEmailForDisplay(p.name)}</span>
                {p.id === selfId && <span className="text-muted-foreground">(你)</span>}
              </div>
            ))}
            {players.size === 0 && <div className="text-muted-foreground">暂无玩家</div>}
          </div>
          <div className="text-sm font-medium">聊天</div>
          <div className="flex-1 overflow-auto rounded border p-2 text-sm space-y-1">
            {messages.map((m,i)=> (
              <div key={i} className="leading-5">
                {m.kind === 'system' ? (
                  <div className="text-muted-foreground">[{new Date(m.t).toLocaleTimeString()}] {maskEmailsInText(m.text)}</div>
                ) : (
                  <>
                    <span className="mr-2" style={{ color: m.color }}>{maskEmailForDisplay(m.name || 'user')}</span>
                    <span className="text-muted-foreground">{new Date(m.t).toLocaleTimeString()}</span>
                    <div>{maskEmailsInText(m.text || '')}</div>
                  </>
                )}
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <Input placeholder="输入聊天内容，回车发送" value={chat} onChange={(e)=>setChat(e.target.value)} onKeyDown={(e)=>{ if(e.key==='Enter'){ e.preventDefault(); say() } }} />
            <Button onClick={say}>发送</Button>
          </div>
        </div>
      </div>
    </div>
  )
}
