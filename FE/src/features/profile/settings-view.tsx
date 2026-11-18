"use client"

import { useSyncExternalStore } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { useTheme } from "next-themes"
import Link from "next/link"
import { ChevronRight, LogOut, Monitor, Moon, Sun } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Chips } from "@/components/chips"
import { PageHeader, pageClass } from "@/components/page-header"
import { RequireAuth } from "@/components/require-auth"
import { useLogout } from "@/components/layout/user-menu"
import { qk } from "@/hooks/queries"
import { useUrlState } from "@/hooks/use-url-state"
import { userApi } from "@/lib/api/endpoints"
import type { UserPreferences, Visibility } from "@/lib/api/types"
import { errorMessage, t } from "@/lib/i18n"
import { type Palette, usePalette } from "@/lib/palette"
import { cn } from "@/lib/utils"
import { useAuthStore } from "@/stores/auth-store"

const s = t.settings

function Row({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="grid gap-0.5">
        <p className="text-sm font-medium">{title}</p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      {children}
    </div>
  )
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-4 rounded-3xl border bg-card p-6 shadow-sm md:p-7">
      <h2 className="font-semibold">{title}</h2>
      <div className="divide-y">{children}</div>
    </section>
  )
}

function ThemeSwitch() {
  const { theme, setTheme } = useTheme()
  // The stored theme is only known on the client; avoid a hydration mismatch.
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  )
  const options = [
    { value: "light", icon: Sun },
    { value: "dark", icon: Moon },
    { value: "system", icon: Monitor },
  ] as const
  return (
    <div className="flex gap-1 rounded-full bg-sage p-1">
      {options.map(({ value, icon: Icon }) => (
        <button
          key={value}
          type="button"
          onClick={() => setTheme(value)}
          aria-pressed={mounted && theme === value}
          className="flex items-center gap-1.5 rounded-full px-3 py-1 text-[13px] text-muted-foreground aria-pressed:bg-primary aria-pressed:font-medium aria-pressed:text-primary-foreground"
        >
          <Icon className="size-4" /> {s.themes[value]}
        </button>
      ))}
    </div>
  )
}

type Section = "preferences" | "account" | "session"

const swatches: Record<Palette, string[]> = {
  vivid: ["#ff5a36", "#ff3d81", "#ffb703", "#2ec4a6"],
  classic: ["#426b4d", "#e8b869", "#f3dfcb", "#9fd3ab"],
}

function PalettePicker() {
  const { palette, setPalette } = usePalette()
  return (
    <div className="flex gap-2" role="radiogroup" aria-label={s.palette}>
      {(Object.keys(swatches) as Palette[]).map((p) => (
        <button
          key={p}
          type="button"
          role="radio"
          aria-checked={palette === p}
          onClick={() => setPalette(p)}
          className="flex items-center gap-2 rounded-full border bg-card py-1.5 pr-3.5 pl-2 text-sm transition-all hover:bg-muted aria-checked:border-primary aria-checked:font-semibold aria-checked:ring-2 aria-checked:ring-primary/30"
        >
          <span className="flex -space-x-1.5">
            {swatches[p].map((c) => (
              <span key={c} className="size-4 rounded-full ring-2 ring-card" style={{ background: c }} />
            ))}
          </span>
          {s.palettes[p]}
        </button>
      ))}
    </div>
  )
}

function Settings() {
  const user = useAuthStore((st) => st.user)!
  const queryClient = useQueryClient()
  const logout = useLogout()
  const [{ section }, setUrl] = useUrlState(["section"] as const)
  const active: Section = section === "account" || section === "session" ? section : "preferences"
  const prefs: UserPreferences = user.preferences ?? {}

  const savePrefs = async (patch: Partial<UserPreferences>) => {
    try {
      const updated = await userApi.updateMe({ preferences: { ...prefs, ...patch } })
      useAuthStore.getState().setUser(updated.user)
      queryClient.setQueryData(qk.me, updated)
      toast.success(t.restaurant.saved)
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  const nav: { id: Section | "profile"; label: string }[] = [
    { id: "profile", label: t.nav.editProfile },
    { id: "preferences", label: s.preferences },
    { id: "account", label: s.account },
    { id: "session", label: s.session },
  ]

  return (
    <div className="grid items-start gap-5 md:grid-cols-[240px_minmax(0,1fr)]">
      <nav className="grid h-fit rounded-3xl border bg-card p-2 shadow-sm">
        {nav.map((item) =>
          item.id === "profile" ? (
            <Link
              key={item.id}
              href="/profile/edit"
              className="flex items-center justify-between rounded-2xl px-4 py-3 text-sm hover:bg-muted"
            >
              {item.label} <ChevronRight className="size-4 text-muted-foreground" />
            </Link>
          ) : (
            <button
              key={item.id}
              type="button"
              onClick={() => setUrl({ section: item.id === "preferences" ? "" : item.id })}
              className={cn(
                "flex items-center justify-between rounded-2xl px-4 py-3 text-left text-sm hover:bg-muted",
                active === item.id && "bg-sage font-medium hover:bg-sage",
              )}
            >
              {item.label} <ChevronRight className="size-4 text-muted-foreground md:hidden" />
            </button>
          ),
        )}
      </nav>

      {active === "preferences" && (
        <Card title={s.preferences}>
          <Row title={s.language}>
            <Select value={prefs.locale ?? "th"} onValueChange={(locale) => void savePrefs({ locale: locale as "th" | "en" })}>
              <SelectTrigger className="w-40 border-transparent bg-field">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="th">ไทย</SelectItem>
                <SelectItem value="en" disabled>
                  English (เร็วๆ นี้)
                </SelectItem>
              </SelectContent>
            </Select>
          </Row>
          <Row title={s.palette} hint={s.paletteHint}>
            <PalettePicker />
          </Row>
          <Row title={s.theme}>
            <ThemeSwitch />
          </Row>
          <Row title={s.defaultVisibility}>
            <Chips
              tone="sage"
              value={prefs.default_visibility ?? "PRIVATE"}
              onChange={(v) => void savePrefs({ default_visibility: v as Visibility })}
              options={[
                { value: "PUBLIC", label: t.restaurant.visibility.PUBLIC },
                { value: "PRIVATE", label: t.restaurant.visibility.PRIVATE },
              ]}
            />
          </Row>
        </Card>
      )}

      {active === "account" && (
        <Card title={s.account}>
          <Row title={t.auth.displayName}>
            <span className="text-sm text-muted-foreground">{user.display_name}</span>
          </Row>
          <Row title={t.auth.email}>
            <span className="text-sm text-muted-foreground">{user.email}</span>
          </Row>
          <Row title={t.auth.username}>
            <span className="text-sm text-muted-foreground">@{user.username}</span>
          </Row>
          <div className="flex justify-end pt-4">
            <Button asChild>
              <Link href="/profile/edit">{t.nav.editProfile}</Link>
            </Button>
          </div>
        </Card>
      )}

      {active === "session" && (
        <Card title={s.session}>
          <Row title={t.nav.logout} hint={s.logoutHint}>
            <Button variant="destructive" onClick={() => void logout()}>
              <LogOut /> {t.nav.logout}
            </Button>
          </Row>
        </Card>
      )}
    </div>
  )
}

export function SettingsView() {
  return (
    <RequireAuth>
      <div className={cn(pageClass, "grid gap-6 py-8 md:py-12")}>
        <PageHeader title={s.title} subtitle={s.subtitle} />
        <Settings />
      </div>
    </RequireAuth>
  )
}
