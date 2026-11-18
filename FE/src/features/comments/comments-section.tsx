"use client"

import Link from "next/link"
import { useState } from "react"
import { usePathname } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import { Loader2, MessageCircle } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { UserAvatar } from "@/components/user-avatar"
import { qk, useComments, useMyProfile } from "@/hooks/queries"
import { commentApi } from "@/lib/api/endpoints"
import type { Comment, Reply } from "@/lib/api/types"
import { errorMessage, t, timeAgo } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import { useAuthStore } from "@/stores/auth-store"

const c = t.comments
const MAX = 2000

function Composer({
  placeholder,
  submitLabel,
  initial = "",
  autoFocus,
  onSubmit,
  onCancel,
}: {
  placeholder: string
  submitLabel: string
  initial?: string
  autoFocus?: boolean
  onSubmit: (text: string) => Promise<void>
  onCancel?: () => void
}) {
  const [text, setText] = useState(initial)
  const [busy, setBusy] = useState(false)
  const trimmed = text.trim()

  const submit = async () => {
    if (!trimmed || busy) return
    setBusy(true)
    try {
      await onSubmit(trimmed)
      setText("")
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid gap-2">
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value.slice(0, MAX))}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void submit()
        }}
        placeholder={placeholder}
        rows={3}
        autoFocus={autoFocus}
        aria-label={placeholder}
      />
      <div className="flex items-center justify-end gap-2">
        {text.length > MAX - 200 && (
          <span className="mr-auto text-xs text-muted-foreground">
            {text.length}/{MAX}
          </span>
        )}
        {onCancel && (
          <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
            {t.restaurant.cancel}
          </Button>
        )}
        <Button type="button" size="sm" disabled={!trimmed || busy} onClick={() => void submit()}>
          {busy && <Loader2 className="animate-spin" />} {submitLabel}
        </Button>
      </div>
    </div>
  )
}

function CommentItem({
  item,
  restaurantId,
  canReply,
  onChanged,
  isReply,
}: {
  item: Comment | Reply
  restaurantId: string
  canReply: boolean
  onChanged: () => Promise<void>
  isReply?: boolean
}) {
  const me = useAuthStore((s) => s.user?.id)
  const [mode, setMode] = useState<"view" | "edit" | "reply">("view")
  const mine = !!item.author && item.author.id === me
  const parentId = item.parent_id ?? item.id

  if (item.deleted) {
    return <p className="py-1 text-sm text-muted-foreground italic">{c.deleted}</p>
  }

  return (
    <div className="flex gap-3">
      <Link href={`/profile/${item.author!.username}`} className="shrink-0">
        <UserAvatar name={item.author!.display_name} src={item.author!.avatar_url} className={isReply ? "size-7" : "size-9"} />
      </Link>
      <div className="grid min-w-0 flex-1 gap-1">
        <div className="flex flex-wrap items-baseline gap-x-2 text-sm">
          <Link href={`/profile/${item.author!.username}`} className="font-semibold hover:underline">
            {item.author!.display_name}
          </Link>
          <span className="text-xs text-muted-foreground">
            {timeAgo(item.created_at)}
            {item.edited && ` · ${c.edited}`}
          </span>
        </div>
        {mode === "edit" ? (
          <Composer
            placeholder={c.placeholder}
            submitLabel={c.save}
            initial={item.content ?? ""}
            autoFocus
            onCancel={() => setMode("view")}
            onSubmit={async (text) => {
              await commentApi.update(item.id, text)
              await onChanged()
              setMode("view")
            }}
          />
        ) : (
          <p className="text-sm leading-relaxed break-words whitespace-pre-line">{item.content}</p>
        )}
        {mode !== "edit" && (
          <div className="flex gap-3 text-xs text-muted-foreground">
            {canReply && (
              <button type="button" className="hover:text-foreground" onClick={() => setMode(mode === "reply" ? "view" : "reply")}>
                {c.reply}
              </button>
            )}
            {mine && (
              <>
                <button type="button" className="hover:text-foreground" onClick={() => setMode("edit")}>
                  {c.edit}
                </button>
                <ConfirmDialog
                  title={c.deleteConfirm}
                  confirmLabel={c.delete}
                  onConfirm={async () => {
                    try {
                      await commentApi.remove(item.id)
                      await onChanged()
                    } catch (e) {
                      toast.error(errorMessage(e))
                    }
                  }}
                >
                  <button type="button" className="hover:text-destructive">
                    {c.delete}
                  </button>
                </ConfirmDialog>
              </>
            )}
          </div>
        )}
        {mode === "reply" && (
          <div className="pt-1">
            <Composer
              placeholder={c.replyPlaceholder}
              submitLabel={c.sendReply}
              autoFocus
              onCancel={() => setMode("view")}
              onSubmit={async (text) => {
                await commentApi.create(restaurantId, text, parentId)
                await onChanged()
                setMode("view")
              }}
            />
          </div>
        )}
      </div>
    </div>
  )
}

