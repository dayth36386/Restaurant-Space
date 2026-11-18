"use client"

import { useEffect, useState } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ThemeProvider } from "next-themes"
import { Toaster } from "@/components/ui/sonner"
import { RealtimeBridge } from "@/features/chat/realtime-bridge"
import { ApiError, refreshSession } from "@/lib/api/client"

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        retry: (count, error) => !(error instanceof ApiError && error.status < 500) && count < 2,
      },
    },
  })
}

let bootstrapped = false

/** Restore the session from the HttpOnly refresh cookie once per page load. */
function SessionBootstrap() {
  useEffect(() => {
    if (bootstrapped) return
    bootstrapped = true
    void refreshSession()
  }, [])
  return null
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(makeQueryClient)
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <QueryClientProvider client={client}>
        <SessionBootstrap />
        <RealtimeBridge />
        {children}
        <Toaster richColors position="top-center" />
      </QueryClientProvider>
    </ThemeProvider>
  )
}
