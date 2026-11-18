import type { InfiniteData, QueryClient } from "@tanstack/react-query"
import { qk } from "@/hooks/queries"
import type { ChatMessage, Conversation, ConversationList, MessageList } from "@/lib/api/types"

/** A message as shown in the thread, including not-yet-acknowledged sends. */
export type LocalMessage = ChatMessage & { status?: "pending" | "failed" }

type Pages = InfiniteData<MessageList & { items: LocalMessage[] }>

/** Insert or replace by id / client_message_id so retries and echoes never duplicate. */
export function upsertMessage(qc: QueryClient, msg: LocalMessage) {
  qc.setQueryData<Pages>(qk.messages(msg.conversation_id), (data) => {
    if (!data) return data
    let replaced = false
    const pages = data.pages.map((p) => ({
      ...p,
      items: p.items.map((m) => {
        if (m.id === msg.id || (m.client_message_id === msg.client_message_id && m.sender_id === msg.sender_id)) {
          replaced = true
          return msg
        }
        return m
      }),
    }))
    if (!replaced) pages[0] = { ...pages[0], items: [msg, ...pages[0].items] }
    return { ...data, pages }
  })
}

function patchConversation(qc: QueryClient, id: string, fn: (c: Conversation) => Conversation): boolean {
  let found = false
  qc.setQueryData<Conversation>(qk.conversation(id), (c) => (c ? fn(c) : c))
  qc.setQueryData<ConversationList>(qk.conversations, (list) => {
    if (!list) return list
    const items = list.items.map((c) => {
      if (c.id !== id) return c
      found = true
      return fn(c)
    })
    items.sort((a, b) => b.updated_at.localeCompare(a.updated_at))
    return { items }
  })
  return found
}

export function applyIncoming(qc: QueryClient, msg: ChatMessage, me: string | undefined, viewing: boolean) {
  upsertMessage(qc, msg)
  const countsUnread = msg.sender_id !== me && !viewing
  const found = patchConversation(qc, msg.conversation_id, (c) =>
    c.last_message?.id === msg.id
      ? c
      : { ...c, last_message: msg, updated_at: msg.created_at, unread_count: c.unread_count + (countsUnread ? 1 : 0) },
  )
  if (!found) void qc.invalidateQueries({ queryKey: qk.conversations })
}

export function applyRead(
  qc: QueryClient,
  update: { conversation_id: string; user_id: string; message_id: string },
  me: string | undefined,
) {
  patchConversation(qc, update.conversation_id, (c) =>
    update.user_id === me ? { ...c, unread_count: 0 } : { ...c, other_last_read_message_id: update.message_id },
  )
}
