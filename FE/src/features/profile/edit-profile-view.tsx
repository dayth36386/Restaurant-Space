"use client"

import Link from "next/link"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useQueryClient } from "@tanstack/react-query"
import { Camera, ImagePlus, Loader2, X } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Field, FormError } from "@/components/form-field"
import { PageHeader } from "@/components/page-header"
import { PageSpinner, RequireAuth } from "@/components/require-auth"
import { UserAvatar } from "@/components/user-avatar"
import { qk, useMyProfile } from "@/hooks/queries"
import { uploadApi, userApi } from "@/lib/api/endpoints"
import type { MyProfile, ProfilePatch } from "@/lib/api/types"
import { IMAGE_ACCEPT, imageFileError } from "@/lib/images"
import { errorMessage, t } from "@/lib/i18n"
import { useAuthStore } from "@/stores/auth-store"

const v = t.validation
const schema = z.object({
  display_name: z.string().trim().min(1, v.required).max(100, v.max(100)),
  username: z.string().regex(/^[a-z0-9_]{3,50}$/, v.username),
  bio: z.string().max(2000, v.max(2000)),
})
type Values = z.infer<typeof schema>

/** undefined = unchanged, null = remove, object = newly uploaded. */
type ImageChange = { mediaId: string; url: string } | null | undefined

function useImagePick(onPicked: (c: { mediaId: string; url: string }) => void) {
  const [busy, setBusy] = useState(false)
  const pick = async (file?: File) => {
    if (!file) return
    const invalid = imageFileError(file)
    if (invalid) return toast.error(invalid)
    setBusy(true)
    try {
      const res = await uploadApi.image(file)
      onPicked({ mediaId: res.media.id, url: res.url })
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }
  return { busy, pick }
}

function EditProfileForm({ profile }: { profile: MyProfile }) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [error, setError] = useState<string | null>(null)
  const [avatar, setAvatar] = useState<ImageChange>(undefined)
  const [cover, setCover] = useState<ImageChange>(undefined)
  const avatarPick = useImagePick(setAvatar)
  const coverPick = useImagePick(setCover)
  const { user, images } = profile

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { display_name: user.display_name, username: user.username, bio: user.bio ?? "" },
  })
  const { errors, isSubmitting } = form.formState

  const avatarUrl = avatar === undefined ? images.avatar_url : avatar?.url
  const coverUrl = cover === undefined ? images.cover_url : cover?.url

  const submit = form.handleSubmit(async (values) => {
    setError(null)
    const patch: ProfilePatch = { display_name: values.display_name.trim(), username: values.username, bio: values.bio.trim() || null }
    if (avatar !== undefined) patch.avatar_media_id = avatar?.mediaId ?? null
    if (cover !== undefined) patch.cover_media_id = cover?.mediaId ?? null
    try {
      const updated = await userApi.updateMe(patch)
      useAuthStore.getState().setUser(updated.user)
      queryClient.setQueryData(qk.me, updated)
      await queryClient.invalidateQueries({ queryKey: ["user"] })
      toast.success(t.restaurant.saved)
      router.push(`/profile/${updated.user.username}`)
    } catch (e) {
      setError(errorMessage(e))
    }
  })

  return (
    <form onSubmit={submit} className="grid gap-6" noValidate>
      <FormError message={error} />
      <div className="overflow-hidden rounded-3xl border bg-card shadow-sm">
        <div className="relative h-36 bg-sage md:h-44">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {coverUrl && <img src={coverUrl} alt="" className="size-full object-cover" />}
          <div className="absolute right-3 bottom-3 flex gap-2">
            <Button type="button" variant="secondary" size="sm" asChild disabled={coverPick.busy}>
              <label>
                {coverPick.busy ? <Loader2 className="animate-spin" /> : <ImagePlus />} {t.profile.coverImage}
                <input type="file" accept={IMAGE_ACCEPT} className="sr-only" onChange={(e) => void coverPick.pick(e.target.files?.[0])} />
              </label>
            </Button>
            {coverUrl && (
              <Button type="button" variant="secondary" size="icon-sm" onClick={() => setCover(null)} aria-label={t.profile.remove}>
                <X />
              </Button>
            )}
          </div>
        </div>
        <div className="flex items-end gap-4 px-5 pb-5">
          <div className="relative -mt-10">
            <UserAvatar name={user.display_name} src={avatarUrl} className="size-24 border-4 border-card" initialClassName="text-3xl" />
            <label
              className="absolute right-0 bottom-0 flex size-8 cursor-pointer items-center justify-center rounded-full border-2 border-card bg-primary text-primary-foreground"
              aria-label={t.profile.avatar}
            >
              {avatarPick.busy ? <Loader2 className="size-4 animate-spin" /> : <Camera className="size-4" />}
              <input type="file" accept={IMAGE_ACCEPT} className="sr-only" onChange={(e) => void avatarPick.pick(e.target.files?.[0])} />
            </label>
          </div>
          {avatarUrl && (
            <Button type="button" variant="ghost" size="sm" onClick={() => setAvatar(null)}>
              {t.profile.remove}
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-5 rounded-3xl border bg-card p-5 shadow-sm md:p-6">
        <Field label={t.auth.displayName} htmlFor="display_name" error={errors.display_name?.message}>
          <Input id="display_name" className="h-11" aria-invalid={!!errors.display_name} {...form.register("display_name")} />
        </Field>
        <Field label={t.auth.username} htmlFor="username" error={errors.username?.message} hint={t.auth.usernameHint}>
          <Input
            id="username"
            className="h-11"
            aria-invalid={!!errors.username}
            {...form.register("username", { setValueAs: (s: string) => s.toLowerCase() })}
          />
        </Field>
        <Field label={t.profile.bio} htmlFor="bio" optional error={errors.bio?.message}>
          <Textarea id="bio" rows={4} {...form.register("bio")} />
        </Field>
      </div>

      <div className="flex justify-between gap-2">
        <Button asChild variant="ghost">
          <Link href={`/profile/${user.username}`}>{t.profile.viewPublic}</Link>
        </Button>
        <Button type="submit" size="lg" disabled={isSubmitting || avatarPick.busy || coverPick.busy}>
          {isSubmitting && <Loader2 className="animate-spin" />} {t.restaurant.save}
        </Button>
      </div>
    </form>
  )
}

function EditProfile() {
  const { data, isPending } = useMyProfile()
  if (isPending || !data) return <PageSpinner />
  return <EditProfileForm profile={data} />
}

export function EditProfileView() {
  return (
    <RequireAuth>
      <div className="mx-auto grid max-w-2xl gap-6 px-4 py-8 md:py-10">
        <PageHeader title={t.profile.editTitle} />
        <EditProfile />
      </div>
    </RequireAuth>
  )
}
