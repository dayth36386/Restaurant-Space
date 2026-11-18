"use client"

import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { ChevronLeft, ChevronRight, ImagePlus, Loader2, Star, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { qk } from "@/hooks/queries"
import { restaurantApi, uploadApi } from "@/lib/api/endpoints"
import type { RestaurantDetail } from "@/lib/api/types"
import { MAX_RESTAURANT_IMAGES, imageFileError } from "@/lib/images"
import { UploadDropzone } from "@/features/restaurant/pending-photos"
import { errorMessage, t } from "@/lib/i18n"
import { cn } from "@/lib/utils"

const r = t.restaurant

export function ImageManager({ detail }: { detail: RestaurantDetail }) {
  const id = detail.restaurant.id
  const queryClient = useQueryClient()
  const [uploading, setUploading] = useState<{ done: number; total: number } | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const images = [...detail.images].sort((a, b) => a.image.sort_order - b.image.sort_order)
  const refresh = () => queryClient.invalidateQueries({ queryKey: qk.restaurant(id) })

  const run = async (imageId: string, fn: () => Promise<unknown>) => {
    setBusyId(imageId)
    try {
      await fn()
      await refresh()
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setBusyId(null)
    }
  }

  const upload = async (list: FileList | null) => {
    if (!list) return
    const files = Array.from(list).slice(0, MAX_RESTAURANT_IMAGES - images.length)
    let order = images.reduce((m, im) => Math.max(m, im.image.sort_order), -1)
    let hasCover = images.some((im) => im.image.is_cover)
    setUploading({ done: 0, total: files.length })
    for (const [i, file] of files.entries()) {
      const invalid = imageFileError(file)
      if (invalid) {
        toast.error(invalid)
        continue
      }
      try {
        const { media } = await uploadApi.image(file)
        await restaurantApi.attachImage(id, { media_id: media.id, sort_order: ++order, is_cover: !hasCover })
        hasCover = true
      } catch (e) {
        toast.error(`${r.photoFailed(file.name)}: ${errorMessage(e)}`)
      }
      setUploading({ done: i + 1, total: files.length })
    }
    setUploading(null)
    await refresh()
  }

  // Swap, then renumber to 0..n-1 so ordering stays unambiguous; only changed rows are patched.
  const move = (index: number, dir: -1 | 1) => {
    if (!images[index + dir]) return
    const next = [...images]
    ;[next[index], next[index + dir]] = [next[index + dir], next[index]]
    void run(images[index].image.id, async () => {
      for (const [order, { image }] of next.entries()) {
        if (image.sort_order !== order) await restaurantApi.updateImage(id, image.id, { sort_order: order })
      }
    })
  }

  const addTile = images.length < MAX_RESTAURANT_IMAGES && (
    <UploadDropzone
      onFiles={(files) => void upload(files)}
      disabled={!!uploading}
      compact={images.length > 0}
      label={
        uploading ? (
          <>
            <Loader2 className="size-4 animate-spin" /> {r.uploadingPhotos(uploading.done, uploading.total)}
          </>
        ) : images.length > 0 ? (
          <>
            <ImagePlus className="size-4" /> {r.addPhotos}
          </>
        ) : undefined
      }
    />
  )

  if (images.length === 0) return addTile

  return (
    <div className="grid gap-3">
      <div className="grid grid-cols-2 gap-2">
        {images.map(({ image, url }, i) => (
          <div
            key={image.id}
            className={cn(
              "relative aspect-square overflow-hidden rounded-lg bg-muted",
              image.is_cover && "ring-2 ring-primary ring-offset-2 ring-offset-card",
            )}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt={image.alt_text ?? ""} className="size-full object-cover" />
            {image.is_cover && (
              <span className="absolute top-1.5 left-1.5 rounded-full bg-primary px-2 py-0.5 text-[11px] font-medium text-primary-foreground">
                {r.cover}
              </span>
            )}
            {busyId === image.id && (
              <div className="absolute inset-0 flex items-center justify-center bg-card/60">
                <Loader2 className="size-5 animate-spin" />
              </div>
            )}
            <div className="absolute inset-x-1.5 bottom-1.5 flex justify-between gap-1">
              <div className="flex gap-1">
                <Button
                  type="button"
                  size="icon-xs"
                  variant="secondary"
                  disabled={i === 0 || !!busyId}
                  onClick={() => move(i, -1)}
                  aria-label={r.moveLeft}
                >
                  <ChevronLeft />
                </Button>
                <Button
                  type="button"
                  size="icon-xs"
                  variant="secondary"
                  disabled={i === images.length - 1 || !!busyId}
                  onClick={() => move(i, 1)}
                  aria-label={r.moveRight}
                >
                  <ChevronRight />
                </Button>
              </div>
              <div className="flex gap-1">
                {!image.is_cover && (
                  <Button
                    type="button"
                    size="icon-xs"
                    variant="secondary"
                    disabled={!!busyId}
                    onClick={() => run(image.id, () => restaurantApi.updateImage(id, image.id, { is_cover: true }))}
                    aria-label={r.setCover}
                    title={r.setCover}
                  >
                    <Star />
                  </Button>
                )}
                <ConfirmDialog
                  title={r.deletePhoto}
                  confirmLabel={r.deletePhoto}
                  onConfirm={() => run(image.id, () => restaurantApi.removeImage(id, image.id))}
                >
                  <Button
                    type="button"
                    size="icon-xs"
                    variant="secondary"
                    disabled={!!busyId}
                    aria-label={r.deletePhoto}
                    className="text-destructive"
                  >
                    <Trash2 />
                  </Button>
                </ConfirmDialog>
              </div>
            </div>
          </div>
        ))}
        {addTile}
      </div>
      <p className="text-xs text-muted-foreground">
        {images.length}/{MAX_RESTAURANT_IMAGES} · {r.photosHint}
      </p>
    </div>
  )
}
