"use client"

import dynamic from "next/dynamic"

// three.js is ~600 KB; load it only on pages that show the scene, and never on the server.
export const HeroScene = dynamic(() => import("./hero-scene").then((m) => m.HeroScene), { ssr: false, loading: () => null })
