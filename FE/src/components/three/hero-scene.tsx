"use client"

import { useEffect, useRef } from "react"
import * as THREE from "three"
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js"
import { usePalette } from "@/lib/palette"
import { cn } from "@/lib/utils"

// A glossy noodle bowl with rising steam and brand-coloured map pins orbiting it:
// "every place you want to eat, pinned in one spot". Pure three.js, client only.

const FOOD = { cream: 0xf4efe3, broth: 0xa8551f, noodle: 0xf2d68f, wood: 0x6b4426 }

/** Brand colours come from the active palette's CSS tokens. */
function brandColors() {
  const css = getComputedStyle(document.documentElement)
  const read = (name: string, fallback: string) => new THREE.Color(css.getPropertyValue(name).trim() || fallback)
  return {
    primary: read("--primary", "#ff5a36"),
    primary2: read("--primary-2", "#ff3d81"),
    gold: read("--gold", "#ffb703"),
    mint: read("--mint", "#2ec4a6"),
  }
}
type Brand = ReturnType<typeof brandColors>

function bowl(brand: Brand) {
  const group = new THREE.Group()
  // Lathe profile: foot ring up to a flared rim.
  const profile = [
    [0.0, -0.62],
    [0.42, -0.62],
    [0.46, -0.56],
    [0.5, -0.5],
    [0.78, -0.38],
    [1.02, -0.12],
    [1.16, 0.18],
    [1.22, 0.34],
    [1.18, 0.36],
    [1.1, 0.2],
    [0.96, -0.06],
    [0.72, -0.28],
    [0.0, -0.36],
  ].map(([x, y]) => new THREE.Vector2(x, y))
  const ceramic = new THREE.MeshPhysicalMaterial({
    color: FOOD.cream,
    roughness: 0.28,
    clearcoat: 1,
    clearcoatRoughness: 0.15,
    side: THREE.DoubleSide,
  })
  group.add(new THREE.Mesh(new THREE.LatheGeometry(profile, 96), ceramic))

  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(1.2, 0.035, 16, 120),
    new THREE.MeshPhysicalMaterial({ color: brand.primary, roughness: 0.3, clearcoat: 1 }),
  )
  rim.rotation.x = Math.PI / 2
  rim.position.y = 0.35
  group.add(rim)

  const broth = new THREE.Mesh(
    new THREE.CircleGeometry(1.08, 64),
    new THREE.MeshPhysicalMaterial({ color: FOOD.broth, roughness: 0.12, clearcoat: 1, transparent: true, opacity: 0.94 }),
  )
  broth.rotation.x = -Math.PI / 2
  broth.position.y = 0.16
  group.add(broth)

  // Wavy noodles as tubes just under the broth surface.
  const noodleMat = new THREE.MeshStandardMaterial({ color: FOOD.noodle, roughness: 0.45 })
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2
    const points = Array.from({ length: 8 }, (_, k) => {
      const t = k / 7
      const r = 0.15 + t * 0.75
      return new THREE.Vector3(Math.cos(a + t * 1.6) * r, 0.17 + Math.sin(t * 9 + i) * 0.025, Math.sin(a + t * 1.6) * r)
    })
    group.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 48, 0.022, 8, false), noodleMat))
  }

  // Toppings: meatballs, greens, a soft-boiled egg.
  const meat = new THREE.MeshStandardMaterial({ color: 0x8a5a3c, roughness: 0.6 })
  ;[
    [0.45, 0.2],
    [-0.35, 0.45],
    [0.1, -0.55],
  ].forEach(([x, z]) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.14, 24, 24), meat)
    m.position.set(x, 0.2, z)
    group.add(m)
  })
  const greens = new THREE.MeshStandardMaterial({ color: 0x5fa35a, roughness: 0.5 })
  for (let i = 0; i < 14; i++) {
    const g = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.04, 12), greens)
    const a = Math.random() * Math.PI * 2
    const r = 0.2 + Math.random() * 0.6
    g.position.set(Math.cos(a) * r, 0.19, Math.sin(a) * r)
    g.rotation.set(Math.random(), Math.random(), Math.random())
    group.add(g)
  }
  const egg = new THREE.Group()
  const white = new THREE.Mesh(
    new THREE.SphereGeometry(0.2, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshPhysicalMaterial({ color: 0xfdfaf2, roughness: 0.3, clearcoat: 0.6 }),
  )
  const yolk = new THREE.Mesh(
    new THREE.SphereGeometry(0.1, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshPhysicalMaterial({ color: 0xf0a43a, roughness: 0.2, clearcoat: 1 }),
  )
  yolk.position.y = 0.01
  egg.add(white, yolk)
  egg.scale.set(1.2, 0.55, 1)
  egg.position.set(-0.5, 0.17, -0.2)
  group.add(egg)

  // Chopsticks resting across the rim.
  const wood = new THREE.MeshPhysicalMaterial({ color: FOOD.wood, roughness: 0.35, clearcoat: 0.8 })
  ;[-0.08, 0.08].forEach((dz, i) => {
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.04, 3, 16), wood)
    c.rotation.set(Math.PI / 2 - 0.08, 0, Math.PI / 2 + 0.35 + i * 0.06)
    c.position.set(0.25, 0.46, dz + 0.1)
    group.add(c)
  })
  return group
}

