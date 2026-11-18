import { create } from "zustand"
import type { Tokens, User } from "@/lib/api/types"

type AuthStatus = "loading" | "authenticated" | "guest"

interface AuthState {
  status: AuthStatus
  user: User | null
  /** Kept in memory only; the refresh token lives in an HttpOnly cookie. */
  accessToken: string | null
  expiresAt: number
  setSession: (tokens: Tokens) => void
  setUser: (user: User) => void
  clearSession: () => void
}

// Non-secret hint that a refresh cookie probably exists, so guests skip the
// rate-limited refresh call on every page load.
const SESSION_HINT = "restaurant-space:has-session"

export const sessionHint = {
  get: () => {
    try {
      return localStorage.getItem(SESSION_HINT) === "1"
    } catch {
      return true
    }
  },
  set: (on: boolean) => {
    try {
      if (on) localStorage.setItem(SESSION_HINT, "1")
      else localStorage.removeItem(SESSION_HINT)
    } catch {}
  },
}

export const useAuthStore = create<AuthState>((set) => ({
  status: "loading",
  user: null,
  accessToken: null,
  expiresAt: 0,
  setSession: (tokens) => {
    sessionHint.set(true)
    set({
      status: "authenticated",
      user: tokens.user,
      accessToken: tokens.access_token,
      expiresAt: Date.now() + tokens.expires_in * 1000,
    })
  },
  setUser: (user) => set({ user }),
  clearSession: () => set({ status: "guest", user: null, accessToken: null, expiresAt: 0 }),
}))
