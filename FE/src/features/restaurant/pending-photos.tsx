"use client"

import { useEffect, useMemo } from "react"
import { Plus, X } from "lucide-react"
import { toast } from "sonner"
import { IMAGE_ACCEPT, MAX_RESTAURANT_IMAGES, imageFileError } from "@/lib/images"
import { t } from "@/lib/i18n"

export function UploadDropzone({
  onFiles,
  disabled,
  label,
  compact,
}: {
  onFiles: (files: FileList | null) => void
  disabled?: boolean
  label?: React.ReactNode
  compact?: boolean
}) {
  return (
    <label
      className={`flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-primary/25 bg-sage text-center transition-colors hover:bg-sage/70 has-disabled:pointer-events-none has-disabled:opacity-70 ${compact ? "aspect-square" : "min-h-36 px-4 py-8"}`}
    >
      <span className="flex items-center gap-1 text-sm font-medium text-primary">
        {label ?? (
          <>
            <Plus className="size-4" /> {t.restaurant.uploadPhotos}
          </>
        )}
      </span>
      {!compact && <span className="text-xs text-muted-foreground">{t.restaurant.photosHint}</span>}
      <input
        type="file"
        accept={IMAGE_ACCEPT}
        multiple
        className="sr-only"
        disabled={disabled}
        onChange={(e) => {
          onFiles(e.target.files)
          e.target.value = ""
        }}
      />
    </label>
  )
}

/** Photos chosen before the restaurant exists; uploaded after it is created. */
export function PendingPhotos({ files, onChange }: { files: File[]; onChange: (files: File[]) => void }) {
  const previews = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files])
  useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews])

  const add = (list: FileList | null) => {
    if (!list) return
    const accepted: File[] = []
    for (const file of Array.from(list)) {
      const err = imageFileError(file)
      if (err) toast.error(err)
      else accepted.push(file)
    }
    onChange([...files, ...accepted].slice(0, MAX_RESTAURANT_IMAGES))
  }

  if (files.length === 0) return <UploadDropzone onFiles={add} />

  return (
    <div className="grid grid-cols-2 gap-2">
      {previews.map((src, i) => (
        <div key={src} className="relative aspect-square overflow-hidden rounded-lg bg-muted">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt="" className="size-full object-cover" />
          {i === 0 && (
            <span className="absolute bottom-1.5 left-1.5 rounded-full bg-card px-2 py-0.5 text-[11px] font-medium">
              {t.restaurant.cover}
            </span>
          )}
          <button
            type="button"
            onClick={() => onChange(files.filter((_, j) => j !== i))}
            className="absolute top-1.5 right-1.5 rounded-full bg-card/95 p-1 hover:bg-card"
            aria-label={t.restaurant.deletePhoto}
          >
            <X className="size-3.5" />
          </button>
        </div>
      ))}
      {files.length < MAX_RESTAURANT_IMAGES && <UploadDropzone onFiles={add} compact />}
    </div>
  )
}
