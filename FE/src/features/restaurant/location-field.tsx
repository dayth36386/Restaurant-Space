"use client"

import { useState } from "react"
import { Crosshair, Loader2, MapPinOff } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { LocationPickerMap, type LatLng } from "@/features/map"
import { t } from "@/lib/i18n"

export function LocationField({ value, onChange }: { value: LatLng | null; onChange: (v: LatLng | null) => void }) {
  const [flyTarget, setFlyTarget] = useState<LatLng | null>(null)
  const [locating, setLocating] = useState(false)

  const locate = () => {
    if (!navigator.geolocation) return
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const p = { lat: Math.round(coords.latitude * 1e7) / 1e7, lng: Math.round(coords.longitude * 1e7) / 1e7 }
        onChange(p)
        setFlyTarget(p)
        setLocating(false)
      },
      (err) => {
        toast.error(err.message)
        setLocating(false)
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    )
  }

  return (
    <div className="grid gap-2">
      <div className="h-72 overflow-hidden rounded-lg md:h-80">
        <LocationPickerMap value={value} onChange={onChange} flyTarget={flyTarget} />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">{value ? `${value.lat.toFixed(6)}, ${value.lng.toFixed(6)}` : t.restaurant.noPin}</p>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={locate} disabled={locating}>
            {locating ? <Loader2 className="animate-spin" /> : <Crosshair />} {t.restaurant.useMyLocation}
          </Button>
          {value && (
            <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)}>
              <MapPinOff /> {t.restaurant.clearPin}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
