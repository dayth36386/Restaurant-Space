import type { Metadata } from "next"
import { ChatInboxView } from "@/features/chat/chat-view"
import { t } from "@/lib/i18n"

export const metadata: Metadata = { title: t.chat.title }

export default function Page() {
  return <ChatInboxView />
}
