"use client"

import { useParams } from "next/navigation"
import { MessagesSquare } from "lucide-react"
import { PageHeader, pageClass } from "@/components/page-header"
import { RequireAuth } from "@/components/require-auth"
import { ChatThread } from "@/features/chat/chat-thread"
import { ConversationList } from "@/features/chat/conversation-list"
import { t } from "@/lib/i18n"
import { cn } from "@/lib/utils"

function Placeholder() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-3xl border bg-card p-8 text-center shadow-sm">
      <span className="flex size-14 items-center justify-center rounded-xl bg-sage text-primary">
        <MessagesSquare className="size-6" />
      </span>
      <p className="font-semibold">{t.chat.select}</p>
      <p className="text-sm text-muted-foreground">{t.chat.selectHint}</p>
    </div>
  )
}

/** Inbox and thread side by side on desktop; one at a time on mobile. */
function ChatShell({ activeId }: { activeId?: string }) {
  return (
    <div className={cn(pageClass, "grid gap-5 py-6 md:py-10")}>
      <div className={cn(activeId && "hidden md:block")}>
        <PageHeader title={t.chat.title} subtitle={t.chat.subtitle} />
      </div>
      <div className="grid h-[calc(100dvh-7rem)] min-h-[440px] gap-5 md:h-[calc(100dvh-15rem)] md:grid-cols-[320px_minmax(0,1fr)]">
        <aside className={cn("min-h-0", activeId && "hidden md:block")}>
          <ConversationList activeId={activeId} />
        </aside>
        <section className={cn("min-h-0 flex-col", activeId ? "flex" : "hidden md:flex")}>
          {activeId ? <ChatThread key={activeId} id={activeId} /> : <Placeholder />}
        </section>
      </div>
    </div>
  )
}

export function ChatInboxView() {
  return (
    <RequireAuth>
      <ChatShell />
    </RequireAuth>
  )
}

export function ChatConversationView() {
  const { conversationId } = useParams<{ conversationId: string }>()
  return (
    <RequireAuth>
      <ChatShell activeId={conversationId} />
    </RequireAuth>
  )
}
