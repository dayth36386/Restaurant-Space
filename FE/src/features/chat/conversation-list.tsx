"use client"

import Link from "next/link"
import { Loader2, MessagesSquare } from "lucide-react"
import { UserAvatar } from "@/components/user-avatar"
import { useConversations } from "@/hooks/queries"
import type { Conversation } from "@/lib/api/types"
import { t, timeAgo } from "@/lib/i18n"
import { useRealtimeStore } from "@/lib/realtime"
import { cn } from "@/lib/utils"
import { useAuthStore } from "@/stores/auth-store"

export function useIsOnline(userId: string | undefined, fallback?: boolean) {
  return useRealtimeStore((s) => (userId && userId in s.online ? s.online[userId] : (fallback ?? false)))
}

export function PresenceAvatar({ user, className }: { user: Conversation["other_user"]; className?: string }) {
  const online = useIsOnline(user.id, user.online)
  return (
    <span className="relative shrink-0">
      <UserAvatar name={user.display_name} src={user.avatar_url} className={className} />
      {online && (
        <span className="absolute right-0 bottom-0 size-2.5 rounded-full border-2 border-card bg-primary" aria-label={t.chat.online} />
      )}
    </span>
  )
}

function preview(c: Conversation, me?: string) {
  const m = c.last_message
  if (!m) return ""
  const prefix = m.sender_id === me ? `${t.chat.you}: ` : ""
  if (m.kind === "RESTAURANT") return `${prefix}${t.chat.sharedRestaurant}${m.restaurant ? ` · ${m.restaurant.restaurant.name}` : ""}`
  return prefix + (m.content ?? "")
}

export function ConversationList({ activeId }: { activeId?: string }) {
  const me = useAuthStore((s) => s.user?.id)
  const { data, isPending } = useConversations()
  const items = data?.items ?? []

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-3xl border bg-card shadow-sm">
      {isPending ? (
        <div className="flex flex-1 items-center justify-center text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
          <span className="flex size-12 items-center justify-center rounded-xl bg-sage text-primary">
            <MessagesSquare className="size-5" />
          </span>
          <p className="text-sm font-semibold">{t.chat.empty}</p>
          <p className="text-xs text-muted-foreground">{t.chat.emptyHint}</p>
        </div>
      ) : (
        <ul className="min-h-0 flex-1 overflow-y-auto p-2">
          {items.map((c) => (
            <li key={c.id}>
              <Link
                href={`/chat/${c.id}`}
                className={cn(
                  "flex items-center gap-3 rounded-2xl p-3 transition-colors hover:bg-muted",
                  c.id === activeId && "bg-sage hover:bg-sage",
                )}
                aria-current={c.id === activeId ? "page" : undefined}
              >
                <PresenceAvatar user={c.other_user} className="size-10" />
                <div className="grid min-w-0 flex-1 gap-0.5">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="truncate text-sm font-semibold">{c.other_user.display_name}</p>
                    <span className="shrink-0 text-[11px] text-muted-foreground">{timeAgo(c.updated_at)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <p className={cn("truncate text-xs text-muted-foreground", c.unread_count > 0 && "font-medium text-foreground")}>
                      {preview(c, me) || `@${c.other_user.username}`}
                    </p>
                    {c.unread_count > 0 && (
                      <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground">
                        {c.unread_count > 99 ? "99+" : c.unread_count}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** Total unread across conversations, for the nav badge. */
export function UnreadBadge({ className }: { className?: string }) {
  const { data } = useConversations()
  const n = data?.items.reduce((sum, c) => sum + c.unread_count, 0) ?? 0
  if (!n) return null
  return (
    <span
      className={cn(
        "flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground",
        className,
      )}
      aria-label={`${n} ข้อความยังไม่อ่าน`}
    >
      {n > 99 ? "99+" : n}
    </span>
  )
}
