"use client"

import { useState } from "react"
import { Controller, useForm, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Chips } from "@/components/chips"
import { Field, FormError } from "@/components/form-field"
import { LocationField } from "@/features/restaurant/location-field"
import { PendingPhotos } from "@/features/restaurant/pending-photos"
import { TaxonomyPicker } from "@/features/restaurant/taxonomy-picker"
import { restaurantSchema, toFormValues, toPayload, type RestaurantFormValues } from "@/features/restaurant/form-schema"
import { useCategories, useTags } from "@/hooks/queries"
import type { RestaurantCreate, RestaurantDetail } from "@/lib/api/types"
import { errorMessage, t } from "@/lib/i18n"
import { useAuthStore } from "@/stores/auth-store"

const r = t.restaurant

export function FormCard({ title, hint, children, id }: { title: string; hint?: string; children: React.ReactNode; id?: string }) {
  return (
    <section id={id} className="grid content-start gap-4 rounded-3xl border bg-card p-6 shadow-sm md:p-7">
      <div className="grid gap-0.5">
        <h2 className="text-[15px] font-semibold">{title}</h2>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      {children}
    </section>
  )
}

interface Props {
  initial?: RestaurantDetail
  /** Create mode collects photos to upload after the restaurant exists. */
  withPhotos?: boolean
  /** Extra sidebar content shown above visibility (e.g. the edit-mode photo manager). */
  aside?: React.ReactNode
  submitLabel: string
  onSubmit: (payload: RestaurantCreate, photos: File[]) => Promise<void>
  onCancel?: () => void
}

export function RestaurantForm({ initial, withPhotos, aside, submitLabel, onSubmit, onCancel }: Props) {
  const prefs = useAuthStore((s) => s.user?.preferences)
  const { data: categories = [] } = useCategories()
  const { data: tags = [] } = useTags()
  const [photos, setPhotos] = useState<File[]>([])
  const [error, setError] = useState<string | null>(null)

  const form = useForm<RestaurantFormValues>({ resolver: zodResolver(restaurantSchema), defaultValues: toFormValues(initial, prefs) })
  const { errors, isSubmitting } = form.formState
  const visibility = useWatch({ control: form.control, name: "visibility" })

  const submit = form.handleSubmit(async (values) => {
    setError(null)
    try {
      await onSubmit(toPayload(values), photos)
    } catch (e) {
      setError(errorMessage(e))
    }
  })

  const input = (name: keyof RestaurantFormValues, opts: { type?: string; placeholder?: string; inputMode?: "decimal" } = {}) => (
    <Input
      id={name}
      type={opts.type ?? "text"}
      inputMode={opts.inputMode}
      placeholder={opts.placeholder}
      className="h-11"
      aria-invalid={!!errors[name]}
      {...form.register(name)}
    />
  )
  const err = (name: keyof RestaurantFormValues) => errors[name]?.message as string | undefined

  return (
    <form onSubmit={submit} className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px]" noValidate>
      <div className="grid gap-5">
        <FormCard title={r.basicInfo}>
          <FormError message={error} />
          <Field label={r.name} htmlFor="name" error={err("name")}>
            {input("name", { placeholder: r.namePlaceholder })}
          </Field>
          <Field label={r.address} htmlFor="address" optional error={err("address")}>
            {input("address", { placeholder: r.addressPlaceholder })}
          </Field>
          <Field label={r.mapUrl} htmlFor="map_url" optional error={err("map_url")}>
            {input("map_url", { type: "url", placeholder: "https://maps.app.goo.gl/…" })}
          </Field>
          <div className="grid gap-1.5">
            <Label htmlFor="price_min">
              {r.priceRange} <span className="font-normal text-muted-foreground">(ไม่บังคับ)</span>
            </Label>
            <div className="grid grid-cols-2 gap-3">
              {input("price_min", { inputMode: "decimal", placeholder: r.minPlaceholder })}
              <Input
                id="price_max"
                inputMode="decimal"
                placeholder={r.maxPlaceholder}
                className="h-11"
                aria-label={r.priceMax}
                aria-invalid={!!errors.price_max}
                {...form.register("price_max")}
              />
            </div>
            {(err("price_min") || err("price_max")) && <p className="text-xs text-destructive">{err("price_min") ?? err("price_max")}</p>}
          </div>
          <Field label={r.description} htmlFor="description" optional error={err("description")}>
            <Textarea id="description" rows={4} placeholder={r.descriptionPlaceholder} {...form.register("description")} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={r.phone} htmlFor="phone" optional error={err("phone")}>
              {input("phone", { type: "tel" })}
            </Field>
            <Field label={r.website} htmlFor="website_url" optional error={err("website_url")}>
              {input("website_url", { type: "url", placeholder: "https://" })}
            </Field>
          </div>
          {categories.length > 0 && (
            <Field label={r.categories} htmlFor="categories">
              <Controller
                control={form.control}
                name="category_ids"
                render={({ field }) => <TaxonomyPicker items={categories} value={field.value} onChange={field.onChange} />}
              />
            </Field>
          )}
          {tags.length > 0 && (
            <Field label={r.tags} htmlFor="tags">
              <Controller
                control={form.control}
                name="tag_ids"
                render={({ field }) => <TaxonomyPicker items={tags} value={field.value} onChange={field.onChange} />}
              />
            </Field>
          )}
        </FormCard>

        <FormCard title={r.location} hint={r.locationHint}>
          <Controller
            control={form.control}
            name="location"
            render={({ field }) => <LocationField value={field.value} onChange={field.onChange} />}
          />
          <Field label={r.mapEmbedUrl} htmlFor="map_embed_url" error={err("map_embed_url")}>
            {input("map_embed_url", { type: "url", placeholder: "https://www.google.com/maps/embed?pb=…" })}
          </Field>
        </FormCard>

        <div className="flex justify-end gap-2">
          {onCancel && (
            <Button type="button" variant="ghost" size="lg" onClick={onCancel}>
              {r.cancel}
            </Button>
          )}
          <Button type="submit" size="lg" className="min-w-36" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="animate-spin" />}
            {isSubmitting ? r.saving : submitLabel}
          </Button>
        </div>
      </div>

      <div className="grid gap-5 lg:sticky lg:top-20">
        {withPhotos && (
          <FormCard title={r.photosCard}>
            <PendingPhotos files={photos} onChange={setPhotos} />
          </FormCard>
        )}
        {aside}
        <FormCard title={r.whoCanSee} hint={r.visibilityHint[visibility]}>
          <Controller
            control={form.control}
            name="visibility"
            render={({ field }) => (
              <Chips
                tone="sage"
                value={field.value}
                onChange={field.onChange}
                options={[
                  { value: "PUBLIC", label: r.visibility.PUBLIC },
                  { value: "PRIVATE", label: r.visibility.PRIVATE },
                ]}
              />
            )}
          />
        </FormCard>
        <FormCard title={r.status}>
          <Controller
            control={form.control}
            name="visit_status"
            render={({ field }) => (
              <Chips
                tone="sage"
                value={field.value}
                onChange={field.onChange}
                options={[
                  { value: "WANT_TO_GO", label: r.visitStatus.WANT_TO_GO },
                  { value: "VISITED", label: r.visitStatus.VISITED },
                ]}
              />
            )}
          />
        </FormCard>
      </div>
    </form>
  )
}
