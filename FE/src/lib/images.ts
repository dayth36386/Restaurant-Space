// Mirrors the backend upload limits (JPEG/PNG/WebP, 8 MiB). The server still
// re-validates the actual file signature and dimensions.
export const IMAGE_ACCEPT = "image/jpeg,image/png,image/webp"
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024
export const MAX_RESTAURANT_IMAGES = 20

export function imageFileError(file: File): string | null {
  if (!IMAGE_ACCEPT.split(",").includes(file.type)) return `${file.name}: รองรับเฉพาะ JPEG, PNG หรือ WebP`
  if (file.size > MAX_IMAGE_BYTES) return `${file.name}: ไฟล์ใหญ่เกิน 8 MB`
  return null
}
