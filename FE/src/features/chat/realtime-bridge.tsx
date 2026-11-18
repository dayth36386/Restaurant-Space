"use client"

import { useEffect } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { applyIncoming, applyRead } from "@/features/chat/cache"
import type { ChatMessage } from "@/lib/api/types"
import { realtime, useRealtimeStore } from "@/lib/realtime"
import { useAuthStore } from "@/stores/auth-store"

/** Keeps the socket open while signed in and folds live events into the query cache. */
export function RealtimeBridge() {
  const status = useAuthStore((s) => s.status)
  const qc = useQueryClient()

  useEffect(() => {
    if (status === "authenticated") realtime.connect()
    else if (status === "guest") realtime.disconnect()
  }, [status])

  useEffect(() => {
    const me = () => useAuthStore.getState().user?.id
    const offs = [
      realtime.on<ChatMessage>("message:new", (msg) => {
        const viewing = useRealtimeStore.getState().activeConversation === msg.conversation_id && document.visibilityState === "visible"
        applyIncoming(qc, msg, me(), viewing)
      }),
      realtime.on<{ conversation_id: string; user_id: string; message_id: string }>("message:read_update", (u) => applyRead(qc, u, me())),
      // After (re)connecting, reload what may have been missed while offline.
      realtime.on("ready", () => {
        void qc.invalidateQueries({ queryKey: ["conversations"] })
        void qc.invalidateQueries({ queryKey: ["messages"] })
      }),
    ]
    return () => offs.forEach((off) => off())
  }, [qc])

  return null
}
