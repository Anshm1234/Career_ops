"use client"

import { useEffect, useRef } from "react"
import { FileText } from "lucide-react"

/**
 * A small resume card that trails the cursor.
 *
 * How it follows the cursor correctly:
 *  - We store the raw cursor position in a ref on every `mousemove` (the "target").
 *  - A `requestAnimationFrame` loop eases the card's *current* position toward the
 *    target using linear interpolation (lerp): current += (target - current) * ease.
 *    This decoupling is what produces the smooth, weighted "trailing" feel instead
 *    of snapping instantly to the pointer.
 *  - The per-frame delta (velocity) is mapped to rotateX / rotateY so the card tilts
 *    in the direction it's moving, then settles flat when the cursor stops.
 */
export function CursorResume() {
  const cardRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Skip on touch / coarse pointers — there is no cursor to follow.
    if (window.matchMedia("(pointer: coarse)").matches) return

    const el = cardRef.current
    if (!el) return

    const target = { x: window.innerWidth / 2, y: window.innerHeight / 2 }
    const current = { x: target.x, y: target.y }
    let visible = false
    let raf = 0

    const onMove = (e: MouseEvent) => {
      target.x = e.clientX
      target.y = e.clientY
      if (!visible) {
        visible = true
        el.style.opacity = "1"
      }
    }

    const onLeave = () => {
      visible = false
      el.style.opacity = "0"
    }

    const ease = 0.14
    const tick = () => {
      const dx = target.x - current.x
      const dy = target.y - current.y
      current.x += dx * ease
      current.y += dy * ease

      // Velocity -> tilt (clamped), with a gentle offset so it sits beside the cursor.
      const rotY = Math.max(-22, Math.min(22, dx * 0.4))
      const rotX = Math.max(-22, Math.min(22, -dy * 0.4))

      el.style.transform = `translate3d(${current.x + 28}px, ${current.y + 28}px, 0) rotateX(${rotX}deg) rotateY(${rotY}deg)`
      raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
    window.addEventListener("mousemove", onMove)
    document.addEventListener("mouseleave", onLeave)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener("mousemove", onMove)
      document.removeEventListener("mouseleave", onLeave)
    }
  }, [])

  return (
    <div
      ref={cardRef}
      aria-hidden="true"
      className="pointer-events-none fixed left-0 top-0 z-50 opacity-0 transition-opacity duration-500 will-change-transform [perspective:800px]"
    >
      <div className="w-44 rounded-xl border border-primary/40 bg-card/90 p-3 shadow-2xl backdrop-blur-md glow-primary">
        <div className="flex items-center gap-2 border-b border-border pb-2">
          <span className="flex size-6 items-center justify-center rounded-md bg-primary/15 text-primary">
            <FileText className="size-3.5" />
          </span>
          <div className="space-y-1">
            <div className="h-1.5 w-16 rounded bg-foreground/70" />
            <div className="h-1 w-10 rounded bg-muted-foreground/50" />
          </div>
        </div>
        <div className="mt-2.5 space-y-1.5">
          <div className="h-1 w-full rounded bg-muted-foreground/30" />
          <div className="h-1 w-4/5 rounded bg-muted-foreground/30" />
          <div className="h-1 w-3/5 rounded bg-muted-foreground/30" />
        </div>
        <div className="mt-2.5 flex items-center justify-between">
          <span className="rounded bg-primary/15 px-1.5 py-0.5 font-mono text-[9px] text-primary">
            resume.pdf
          </span>
          <span className="font-mono text-[9px] text-muted-foreground">parsing…</span>
        </div>
      </div>
    </div>
  )
}
