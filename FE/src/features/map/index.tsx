"use client"

import dynamic from "next/dynamic"
import { Skeleton } from "@/components/ui/skeleton"

export type { LatLng, MapPin } from "./leaflet-maps"

// Leaflet touches `window` on import, so load it on the client only.
const loading = () => <Skeleton className="size-full rounded-none" />

export const LocationPickerMap = dynamic(() => import("./leaflet-maps").then((m) => m.LocationPickerMap), { ssr: false, loading })
export const SinglePinMap = dynamic(() => import("./leaflet-maps").then((m) => m.SinglePinMap), { ssr: false, loading })
export const RestaurantsMap = dynamic(() => import("./leaflet-maps").then((m) => m.RestaurantsMap), { ssr: false, loading })
