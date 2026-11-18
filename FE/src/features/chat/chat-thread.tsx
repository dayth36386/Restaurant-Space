"use client"

import Link from "next/link"
import { Fragment, useEffect, useRef, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { ArrowLeft, ImageOff, Loader2, MapPin, SendHorizontal, Store, WifiOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { PresenceAvatar, useIsOnline } from "@/features/chat/conversation-list"
import { applyIncoming, applyRead, upsertMessage, type LocalMessage } from "@/features/chat/cache"
import { ShareRestaurantDialog } from "@/features/chat/share-restaurant-dialog"
import { useConversation, useMessages } from "@/hooks/queries"
import { chatApi } from "@/lib/api/endpoints"
import type { ChatMessage, RestaurantCard } from "@/lib/api/types"
import { errorMessage, formatClock, formatPrice, t } from "@/lib/i18n"
import { newClientId, realtime, useRealtimeStore } from "@/lib/realtime"
import { cn } from "@/lib/utils"
import { useAuthStore } from "@/stores/auth-store"

const c = t.chat

const dayKey = (iso: string) => new Date(iso).toDateString()
function dayLabel(iso: string) {
  const d = new Date(iso)
  const today = new Date()
  const yesterday = new Date(today.getTime() - 86_400_000)
  if (d.toDateString() === today.toDateString()) return "วันนี้"
  if (d.toDateString() === yesterday.toDateString()) return "เมื่อวาน"
  return new Intl.DateTimeFormat("th-TH", { weekday: "short", day: "numeric", month: "short" }).format(d)
}
const MAX = 4000
const TYPING_EVERY_MS = 3_000
const TYPING_IDLE_MS = 4_000

function RestaurantBubble({ card }: { card: RestaurantCard | null }) {
  if (!card) return <p className="text-sm text-muted-foreground italic">{c.restaurantUnavailable}</p>
  const r = card.restaurant
  return (
    <Link href={`/restaurants/${r.id}`} className="grid w-60 overflow-hidden rounded-lg border bg-card text-foreground hover:shadow-sm">
      <span className="flex aspect-[16/9] items-center justify-center bg-sage text-primary/50">
        {card.cover_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={card.cover_url} alt="" className="size-full object-cover" />
        ) : (
          <ImageOff className="size-5" />
        )}
      </span>
      <span className="grid gap-0.5 p-3">
        <span className="truncate text-sm font-semibold">{r.name}</span>
        {r.address && (
          <span className="flex items-center gap-1 truncate text-xs text-muted-foreground">
            <MapPin className="size-3 shrink-0" /> {r.address}
          </span>
        )}
        {formatPrice(r.price_min, r.price_max) && <span className="text-xs font-medium">{formatPrice(r.price_min, r.price_max)}</span>}
      </span>
    </Link>
  )
}

function useTypingUsers(conversationId: string) {
  const typing = useRealtimeStore((s) => s.typing[conversationId])
  const [now, setNow] = useState(() => Date.now())
  const active = Object.values(typing ?? {}).some((until) => until > now)
  // Re-render while someone is typing so the indicator expires on its own.
  useEffect(() => {
    if (!typing || Object.keys(typing).length === 0) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [typing])
  return active
}

export function ChatThread({ id }: { id: string }) {
  const qc = useQueryClient()
  const me = useAuthStore((s) => s.user?.id)
  const conversation = useConversation(id)
  const messages = useMessages(id)
  const connected = useRealtimeStore((s) => s.connected)
  const other = conversation.data?.other_user
  const online = useIsOnline(other?.id, other?.online)
  const typing = useTypingUsers(id)
  const [text, setText] = useState("")
  const [sharing, setSharing] = useState(false)
  const lastTyping = useRef(0)
  const stopTyping = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastRead = useRef<string | null>(null)
  const scroller = useRef<HTMLDivElement>(null)
  const sentinel = useRef<HTMLDivElement>(null)

  const items: LocalMessage[] = messages.data?.pages.flatMap((p) => p.items) ?? []
  const newestFromOther = items.find((m) => m.sender_id !== me && !m.status)

  useEffect(() => {
    useRealtimeStore.setState({ activeConversation: id })
    return () => useRealtimeStore.setState({ activeConversation: null })
  }, [id])

  // Mark the newest incoming message read while the thread is on screen.
  useEffect(() => {
    const mark = () => {
      if (!newestFromOther || !me || document.visibilityState !== "visible" || lastRead.current === newestFromOther.id) return
      lastRead.current = newestFromOther.id
      const body = { conversation_id: id, message_id: newestFromOther.id }
      if (realtime.isOpen()) realtime.send("message:read", body)
      else void chatApi.read(id, newestFromOther.id).catch(() => (lastRead.current = null))
      applyRead(qc, { ...body, user_id: me }, me)
    }
    mark()
    document.addEventListener("visibilitychange", mark)
    return () => document.removeEventListener("visibilitychange", mark)
  }, [newestFromOther, id, me, qc])

  // The list is column-reversed, so the sentinel at the end sits at the visual top.
  useEffect(() => {
    const el = sentinel.current
    if (!el || !messages.hasNextPage) return
    const observer = new IntersectionObserver(
      ([entry]) => entry.isIntersecting && !messages.isFetchingNextPage && void messages.fetchNextPage(),
      {
        root: scroller.current,
        rootMargin: "200px",
      },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [messages])

  const emitTyping = () => {
    if (Date.now() - lastTyping.current > TYPING_EVERY_MS) {
      realtime.send("typing:start", { conversation_id: id })
      lastTyping.current = Date.now()
    }
    if (stopTyping.current) clearTimeout(stopTyping.current)
    stopTyping.current = setTimeout(() => {
      realtime.send("typing:stop", { conversation_id: id })
      lastTyping.current = 0
    }, TYPING_IDLE_MS)
  }

  const deliver = async (local: LocalMessage, body: { content?: string; restaurant_id?: string }) => {
    upsertMessage(qc, { ...local, status: "pending" })
    scroller.current?.scrollTo({ top: 0 })
    const payload = { client_message_id: local.client_message_id, ...body }
    try {
      // The same client_message_id makes socket retries and the HTTP fallback idempotent.
      const msg = realtime.isOpen()
        ? await realtime.request<ChatMessage>("message:send", { conversation_id: id, ...payload }).catch(() => chatApi.send(id, payload))
        : await chatApi.send(id, payload)
      applyIncoming(qc, msg, me, true)
    } catch (e) {
      upsertMessage(qc, { ...local, status: "failed" })
      console.warn("send failed", errorMessage(e))
    }
  }

  const send = (body: { content?: string; restaurant_id?: string }, card?: RestaurantCard) => {
    if (!me) return
    const cid = newClientId()
    const local: LocalMessage = {
      id: `local-${cid}`,
      conversation_id: id,
      sender_id: me,
      client_message_id: cid,
      kind: body.restaurant_id ? "RESTAURANT" : "TEXT",
      content: body.content ?? null,
      restaurant: card ?? null,
      created_at: new Date().toISOString(),
    }
    void deliver(local, body)
  }

  const retry = (m: LocalMessage) =>
    void deliver(m, m.kind === "TEXT" ? { content: m.content ?? "" } : { restaurant_id: m.restaurant?.restaurant.id })

  const submit = () => {
    const content = text.trim()
    if (!content) return
    setText("")
    if (stopTyping.current) clearTimeout(stopTyping.current)
    if (lastTyping.current) realtime.send("typing:stop", { conversation_id: id })
    lastTyping.current = 0
    send({ content })
  }

  if (conversation.isError) {
    return (
      <div className="flex flex-1 items-center justify-center rounded-3xl border bg-card text-sm text-muted-foreground shadow-sm">
        {c.notFound}
      </div>
    )
  }

  // Receipt: the other member has read everything up to other_last_read_message_id.
  const readIndex = conversation.data?.other_last_read_message_id
    ? items.findIndex((m) => m.id === conversation.data!.other_last_read_message_id)
    : -1
  const myNewest = items.findIndex((m) => m.sender_id === me)

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden rounded-3xl border bg-card shadow-sm">
      <header className="flex items-center gap-3 border-b px-5 py-3.5">
        <Link href="/chat" className="-ml-1 rounded-md p-1 text-muted-foreground hover:text-foreground md:hidden" aria-label={c.back}>
          <ArrowLeft className="size-5" />
        </Link>
        {other ? (
          <Link href={`/profile/${other.username}`} className="flex min-w-0 items-center gap-3">
            <PresenceAvatar user={other} className="size-9" />
            <span className="grid min-w-0">
              <span className="truncate text-sm font-semibold">{other.display_name}</span>
              <span className={cn("text-xs text-muted-foreground", (typing || online) && "text-primary")}>
                {typing ? c.typing : online ? c.online : `@${other.username}`}
              </span>
            </span>
          </Link>
        ) : (
          <Loader2 className="size-4 animate-spin text-muted-foreground" />
        )}
        {!connected && (
          <span className="ml-auto flex items-center gap-1 text-xs text-muted-foreground" title={c.reconnecting}>
            <WifiOff className="size-3.5" /> <span className="hidden sm:inline">{c.reconnecting}</span>
          </span>
        )}
      </header>

      <div
        ref={scroller}
        className="flex min-h-0 flex-1 flex-col-reverse gap-1 overflow-y-auto bg-[radial-gradient(circle_at_1px_1px,color-mix(in_oklab,var(--border)_70%,transparent)_1px,transparent_0)] [background-size:18px_18px] px-5 py-4"
      >
        {messages.isPending ? (
          <div className="flex flex-1 items-center justify-center text-muted-foreground">
            <Loader2 className="size-5 animate-spin" />
          </div>
        ) : (
          items.map((m, i) => {
            const mine = m.sender_id === me
            const older = items[i + 1]
            const newer = items[i - 1]
            const newDay = !older || dayKey(older.created_at) !== dayKey(m.created_at)
            const startsGroup = newDay || older.sender_id !== m.sender_id
            // Show the time once, under the last bubble of a run from the same sender.
            const endsGroup =
              !newer || newer.sender_id !== m.sender_id || dayKey(newer.created_at) !== dayKey(m.created_at) || m.status !== undefined
            return (
              <Fragment key={m.id}>
                <div className={cn("flex flex-col", mine ? "items-end" : "items-start", startsGroup && "mt-3")}>
                  <button
                    type="button"
                    disabled={m.status !== "failed"}
                    onClick={() => retry(m)}
                    className={cn("max-w-[78%] text-left disabled:cursor-auto", m.status === "pending" && "opacity-60")}
                  >
                    {m.kind === "RESTAURANT" ? (
                      <div className="grid gap-1">
                        <RestaurantBubble card={m.restaurant} />
                      </div>
                    ) : (
                      <p
                        className={cn(
                          "rounded-[1.25rem] px-4 py-2.5 text-[15px] leading-relaxed break-words whitespace-pre-wrap",
                          mine
                            ? "rounded-br-md bg-gradient-to-br from-primary to-primary-2 text-primary-foreground shadow-sm shadow-primary/20"
                            : "rounded-bl-md bg-sage text-foreground",
                          m.status === "failed" && "ring-2 ring-destructive",
                        )}
                      >
                        {m.content}
                      </p>
                    )}
                  </button>
                  {endsGroup && (
                    <span className="mt-1 px-1 text-[11px] text-muted-foreground">
                      {m.status === "pending" ? (
                        c.sending
                      ) : m.status === "failed" ? (
                        <span className="text-destructive">{c.failed}</span>
                      ) : (
                        <>
                          {formatClock(m.created_at)}
                          {mine && i === myNewest && ` · ${readIndex !== -1 && i >= readIndex ? c.read : c.sent}`}
                        </>
                      )}
                    </span>
                  )}
                </div>
                {/* Column is reversed: rendering after the bubble places the divider above it. */}
                {newDay && (
                  <div className="my-3 flex items-center gap-3 text-[11px] font-medium text-muted-foreground">
                    <span className="h-px flex-1 bg-border" />
                    {dayLabel(m.created_at)}
                    <span className="h-px flex-1 bg-border" />
                  </div>
                )}
              </Fragment>
            )
          })
        )}
        <div ref={sentinel} className="flex justify-center py-2">
          {messages.isFetchingNextPage && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
        </div>
      </div>

      <form
        className="flex items-end gap-2 border-t bg-card p-3"
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        <Button
          type="button"
          variant="ghost"
          size="icon-lg"
          className="size-11 rounded-full"
          onClick={() => setSharing(true)}
          aria-label={c.shareRestaurant}
          title={c.shareRestaurant}
        >
          <Store />
        </Button>
        <Textarea
          value={text}
          onChange={(e) => {
            setText(e.target.value.slice(0, MAX))
            if (e.target.value) emitTyping()
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault()
              submit()
            }
          }}
          placeholder={c.placeholder}
          rows={1}
          className="max-h-32 min-h-11 resize-none rounded-[1.4rem] px-4 py-3"
          aria-label={c.placeholder}
        />
        <Button type="submit" size="icon-lg" className="size-11 rounded-full" disabled={!text.trim()} aria-label={c.send}>
          <SendHorizontal />
        </Button>
      </form>
      <ShareRestaurantDialog
        open={sharing}
        onOpenChange={setSharing}
        onPick={(card) => send({ restaurant_id: card.restaurant.id }, card)}
      />
    </div>
  )
}
