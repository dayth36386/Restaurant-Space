import { API_BASE } from "@/lib/config"
import { sessionHint, useAuthStore } from "@/stores/auth-store"
import type { ApiErrorBody, Tokens } from "./types"

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message)
    this.name = "ApiError"
  }
}

type Query = Record<string, string | number | boolean | undefined | null>

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE"
  body?: unknown
  form?: FormData
  query?: Query
  /** Skip attaching the bearer token (auth endpoints). */
  anonymous?: boolean
  signal?: AbortSignal
}

const REFRESH_LEEWAY_MS = 30_000

let refreshing: Promise<Tokens | null> | null = null

/**
 * Rotate the refresh cookie. The backend treats concurrent use of one refresh
 * token as replay and revokes the session family, so every caller shares one
 * in-flight request, and a Web Lock serializes refreshes across tabs.
 */
export function refreshSession(): Promise<Tokens | null> {
  if (!sessionHint.get()) {
    useAuthStore.getState().clearSession()
    return Promise.resolve(null)
  }
  if (!refreshing) {
    refreshing = runRefresh().finally(() => {
      refreshing = null
    })
  }
  return refreshing
}

async function runRefresh(): Promise<Tokens | null> {
  const call = async () => {
    try {
      const res = await fetch(`${API_BASE}/auth/refresh`, { method: "POST", credentials: "include" })
      if (res.ok) return (await res.json()) as Tokens
      // Only a 401 proves the session is gone; keep the hint on 429/5xx so the next load retries.
      if (res.status === 401) sessionHint.set(false)
      return null
    } catch {
      return null
    }
  }
  const tokens =
    typeof navigator !== "undefined" && navigator.locks ? await navigator.locks.request("restaurant-space:refresh", call) : await call()
  const store = useAuthStore.getState()
  if (tokens) store.setSession(tokens)
  else store.clearSession()
  return tokens
}

function buildUrl(path: string, query?: Query) {
  const url = new URL(`${API_BASE}${path}`)
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, String(value))
    }
  }
  return url.toString()
}

async function send(path: string, opts: RequestOptions, token: string | null) {
  const headers: Record<string, string> = {}
  if (token) headers.Authorization = `Bearer ${token}`
  let body: BodyInit | undefined
  if (opts.form) body = opts.form
  else if (opts.body !== undefined) {
    headers["Content-Type"] = "application/json"
    body = JSON.stringify(opts.body)
  }
  return fetch(buildUrl(path, opts.query), {
    method: opts.method ?? "GET",
    headers,
    body,
    credentials: "include",
    signal: opts.signal,
  })
}

async function toError(res: Response) {
  try {
    const data = (await res.json()) as ApiErrorBody
    return new ApiError(res.status, data.error.code, data.error.message)
  } catch {
    return new ApiError(res.status, "HTTP_ERROR", res.statusText)
  }
}

export async function api<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  let token: string | null = null
  if (!opts.anonymous) {
    const { accessToken, expiresAt } = useAuthStore.getState()
    token = accessToken
    if (token && expiresAt - Date.now() < REFRESH_LEEWAY_MS) {
      token = (await refreshSession())?.access_token ?? null
    }
  }

  let res = await send(path, opts, token)
  // Any endpoint rejects a stale bearer token, even public ones: refresh once,
  // then retry (anonymously if the session is gone).
  if (res.status === 401 && token) {
    const fresh = await refreshSession()
    res = await send(path, opts, fresh?.access_token ?? null)
  }

  if (!res.ok) throw await toError(res)
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}