export function CommentsSection({ restaurantId, isPublic }: { restaurantId: string; isPublic: boolean }) {
  const qc = useQueryClient()
  const pathname = usePathname()
  const { status, user } = useAuthStore()
  const { data: profile } = useMyProfile()
  const query = useComments(restaurantId)
  const authed = status === "authenticated"
  const items = query.data?.pages.flatMap((p) => p.items) ?? []

  const refresh = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: qk.comments(restaurantId) }),
      qc.invalidateQueries({ queryKey: qk.restaurant(restaurantId) }),
    ])
  }

  return (
    <section className="grid gap-4" id="comments">
      <div className="grid gap-0.5">
        <h2 className="text-2xl font-bold tracking-tight">{c.title}</h2>
        <p className="text-sm text-muted-foreground">{c.subtitle}</p>
      </div>

      <div className="rounded-3xl border bg-card p-5 shadow-sm md:p-6">
        {!isPublic ? (
          <p className="text-sm text-muted-foreground">{c.privateNote}</p>
        ) : authed && user ? (
          <div className="flex gap-3">
            <UserAvatar name={user.display_name} src={profile?.images.avatar_url} className="size-9" />
            <div className="flex-1">
              <Composer
                placeholder={c.placeholder}
                submitLabel={c.post}
                onSubmit={async (text) => {
                  await commentApi.create(restaurantId, text)
                  await refresh()
                }}
              />
            </div>
          </div>
        ) : (
          <Button asChild variant="outline">
            <Link href={`/login?next=${encodeURIComponent(pathname)}`}>{c.loginToComment}</Link>
          </Button>
        )}
      </div>

      {query.isPending ? (
        <div className="flex justify-center py-6 text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <div className="flex items-center gap-3 rounded-xl border border-dashed p-5 text-sm text-muted-foreground">
          <MessageCircle className="size-4" /> {c.empty}
        </div>
      ) : (
        <ul className="grid gap-3">
          {items.map((item) => (
            <li key={item.id} className="grid gap-4 rounded-3xl border bg-card p-5 md:p-6">
              <CommentItem item={item} restaurantId={restaurantId} canReply={authed && isPublic} onChanged={refresh} />
              {item.replies.length > 0 && (
                <ul className={cn("ml-6 grid gap-4 border-l-2 border-sage pl-4", item.deleted && "ml-0")}>
                  {item.replies.map((r) => (
                    <li key={r.id}>
                      <CommentItem item={r} restaurantId={restaurantId} canReply={authed && isPublic} onChanged={refresh} isReply />
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
      {query.hasNextPage && (
        <Button
          variant="outline"
          className="w-fit justify-self-center bg-card"
          disabled={query.isFetchingNextPage}
          onClick={() => void query.fetchNextPage()}
        >
          {query.isFetchingNextPage && <Loader2 className="animate-spin" />} {c.more}
        </Button>
      )}
    </section>
  )
}
