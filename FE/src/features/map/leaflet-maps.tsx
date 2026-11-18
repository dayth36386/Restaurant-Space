"use client"

import "leaflet/dist/leaflet.css"
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import L from "leaflet"
import { createLeafletContext, LeafletContext, type LeafletContextInterface } from "@react-leaflet/core"
import { Marker, Popup, TileLayer, useMap, useMapEvents } from "react-leaflet"
import { MAP_ATTRIBUTION, MAP_TILE_URL } from "@/lib/config"
import { formatPrice } from "@/lib/i18n"

export type LatLng = { lat: number; lng: number }

export interface MapPin extends LatLng {
  id: string
  name: string
  address?: string | null
  coverUrl?: string | null
  priceMin?: number | null
  priceMax?: number | null
  own?: boolean
}

// Bangkok as the default viewport.
const DEFAULT_CENTER: LatLng = { lat: 13.7563, lng: 100.5018 }

type MapContainerProps = L.MapOptions & { center: L.LatLngExpression; zoom: number; className?: string; children?: ReactNode }

// Replaces react-leaflet's MapContainer, which calls map.remove() in an effect cleanup.
// React re-runs effects without remounting (StrictMode, and <Activity> when cacheComponents
// keeps a visited route alive), so children re-attached to the destroyed map and crashed in
// getPane().appendChild. Here the map lives as long as its DOM node; with trackResize off it
// registers no window listeners, so it is garbage-collected along with the node.
function MapContainer({ center, zoom, className, children, ...options }: MapContainerProps) {
  const [initial] = useState(() => ({ center, zoom, options }))
  const [context, setContext] = useState<LeafletContextInterface | null>(null)
  const created = useRef(false)

  const attach = useCallback(
    (node: HTMLDivElement | null) => {
      if (!node || created.current) return
      created.current = true
      const map = new L.Map(node, { ...initial.options, trackResize: false }).setView(initial.center, initial.zoom)
      setContext(createLeafletContext(map))
    },
    [initial],
  )

  // Follows container resizes as well as window resizes.
  useEffect(() => {
    if (!context) return
    const observer = new ResizeObserver(() => context.map.invalidateSize())
    observer.observe(context.map.getContainer())
    return () => observer.disconnect()
  }, [context])

  return (
    <div ref={attach} className={className}>
      {context && <LeafletContext value={context}>{children}</LeafletContext>}
    </div>
  )
}

// Provider comes from NEXT_PUBLIC_MAP_TILE_URL; attribution is required by every provider.
function Tiles() {
  return <TileLayer attribution={MAP_ATTRIBUTION} url={MAP_TILE_URL} maxZoom={19} />
}

// divIcon avoids Leaflet's default PNG markers, which break under bundlers.
function pinIcon(variant: "primary" | "muted" = "primary") {
  const fill = variant === "primary" ? "var(--primary)" : "var(--muted-foreground)"
  return L.divIcon({
    className: "rs-pin",
    iconSize: [30, 40],
    iconAnchor: [15, 38],
    popupAnchor: [0, -34],
    html: `<svg width="30" height="40" viewBox="0 0 30 40" xmlns="http://www.w3.org/2000/svg" style="filter:drop-shadow(0 2px 3px rgb(0 0 0 / .25))"><path d="M15 39s13-12.3 13-23A13 13 0 0 0 2 16c0 10.7 13 23 13 23Z" fill="${fill}" stroke="white" stroke-width="2"/><circle cx="15" cy="15.5" r="4.5" fill="white"/></svg>`,
  })
}

function ClickToPlace({ onPick }: { onPick: (p: LatLng) => void }) {
  useMapEvents({ click: (e) => onPick({ lat: e.latlng.lat, lng: e.latlng.lng }) })
  return null
}

function FlyTo({ target }: { target: LatLng | null }) {
  const map = useMap()
  useEffect(() => {
    if (target) map.flyTo([target.lat, target.lng], Math.max(map.getZoom(), 15), { duration: 0.6 })
  }, [map, target])
  return null
}

const round = (n: number) => Math.round(n * 1e7) / 1e7

export function LocationPickerMap({
  value,
  onChange,
  flyTarget,
}: {
  value: LatLng | null
  onChange: (p: LatLng) => void
  flyTarget: LatLng | null
}) {
  const icon = useMemo(() => pinIcon(), [])
  const center = value ?? DEFAULT_CENTER
  const pick = (p: LatLng) => onChange({ lat: round(p.lat), lng: round(p.lng) })

  return (
    <MapContainer center={[center.lat, center.lng]} zoom={value ? 15 : 12} scrollWheelZoom className="size-full">
      <Tiles />
      <ClickToPlace onPick={pick} />
      <FlyTo target={flyTarget} />
      {value && (
        <Marker
          position={[value.lat, value.lng]}
          icon={icon}
          draggable
          eventHandlers={{ dragend: (e) => pick((e.target as L.Marker).getLatLng()) }}
        />
      )}
    </MapContainer>
  )
}

export function SinglePinMap({ point }: { point: LatLng }) {
  const icon = useMemo(() => pinIcon(), [])
  return (
    <MapContainer center={[point.lat, point.lng]} zoom={16} scrollWheelZoom={false} className="size-full">
      <Tiles />
      <Marker position={[point.lat, point.lng]} icon={icon} />
    </MapContainer>
  )
}

function FitBounds({ pins }: { pins: MapPin[] }) {
  const map = useMap()
  useEffect(() => {
    if (pins.length === 0) return
    if (pins.length === 1) {
      map.setView([pins[0].lat, pins[0].lng], 15)
      return
    }
    map.fitBounds(L.latLngBounds(pins.map((p) => [p.lat, p.lng])), { padding: [48, 48], maxZoom: 15 })
  }, [map, pins])
  return null
}

/** `scrollZoom=false` for maps embedded in scrolling pages, so the wheel scrolls the page. */
export function RestaurantsMap({ pins, scrollZoom = true }: { pins: MapPin[]; scrollZoom?: boolean }) {
  const ownIcon = useMemo(() => pinIcon("primary"), [])
  const otherIcon = useMemo(() => pinIcon("muted"), [])

  return (
    <MapContainer center={[DEFAULT_CENTER.lat, DEFAULT_CENTER.lng]} zoom={11} scrollWheelZoom={scrollZoom} className="size-full">
      <Tiles />
      <FitBounds pins={pins} />
      {pins.map((p) => (
        <Marker key={p.id} position={[p.lat, p.lng]} icon={p.own ? ownIcon : otherIcon}>
          <Popup minWidth={200}>
            <Link href={`/restaurants/${p.id}`} className="grid gap-2 text-inherit! no-underline">
              {p.coverUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.coverUrl} alt="" className="h-24 w-full rounded-md object-cover" />
              )}
              <span className="font-medium">{p.name}</span>
              {p.address && <span className="line-clamp-2 text-xs opacity-70">{p.address}</span>}
              {formatPrice(p.priceMin, p.priceMax) && <span className="text-xs font-medium">{formatPrice(p.priceMin, p.priceMax)}</span>}
            </Link>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  )
}
