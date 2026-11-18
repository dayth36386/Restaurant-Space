"use client"

import { useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { qk } from "@/hooks/queries"
import { chatApi } from "@/lib/api/endpoints"
import { errorMessage } from "@/lib/i18n"
import { useAuthStore } from "@/stores/auth-store"

/** Open (or reuse) the direct conversation with a user and navigate to it. */
export function useStartChat() {
  const router = useRouter()
  const pathname = usePathname()
  const qc = useQueryClient()
  const [busy, setBusy] = useState(false)

  const start = async (userId: string) => {
    if (useAuthStore.getState().status !== "authenticated") {
      router.push(`/login?next=${encodeURIComponent(pathname)}`)
      return
    }
    setBusy(true)
    try {
      const conversation = await chatApi.start({ user_id: userId })
      qc.setQueryData(qk.conversation(conversation.id), conversation)
      void qc.invalidateQueries({ queryKey: qk.conversations })
      router.push(`/chat/${conversation.id}`)
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }
  return { start, busy }
}
