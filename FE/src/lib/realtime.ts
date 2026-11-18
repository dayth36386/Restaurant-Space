import { create } from "zustand"
import { ApiError, refreshSession } from "@/lib/api/client"
import { API_BASE } from "@/lib/config"
import { useAuthStore } from "@/stores/auth-store"

// Client for the API's WebSocket (contract: BE/docs/realtime.md). It authenticates
// with the first frame, re-sends auth whenever the access token rotates, and
// reconnects with backoff. History is always reloaded over HTTP after reconnecting.

export interface RealtimeEvent<T = unknown> {
  type: string
  ref?: string
  data?: T
  error?: { code: string; message: string }
}

type Handler = (data: never, event: RealtimeEvent) => void

const WS_URL = `${API_BASE.replace(/^http/, "ws")}/ws`
const CLOSE_UNAUTHORIZED = 4001
const REQUEST_TIMEOUT_MS = 8_000
const TYPING_TTL_MS = 6_000

interface RealtimeState {
  connected: boolean
  online: Record<string, boolean>
  /** conversationId -> typing user -> expiry timestamp */
  typing: Record<string, Record<string, number>>
  /** Conversation currently on screen, so its messages are not counted as unread. */
  activeConversation: string | null
}

export const useRealtimeStore = create<RealtimeState>(() => ({ connected: false, online: {}, typing: {}, activeConversation: null }))

class RealtimeClient {
  private ws: WebSocket | null = null
  private wanted = false
  private attempt = 0
  private seq = 0
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private handlers = new Map<string, Set<Handler>>()
  private pending = new Map<
    string,
    { resolve: (e: RealtimeEvent) => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout> }
  >()
  private sentToken: string | null = null

  constructor() {
    if (typeof window === "undefined") return
    // Re-authenticate the open socket whenever the access token rotates.
    useAuthStore.subscribe((state) => {
      if (state.accessToken && state.accessToken !== this.sentToken && this.isOpen()) this.authenticate(state.accessToken)
    })
  }

  connect() {
    this.wanted = true
    if (!this.ws) this.open()
  }

  disconnect() {
    this.wanted = false
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    this.ws?.close(1000)
    this.ws = null
    useRealtimeStore.setState({ connected: false, online: {}, typing: {} })
  }

  isOpen() {
    return this.ws?.readyState === WebSocket.OPEN && useRealtimeStore.getState().connected
  }

  on<T>(type: string, handler: (data: T, event: RealtimeEvent<T>) => void): () => void {
    const set = this.handlers.get(type) ?? new Set()
    set.add(handler as Handler)
    this.handlers.set(type, set)
    return () => set.delete(handler as Handler)
  }

  /** Fire-and-forget event (typing, read). Dropped when offline. */
  send(type: string, data?: unknown) {
    if (this.isOpen()) this.ws!.send(JSON.stringify({ type, data }))
  }

  /** Event that expects a direct reply (ack or error) carrying the same ref. */
  request<T>(type: string, data: unknown): Promise<T> {
    if (!this.isOpen()) return Promise.reject(new Error("socket not connected"))
    const ref = `r${++this.seq}`
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(ref)
        reject(new Error("socket request timed out"))
      }, REQUEST_TIMEOUT_MS)
      this.pending.set(ref, { resolve: (e) => resolve(e.data as T), reject, timer })
      this.ws!.send(JSON.stringify({ type, ref, data }))
    })
  }

  private authenticate(token: string) {
    this.sentToken = token
    this.ws?.send(JSON.stringify({ type: "auth", ref: `auth${++this.seq}`, data: { token } }))
  }

  private open() {
    const token = useAuthStore.getState().accessToken
    if (!token) return
    const ws = new WebSocket(WS_URL)
    this.ws = ws
    ws.onopen = () => this.authenticate(token)
    ws.onmessage = (m) => {
      let event: RealtimeEvent
      try {
        event = JSON.parse(m.data as string)
      } catch {
        return
      }
      if (event.type === "ready") {
        this.attempt = 0
        const online = Object.fromEntries(((event.data as { online_user_ids?: string[] })?.online_user_ids ?? []).map((id) => [id, true]))
        useRealtimeStore.setState({ connected: true, online })
      }
      if (event.ref && this.pending.has(event.ref)) {
        const p = this.pending.get(event.ref)!
        clearTimeout(p.timer)
        this.pending.delete(event.ref)
        if (event.type === "error") p.reject(new ApiError(0, event.error?.code ?? "ERROR", event.error?.message ?? ""))
        else p.resolve(event)
      }
      this.handlers.get(event.type)?.forEach((h) => h(event.data as never, event))
    }
    ws.onclose = (e) => {
      if (this.ws !== ws) return
      this.ws = null
      this.sentToken = null
      useRealtimeStore.setState({ connected: false, typing: {} })
      for (const p of this.pending.values()) {
        clearTimeout(p.timer)
        p.reject(new Error("socket closed"))
      }
      this.pending.clear()
      if (!this.wanted) return
      const delay = Math.min(30_000, 1_000 * 2 ** this.attempt++) * (0.75 + Math.random() / 2)
      this.reconnectTimer = setTimeout(async () => {
        // 4001: token expired or revoked; rotate before reconnecting.
        if (e.code === CLOSE_UNAUTHORIZED && !(await refreshSession())) return
        if (this.wanted && !this.ws) this.open()
      }, delay)
    }
  }
}

export const realtime = new RealtimeClient()

// Presence and typing are kept in the store so components can subscribe cheaply.
realtime.on<{ user_id: string; online: boolean }>("presence:update", ({ user_id, online }) =>
  useRealtimeStore.setState((s) => ({ online: { ...s.online, [user_id]: online } })),
)
realtime.on<{ conversation_id: string; user_id: string; typing: boolean }>("typing:update", ({ conversation_id, user_id, typing }) =>
  useRealtimeStore.setState((s) => {
    const current = { ...s.typing[conversation_id] }
    if (typing) current[user_id] = Date.now() + TYPING_TTL_MS
    else delete current[user_id]
    return { typing: { ...s.typing, [conversation_id]: current } }
  }),
)

export function newClientId(): string {
  // randomUUID only exists in secure contexts (HTTPS or localhost).
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID()
  const b = crypto.getRandomValues(new Uint8Array(16))
  b[6] = (b[6] & 0x0f) | 0x40
  b[8] = (b[8] & 0x3f) | 0x80
  const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("")
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}
