"use client"

import Link from "next/link"
import { LogOut, Settings, User, UserPen } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { UserAvatar } from "@/components/user-avatar"
import { useMyProfile } from "@/hooks/queries"
import { authApi } from "@/lib/api/endpoints"
import { t } from "@/lib/i18n"
import { sessionHint, useAuthStore } from "@/stores/auth-store"

export function useLogout() {
  return async () => {
    try {
      await authApi.logout()
    } finally {
      sessionHint.set(false)
      // A full reload drops the in-memory token and query cache, and avoids
      // RequireAuth on the current page racing this redirect to /login.
      window.location.replace("/")
    }
  }
}

export function UserMenu() {
  const user = useAuthStore((s) => s.user)
  const { data: profile } = useMyProfile()
  const logout = useLogout()
  if (!user) return null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="rounded-full ring-2 ring-card outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        aria-label={t.nav.profile}
      >
        <UserAvatar name={user.display_name} src={profile?.images.avatar_url} className="size-10" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="flex flex-col">
          <span className="truncate font-medium text-foreground">{user.display_name}</span>
          <span className="truncate text-xs font-normal text-muted-foreground">@{user.username}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href={`/profile/${user.username}`}>
            <User /> {t.nav.profile}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/profile/edit">
            <UserPen /> {t.nav.editProfile}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/settings">
            <Settings /> {t.nav.settings}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={() => void logout()}>
          <LogOut /> {t.nav.logout}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