function pin(color: THREE.Color) {
  const group = new THREE.Group()
  const mat = new THREE.MeshPhysicalMaterial({ color, roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.1 })
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 32, 32), mat)
  head.position.y = 0.32
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.36, 32), mat)
  tip.rotation.x = Math.PI
  tip.position.y = 0.08
  const dot = new THREE.Mesh(
    new THREE.SphereGeometry(0.085, 24, 24),
    new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.3, clearcoat: 1 }),
  )
  dot.position.set(0, 0.34, 0.16)
  group.add(head, tip, dot)
  return group
}

function steamTexture() {
  const c = document.createElement("canvas")
  c.width = c.height = 64
  const g = c.getContext("2d")!
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32)
  grad.addColorStop(0, "rgba(255,255,255,0.9)")
  grad.addColorStop(1, "rgba(255,255,255,0)")
  g.fillStyle = grad
  g.fillRect(0, 0, 64, 64)
  return new THREE.CanvasTexture(c)
}

export function HeroScene({ className }: { className?: string }) {
  const host = useRef<HTMLDivElement>(null)
  // Rebuild the scene when the colour palette changes.
  const palette = usePalette((s) => s.palette)

  useEffect(() => {
    const el = host.current
    if (!el) return
    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" })
    } catch {
      return // No WebGL: the container's CSS gradient stays as the fallback.
    }
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.05
    el.appendChild(renderer.domElement)
    renderer.domElement.style.display = "block"

    const scene = new THREE.Scene()
    const brand = brandColors()
    const pmrem = new THREE.PMREMGenerator(renderer)
    const envMap = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
    scene.environment = envMap

    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100)
    const target = new THREE.Vector3(0, 0.45, 0)
    camera.position.set(0, 2.4, 6.4)
    camera.lookAt(target)

    const key = new THREE.DirectionalLight(0xfff1dc, 2.2)
    key.position.set(3, 5, 4)
    const rim = new THREE.DirectionalLight(brand.mint, 1.4)
    rim.position.set(-4, 2, -3)
    scene.add(new THREE.AmbientLight(0xffffff, 0.35), key, rim)

    const world = new THREE.Group()
    scene.add(world)
    const b = bowl(brand)
    b.rotation.x = 0.18
    world.add(b)

    const pinColors = [brand.primary, brand.gold, brand.primary2, brand.mint, brand.primary]
    const pins = pinColors.map((color, i) => {
      const p = pin(color)
      const orbit = {
        r: 1.75 + (i % 3) * 0.3,
        speed: 0.12 + i * 0.03,
        phase: (i / pinColors.length) * Math.PI * 2,
        y: 0.4 + ((i * 37) % 10) / 10,
      }
      p.scale.setScalar(0.85 + (i % 2) * 0.25)
      world.add(p)
      return { p, orbit }
    })

    // Steam: points that rise, drift and fade, then respawn.
    const STEAM = 70
    const steamGeo = new THREE.BufferGeometry()
    const pos = new Float32Array(STEAM * 3)
    const life = new Float32Array(STEAM)
    const respawn = (i: number) => {
      pos[i * 3] = (Math.random() - 0.5) * 1.2
      pos[i * 3 + 1] = 0.3
      pos[i * 3 + 2] = (Math.random() - 0.5) * 1.2
      life[i] = Math.random()
    }
    for (let i = 0; i < STEAM; i++) {
      respawn(i)
      pos[i * 3 + 1] = 0.3 + Math.random() * 1.8
    }
    steamGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3))
    const steamTex = steamTexture()
    const steam = new THREE.Points(
      steamGeo,
      new THREE.PointsMaterial({
        size: 0.45,
        map: steamTex,
        transparent: true,
        opacity: 0.22,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    )
    world.add(steam)

    const resize = () => {
      const { clientWidth: w, clientHeight: h } = el
      if (!w || !h) return
      renderer.setSize(w, h, false)
      renderer.domElement.style.width = "100%"
      renderer.domElement.style.height = "100%"
      camera.aspect = w / h
      // Pull back on narrow or wide-short frames so the orbit stays in view.
      const aspect = w / h
      camera.position.z = aspect < 1 ? 8.8 : aspect > 1.8 ? 7.4 : 6.4
      camera.lookAt(target)
      camera.updateProjectionMatrix()
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(el)

    const pointer = { x: 0, y: 0 }
    const onPointer = (e: PointerEvent) => {
      const r = el.getBoundingClientRect()
      pointer.x = ((e.clientX - r.left) / r.width - 0.5) * 2
      pointer.y = ((e.clientY - r.top) / r.height - 0.5) * 2
    }
    window.addEventListener("pointermove", onPointer, { passive: true })

    const clock = new THREE.Clock()
    let frame = 0
    let visible = true
    const tick = () => {
      const t = clock.getElapsedTime()
      world.rotation.y += (pointer.x * 0.35 - world.rotation.y) * 0.04 + 0.0015
      world.rotation.x += (pointer.y * 0.12 - world.rotation.x) * 0.04
      b.position.y = Math.sin(t * 0.8) * 0.05
      for (const { p, orbit } of pins) {
        const a = orbit.phase + t * orbit.speed
        p.position.set(Math.cos(a) * orbit.r, orbit.y + Math.sin(t * 1.3 + orbit.phase) * 0.15, Math.sin(a) * orbit.r)
        p.rotation.y = -a + Math.PI / 2
      }
      for (let i = 0; i < STEAM; i++) {
        life[i] += 0.004
        pos[i * 3 + 1] += 0.006
        pos[i * 3] += Math.sin(t + i) * 0.0015
        if (pos[i * 3 + 1] > 2.3 || life[i] > 1) respawn(i)
      }
      steamGeo.attributes.position.needsUpdate = true
      renderer.render(scene, camera)
      if (!reduced && visible) frame = requestAnimationFrame(tick)
    }
    tick()

    // Stop rendering while scrolled away or in a background tab.
    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting && document.visibilityState === "visible"
      cancelAnimationFrame(frame)
      if (visible && !reduced) frame = requestAnimationFrame(tick)
    })
    io.observe(el)
    const onVisibility = () => {
      visible = document.visibilityState === "visible"
      cancelAnimationFrame(frame)
      if (visible && !reduced) frame = requestAnimationFrame(tick)
    }
    document.addEventListener("visibilitychange", onVisibility)

    return () => {
      cancelAnimationFrame(frame)
      io.disconnect()
      ro.disconnect()
      window.removeEventListener("pointermove", onPointer)
      document.removeEventListener("visibilitychange", onVisibility)
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh || o instanceof THREE.Points) {
          o.geometry.dispose()
          const m = o.material as THREE.Material | THREE.Material[]
          ;(Array.isArray(m) ? m : [m]).forEach((x) => x.dispose())
        }
      })
      steamTex.dispose()
      envMap.dispose()
      pmrem.dispose()
      renderer.dispose()
      renderer.domElement.remove()
    }
  }, [palette])

  return <div ref={host} className={cn("relative size-full", className)} aria-hidden />
}
