"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useQueryClient } from "@tanstack/react-query"
import { ImagePlus, Loader2, Pencil, Plus, Trash2, UtensilsCrossed, X } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { EmptyState } from "@/components/empty-state"
import { Field, FormError } from "@/components/form-field"
import { qk } from "@/hooks/queries"
import { restaurantApi, uploadApi } from "@/lib/api/endpoints"
import type { MenuWithURL, RestaurantDetail } from "@/lib/api/types"
import { IMAGE_ACCEPT, imageFileError } from "@/lib/images"
import { errorMessage, formatBaht, t } from "@/lib/i18n"

const r = t.restaurant

const menuSchema = z.object({
  name: z.string().trim().min(1, t.validation.required).max(200, t.validation.max(200)),
  description: z.string().max(10000),
  price: z.string().refine((s) => !s.trim() || /^\d{1,10}(\.\d{1,2})?$/.test(s.trim()), t.validation.number),
})

type MenuValues = z.infer<typeof menuSchema>

/** Photo state: keep existing, replace with an upload, or remove. */
type PhotoState = { kind: "keep"; url: string } | { kind: "new"; mediaId: string; url: string } | { kind: "none" }

function MenuDialog({
  restaurantId,
  item,
  nextOrder,
  open,
  onOpenChange,
}: {
  restaurantId: string
  item?: MenuWithURL
  nextOrder: number
  open: boolean
  onOpenChange: (o: boolean) => void
}) {
  const queryClient = useQueryClient()
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [photo, setPhoto] = useState<PhotoState>(item?.image_url ? { kind: "keep", url: item.image_url } : { kind: "none" })
  const form = useForm<MenuValues>({
    resolver: zodResolver(menuSchema),
    defaultValues: {
      name: item?.menu.name ?? "",
      description: item?.menu.description ?? "",
      price: item?.menu.price == null ? "" : String(item.menu.price),
    },
  })
  const { errors, isSubmitting } = form.formState

  const pickPhoto = async (file?: File) => {
    if (!file) return
    const invalid = imageFileError(file)
    if (invalid) return toast.error(invalid)
    setUploading(true)
    try {
      const res = await uploadApi.image(file)
      setPhoto({ kind: "new", mediaId: res.media.id, url: res.url })
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setUploading(false)
    }
  }

  const submit = form.handleSubmit(async (values) => {
    setError(null)
    const body = {
      name: values.name.trim(),
      description: values.description.trim() || null,
      price: values.price.trim() ? Number(values.price) : null,
      ...(photo.kind === "new" ? { image_media_id: photo.mediaId } : photo.kind === "none" ? { image_media_id: null } : {}),
    }
    try {
      if (item) await restaurantApi.updateMenu(restaurantId, item.menu.id, body)
      else await restaurantApi.createMenu(restaurantId, { ...body, sort_order: nextOrder })
      await queryClient.invalidateQueries({ queryKey: qk.restaurant(restaurantId) })
      toast.success(r.saved)
      onOpenChange(false)
    } catch (e) {
      setError(errorMessage(e))
    }
  })

  const photoUrl = photo.kind === "none" ? null : photo.url

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{item ? r.editMenu : r.addMenu}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4" noValidate>
          <FormError message={error} />
          <Field label={r.menuPhoto} htmlFor="menu-photo" optional>
            <div className="flex items-center gap-3">
              <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-muted text-muted-foreground">
                {uploading ? (
                  <Loader2 className="size-5 animate-spin" />
                ) : photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photoUrl} alt="" className="size-full object-cover" />
                ) : (
                  <UtensilsCrossed className="size-5" />
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" asChild disabled={uploading}>
                  <label>
                    <ImagePlus /> {r.addPhotos}
                    <input
                      id="menu-photo"
                      type="file"
                      accept={IMAGE_ACCEPT}
                      className="sr-only"
                      onChange={(e) => void pickPhoto(e.target.files?.[0])}
                    />
                  </label>
                </Button>
                {photoUrl && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => setPhoto({ kind: "none" })}>
                    <X /> {t.profile.remove}
                  </Button>
                )}
              </div>
            </div>
          </Field>
          <Field label={r.menuName} htmlFor="menu-name" error={errors.name?.message}>
            <Input id="menu-name" className="h-11" aria-invalid={!!errors.name} {...form.register("name")} />
          </Field>
          <Field label={r.menuPrice} htmlFor="menu-price" optional error={errors.price?.message}>
            <Input id="menu-price" inputMode="decimal" className="h-11" aria-invalid={!!errors.price} {...form.register("price")} />
          </Field>
          <Field label={r.description} htmlFor="menu-description" optional>
            <Textarea id="menu-description" rows={3} {...form.register("description")} />
          </Field>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {r.cancel}
            </Button>
            <Button type="submit" disabled={isSubmitting || uploading}>
              {isSubmitting && <Loader2 className="animate-spin" />} {r.save}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function MenuList({ menus, actions }: { menus: MenuWithURL[]; actions?: (m: MenuWithURL) => React.ReactNode }) {
  return (
    <ul className="divide-y rounded-lg border">
      {menus.map((m) => (
        <li key={m.menu.id} className="flex items-center gap-4 p-4">
          <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-muted text-muted-foreground">
            {m.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={m.image_url} alt={m.menu.name} className="size-full object-cover" loading="lazy" />
            ) : (
              <UtensilsCrossed className="size-5" />
            )}
          </div>
          <div className="grid min-w-0 flex-1 gap-0.5">
            <div className="flex items-baseline justify-between gap-3">
              <p className="truncate font-medium">{m.menu.name}</p>
              {m.menu.price != null && <p className="shrink-0 text-sm font-medium">{formatBaht(m.menu.price)}</p>}
            </div>
            {m.menu.description && <p className="line-clamp-2 text-sm text-muted-foreground">{m.menu.description}</p>}
          </div>
          {actions?.(m)}
        </li>
      ))}
    </ul>
  )
}

