"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { LogIn, LogOut, Menu, Plus, Settings, User, UserPlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Skeleton } from "@/components/ui/skeleton"
import { Logo } from "@/components/layout/logo"
import { isActive, navLinks } from "@/components/layout/nav-links"
import { UserMenu, useLogout } from "@/components/layout/user-menu"
import { UnreadBadge } from "@/features/chat/conversation-list"
import { t } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import { useAuthStore } from "@/stores/auth-store"

function MobileMenu() {
  const { status, user } = useAuthStore()
  const logout = useLogout()
  const authed = status === "authenticated"
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative rounded-full md:hidden" aria-label="เมนู">
          <Menu />
          {authed && <UnreadBadge className="absolute -top-0.5 -right-0.5" />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {navLinks
          .filter((l) => !l.auth || authed)
          .map((l) => (
            <DropdownMenuItem key={l.href} asChild>
              <Link href={l.href}>
                {l.label}
                {l.href === "/chat" && <UnreadBadge className="ml-auto" />}
              </Link>
            </DropdownMenuItem>
          ))}
        <DropdownMenuSeparator />
        {authed ? (
          <>
            <DropdownMenuItem asChild>
              <Link href="/restaurants/new">
                <Plus /> {t.nav.add}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href={`/profile/${user?.username}`}>
                <User /> {t.nav.profile}
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
          </>
        ) : (
          <>
            <DropdownMenuItem asChild>
              <Link href="/login">
                <LogIn /> {t.nav.login}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/register">
                <UserPlus /> {t.nav.register}
              </Link>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function SiteHeader() {
  const pathname = usePathname()
  const status = useAuthStore((s) => s.status)

  return (
    <header className="sticky top-0 z-40 px-3 pt-3 md:px-6">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-6 rounded-full glass pr-2 pl-5 shadow-lg shadow-foreground/[0.04]">
        <Logo />
        <nav className="hidden items-center gap-1 md:flex">
          {navLinks
            .filter((l) => !l.auth || status === "authenticated")
            .map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground",
                  isActive(pathname, link.href) && "bg-primary/10 font-semibold text-primary hover:bg-primary/10 hover:text-primary",
                )}
              >
                {link.label}
                {link.href === "/chat" && <UnreadBadge />}
              </Link>
            ))}
        </nav>
        <div className="ml-auto flex items-center gap-3">
          {status === "loading" && <Skeleton className="h-8 w-28 rounded-lg" />}
          {status === "guest" && (
            <div className="hidden items-center gap-2 md:flex">
              <Button asChild variant="ghost" className="rounded-full">
                <Link href="/login">{t.nav.login}</Link>
              </Button>
              <Button asChild className="rounded-full">
                <Link href="/register">{t.nav.register}</Link>
              </Button>
            </div>
          )}
          {status === "authenticated" && (
            <div className="hidden items-center gap-3 md:flex">
              <Button asChild className="rounded-full">
                <Link href="/restaurants/new">
                  <Plus /> {t.nav.add}
                </Link>
              </Button>
              <UserMenu />
            </div>
          )}
          <MobileMenu />
        </div>
      </div>
    </header>
  )
}

export function SiteHeaderFallback() {
  return (
    <header className="sticky top-0 z-40 px-3 pt-3 md:px-6">
      <div className="mx-auto flex h-14 max-w-7xl items-center rounded-full glass px-5">
        <Logo />
      </div>
    </header>
  )
}
