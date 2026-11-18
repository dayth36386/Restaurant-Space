import { create } from "zustand"

export type Palette = "vivid" | "classic"

export const PALETTE_KEY = "rs-palette"

/** Runs before first paint (inlined in <head>) so the saved palette never flashes. */
export const paletteBootScript = `try{var p=localStorage.getItem("${PALETTE_KEY}");if(p==="classic")document.documentElement.dataset.palette=p}catch(e){}`

function current(): Palette {
  return typeof document !== "undefined" && document.documentElement.dataset.palette === "classic" ? "classic" : "vivid"
}

interface PaletteState {
  palette: Palette
  setPalette: (p: Palette) => void
}

export const usePalette = create<PaletteState>((set) => ({
  palette: current(),
  setPalette: (palette) => {
    if (palette === "vivid") delete document.documentElement.dataset.palette
    else document.documentElement.dataset.palette = palette
    try {
      localStorage.setItem(PALETTE_KEY, palette)
    } catch {}
    set({ palette })
  },
}))
