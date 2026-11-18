"use client"

import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import {
  ArrowLeft,
  ExternalLink,
  Globe,
  Lock,
  MapPin,
  MessageCircle,
  MessagesSquare,
  Navigation,
  Pencil,
  Phone,
  SearchX,
  Trash2,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { EmptyState } from "@/components/empty-state"
import { pageClass } from "@/components/page-header"
import { PageSpinner } from "@/components/require-auth"
import { useStartChat } from "@/features/chat/use-start-chat"
import { CommentsSection } from "@/features/comments/comments-section"
import { LikeButton } from "@/features/comments/like-button"
import { SinglePinMap } from "@/features/map"
import { UserAvatar } from "@/components/user-avatar"
import { Gallery } from "@/features/restaurant/gallery"
import { useRestaurant } from "@/hooks/queries"
import { restaurantApi } from "@/lib/api/endpoints"
import { errorMessage, formatBaht, formatDate, formatPrice, t } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import { useAuthStore } from "@/stores/auth-store"

const r = t.restaurant

/** Only render iframes for allowlisted Google Maps embed URLs (validated again by the API). */
function safeEmbed(url?: string | null) {
  if (!url) return null
  try {
    const u = new URL(url)
    return u.protocol === "https:" && ["www.google.com", "maps.google.com"].includes(u.host) && u.pathname.startsWith("/maps/embed")
      ? u.toString()
      : null
  } catch {
    return null
  }
}

function Dot() {
  return <span className="text-muted-foreground/60">•</span>
}

export function RestaurantDetailView() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const queryClient = useQueryClient()
  const userId = useAuthStore((s) => s.user?.id)
  const { data, isPending, isError } = useRestaurant(id)
  const chat = useStartChat()

  if (isPending) return <PageSpinner />
  if (isError) {
    return (
      <div className={cn(pageClass, "max-w-3xl py-10")}>
        <EmptyState
          icon={SearchX}
          title={r.notFound}
          action={
            <Button asChild>
              <Link href="/feed">{t.nav.feed}</Link>
            </Button>
          }
        />
      </div>
    )
  }

  const rest = data.restaurant
  const isOwner = rest.user_id === userId
  const price = formatPrice(rest.price_min, rest.price_max)
  const point = rest.latitude != null && rest.longitude != null ? { lat: rest.latitude, lng: rest.longitude } : null
  const embed = safeEmbed(rest.map_embed_url)
  const directions = point ? `https://www.google.com/maps/dir/?api=1&destination=${point.lat},${point.lng}` : null
  const mapsLink = rest.map_url || directions
  const menus = [...data.menus].sort((a, b) => a.menu.sort_order - b.menu.sort_order)
  const category = data.categories[0]

  const remove = async () => {
    try {
      await restaurantApi.remove(id)
      queryClient.removeQueries({ queryKey: ["restaurant", id] })
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["restaurants"] }),
        queryClient.invalidateQueries({ queryKey: ["feed"] }),
      ])
      toast.success(r.deleted)
      router.replace("/restaurants")
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  return (
    <div className={cn(pageClass, "grid gap-7 py-6 md:py-10")}>
      <div className="grid gap-4">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground md:hidden"
        >
          <ArrowLeft className="size-4" /> {t.common.back}
        </button>
        <nav className="hidden items-center gap-1.5 text-xs text-muted-foreground md:flex" aria-label="breadcrumb">
          <Link href="/feed" className="hover:text-foreground">
            {t.nav.feed}
          </Link>
          {category && (
            <>
              <span>/</span>
              <Link href={`/feed?category_id=${category.id}`} className="hover:text-foreground">
                {category.name}
              </Link>
            </>
          )}
          <span>/</span>
          <span className="truncate text-foreground">{rest.name}</span>
        </nav>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="grid gap-2">
            <h1 className="text-[32px] leading-tight font-bold tracking-tight md:text-[44px]">{rest.name}</h1>
            <Link href={`/profile/${data.author.username}`} className="group flex w-fit items-center gap-2 text-sm text-muted-foreground">
              <UserAvatar name={data.author.display_name} src={data.author.avatar_url} className="size-7" initialClassName="text-xs" />
              <span>
                {t.chat.postedBy} <span className="font-semibold text-foreground group-hover:text-primary">{data.author.display_name}</span>{" "}
                · @{data.author.username}
              </span>
            </Link>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
              {rest.address && (
                <span className="flex items-center gap-1">
                  <MapPin className="size-3.5" /> <span className="line-clamp-1 max-w-80">{rest.address}</span>
                </span>
              )}
              {category && (
                <>
                  {rest.address && <Dot />}
                  <span>{category.name}</span>
                </>
              )}
              {price && (
                <>
                  <Dot />
                  <span>
                    {price} {r.perPerson}
                  </span>
                </>
              )}
              {(rest.address || category || price) && <Dot />}
              <span>{r.visitStatus[rest.visit_status]}</span>
              {isOwner && rest.visibility === "PRIVATE" && (
                <span className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs">
                  <Lock className="size-3" /> {r.visibility.PRIVATE}
                </span>
              )}
            </div>
          </div>
          <div className="flex w-full flex-wrap gap-2 md:w-auto">
            <LikeButton detail={data} />
            {!isOwner && userId && (
              <Button variant="outline" className="bg-card" disabled={chat.busy} onClick={() => void chat.start(rest.user_id)}>
                <MessagesSquare /> {t.chat.messageOwner}
              </Button>
            )}
            {isOwner ? (
              <>
                <Button asChild className="flex-1 md:flex-none">
                  <Link href={`/restaurants/${id}/edit`}>
                    <Pencil /> {r.editTitle}
                  </Link>
                </Button>
                <ConfirmDialog title={r.deleteConfirmTitle} description={r.deleteConfirm} confirmLabel={r.delete} onConfirm={remove}>
                  <Button variant="outline" size="icon" className="text-destructive" aria-label={r.delete}>
                    <Trash2 />
                  </Button>
                </ConfirmDialog>
              </>
            ) : (
              mapsLink && (
                <Button asChild className="flex-1 md:flex-none">
                  <a href={mapsLink} target="_blank" rel="noopener noreferrer nofollow">
                    <Navigation /> {r.directions}
                  </a>
                </Button>
              )
            )}
          </div>
        </div>
      </div>

      <Gallery images={data.images} name={rest.name} />

      <section className="grid gap-2">
        <h2 className="text-xl font-bold tracking-tight">{r.about}</h2>
        {rest.description ? (
          <p className="max-w-3xl text-sm leading-relaxed whitespace-pre-line text-muted-foreground">{rest.description}</p>
        ) : (
          <p className="text-sm text-muted-foreground">{r.noDescription}</p>
        )}
        <div className="flex flex-wrap items-center gap-4 pt-1 text-xs text-muted-foreground">
          <a href="#comments" className="flex items-center gap-1 hover:text-foreground">
            <MessageCircle className="size-3.5" /> {data.comment_count} {r.comments}
          </a>
          <span>
            {r.addedOn} {formatDate(rest.created_at)}
          </span>
          {data.tags.map((tag) => (
            <span key={tag.id} className="rounded-full bg-sage px-2.5 py-0.5 text-foreground">
              #{tag.name}
            </span>
          ))}
        </div>
      </section>

      <div className="grid items-start gap-5 md:grid-cols-2">
        <section className="grid content-start gap-4 rounded-3xl border bg-card p-6 shadow-sm md:p-7">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">{r.menuHighlights}</h2>
            {isOwner && (
              <Link href={`/restaurants/${id}/edit#menu`} className="text-xs text-primary hover:underline">
                {r.editMenu}
              </Link>
            )}
          </div>
          {menus.length === 0 ? (
            <p className="text-sm text-muted-foreground">{r.noMenu}</p>
          ) : (
            <ul className="grid gap-4">
              {menus.map((m) => (
                <li key={m.menu.id} className="flex items-center gap-3 text-[15px]">
                  {m.image_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.image_url} alt="" className="size-10 shrink-0 rounded-md object-cover" loading="lazy" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <p className="truncate font-medium">{m.menu.name}</p>
                      <span className="mb-1 min-w-6 flex-1 border-b-2 border-dotted border-border" aria-hidden />
                      {m.menu.price != null && <span className="shrink-0 font-bold text-primary">{formatBaht(m.menu.price)}</span>}
                    </div>
                    {m.menu.description && <p className="line-clamp-1 text-xs text-muted-foreground">{m.menu.description}</p>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="grid content-start gap-4 rounded-3xl bg-sage p-6 md:p-7">
          <h2 className="flex items-center gap-1.5 font-semibold">
            <MapPin className="size-4 text-primary" /> {r.locationAndDirections}
          </h2>
          {rest.address && <p className="text-sm text-muted-foreground">{rest.address}</p>}
          {point && (
            <div className="h-56 overflow-hidden rounded-2xl ring-1 ring-black/5">
              <SinglePinMap point={point} />
            </div>
          )}
          {embed && !point && (
            <div className="aspect-[16/9] overflow-hidden rounded-lg">
              <iframe
                src={embed}
                title={rest.name}
                className="size-full"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                sandbox="allow-scripts allow-same-origin allow-popups"
              />
            </div>
          )}
          {(rest.phone || rest.website_url) && (
            <div className="grid gap-2 text-sm">
              {rest.phone && (
                <a href={`tel:${rest.phone}`} className="flex items-center gap-2 hover:text-primary">
                  <Phone className="size-4 text-muted-foreground" /> {rest.phone}
                </a>
              )}
              {rest.website_url && (
                <a
                  href={rest.website_url}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="flex items-center gap-2 truncate hover:text-primary"
                >
                  <Globe className="size-4 shrink-0 text-muted-foreground" /> {rest.website_url.replace(/^https?:\/\//, "")}
                </a>
              )}
            </div>
          )}
          {mapsLink ? (
            <Button asChild className="w-fit">
              <a href={mapsLink} target="_blank" rel="noopener noreferrer nofollow">
                {r.openInMaps} <ExternalLink />
              </a>
            </Button>
          ) : (
            !rest.address && <p className="text-sm text-muted-foreground">{r.noLocation}</p>
          )}
        </section>
      </div>

      <CommentsSection restaurantId={id} isPublic={rest.visibility === "PUBLIC"} />
    </div>
  )
}