export function MenuManager({ detail }: { detail: RestaurantDetail }) {
  const id = detail.restaurant.id
  const queryClient = useQueryClient()
  // Bumping the key remounts the dialog so its form resets for each item.
  const [dialog, setDialog] = useState<{ item?: MenuWithURL; key: number } | null>(null)
  const menus = [...detail.menus].sort((a, b) => a.menu.sort_order - b.menu.sort_order)
  const nextOrder = menus.reduce((m, x) => Math.max(m, x.menu.sort_order), -1) + 1

  const remove = async (menuId: string) => {
    try {
      await restaurantApi.removeMenu(id, menuId)
      await queryClient.invalidateQueries({ queryKey: qk.restaurant(id) })
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  return (
    <div className="grid gap-4">
      <div className="flex justify-end">
        <Button type="button" variant="outline" onClick={() => setDialog({ key: Date.now() })}>
          <Plus /> {r.addMenu}
        </Button>
      </div>
      {menus.length === 0 ? (
        <EmptyState icon={UtensilsCrossed} title={r.noMenu} />
      ) : (
        <MenuList
          menus={menus}
          actions={(m) => (
            <div className="flex shrink-0 gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setDialog({ item: m, key: Date.now() })}
                aria-label={r.editMenu}
              >
                <Pencil />
              </Button>
              <ConfirmDialog title={`ลบ “${m.menu.name}”?`} confirmLabel="ลบเมนู" onConfirm={() => remove(m.menu.id)}>
                <Button type="button" variant="ghost" size="icon" className="text-destructive" aria-label="ลบเมนู">
                  <Trash2 />
                </Button>
              </ConfirmDialog>
            </div>
          )}
        />
      )}
      {dialog && (
        <MenuDialog
          key={dialog.key}
          restaurantId={id}
          item={dialog.item}
          nextOrder={nextOrder}
          open
          onOpenChange={(o) => !o && setDialog(null)}
        />
      )}
    </div>
  )
}
