"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { MessagesSquare, UserX, UtensilsCrossed } from "lucide-react"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/empty-state"
import { pageClass } from "@/components/page-header"
import { PageSpinner } from "@/components/require-auth"
import { UserAvatar } from "@/components/user-avatar"
import { useStartChat } from "@/features/chat/use-start-chat"
import { RestaurantGrid } from "@/features/restaurant/restaurant-grid"
import { usePublicProfile, useRestaurants } from "@/hooks/queries"
import { t } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import { useAuthStore } from "@/stores/auth-store"

export function PublicProfileView() {
  const { username } = useParams<{ username: string }>()
  const decoded = decodeURIComponent(username)
  const me = useAuthStore((s) => s.user)
  const { data: profile, isPending, isError } = usePublicProfile(decoded)
  // The owner would also get their private rows back; this page lists public ones only.
  const restaurants = useRestaurants({ user_id: profile?.id }, !!profile)
  const isMe = me?.username === decoded
  const chat = useStartChat()
  // Totals over the public restaurants loaded so far (the profile API has no aggregate yet).
  const publicCards = restaurants.data?.pages.flatMap((p) => p.items).filter((c) => c.restaurant.visibility === "PUBLIC") ?? []
  const totals = publicCards.reduce((sum, c) => ({ likes: sum.likes + c.like_count, comments: sum.comments + c.comment_count }), {
    likes: 0,
    comments: 0,
  })

  if (isPending) return <PageSpinner />
  if (isError) {
    return (
      <div className={cn(pageClass, "max-w-3xl py-10")}>
        <EmptyState icon={UserX} title={t.profile.notFound} />
      </div>
    )
  }

  return (
    <div className={cn(pageClass, "grid gap-8 py-6 md:py-10")}>
      <section className="overflow-hidden rounded-[2rem] border bg-card shadow-xl shadow-primary/5">
        <div className="relative h-44 overflow-hidden bg-ink md:h-64">
          {profile.images?.cover_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={profile.images.cover_url} alt="" className="size-full object-cover" />
          ) : (
            <div className="size-full bg-hero" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
        </div>
        <div className="grid gap-6 px-6 pb-7 md:grid-cols-[1fr_auto] md:items-end md:px-10">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <UserAvatar
              name={profile.display_name}
              src={profile.images?.avatar_url}
              className="-mt-14 size-28 shadow-xl ring-4 ring-card md:-mt-16 md:size-32"
              initialClassName="text-4xl"
            />
            <div className="grid gap-1 sm:pb-2">
              <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{profile.display_name}</h1>
              <p className="text-sm text-muted-foreground">@{profile.username}</p>
            </div>
          </div>
          <div className="flex gap-2 md:pb-2">
            {isMe ? (
              <Button asChild variant="outline" size="lg" className="rounded-full bg-card">
                <Link href="/profile/edit">{t.nav.editProfile}</Link>
              </Button>
            ) : (
              <Button size="lg" className="rounded-full" disabled={chat.busy} onClick={() => void chat.start(profile.id)}>
                <MessagesSquare /> {t.chat.message}
              </Button>
            )}
          </div>
          <p className="max-w-2xl text-[15px] leading-relaxed whitespace-pre-line md:col-span-2">
            {profile.bio || <span className="text-muted-foreground">{t.profile.noBio}</span>}
          </p>
          <dl className="grid grid-cols-3 gap-3 md:col-span-2 md:max-w-xl">
            {[
              [profile.public_restaurant_count, t.profile.savedPlaces],
              [totals.likes, t.restaurant.likes],
              [totals.comments, t.restaurant.comments],
            ].map(([value, label]) => (
              <div key={label} className="rounded-2xl bg-sage/70 px-4 py-3">
                <dd className="text-2xl font-bold tracking-tight">{value}</dd>
                <dt className="text-xs text-muted-foreground">{label}</dt>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="grid gap-5">
        <h2 className="text-2xl font-bold tracking-tight">{t.profile.restaurants}</h2>
        <RestaurantGrid
          query={restaurants}
          filter={(c) => c.restaurant.visibility === "PUBLIC"}
          empty={<EmptyState icon={UtensilsCrossed} title={t.profile.empty} />}
        />
      </section>
    </div>
  )
}
