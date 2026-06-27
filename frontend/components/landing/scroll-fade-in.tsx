"use client"

import { useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"

interface ScrollFadeInProps {
  children: React.ReactNode
  className?: string
  delay?: number
  direction?: "up" | "down" | "left" | "right" | "none"
  /**
   * oneShot: stay visible after first intersection (default false = bidirectional).
   * Bidirectional = fades out when scrolled back out of view.
   */
  oneShot?: boolean
  threshold?: number
}

export function ScrollFadeIn({
  children,
  className,
  delay = 0,
  direction = "up",
  oneShot = false,
  threshold = 0.12,
}: ScrollFadeInProps) {
  const ref     = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  const [reduced, setReduced] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
    setReduced(mq.matches)
    if (mq.matches) { setVisible(true); return }

    const el = ref.current
    if (!el) return

    const obs = new IntersectionObserver(
      ([entry]) => {
        setVisible(entry.isIntersecting)
        if (entry.isIntersecting && oneShot) obs.disconnect()
      },
      { threshold },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [oneShot, threshold])

  if (reduced) return <div className={className}>{children}</div>

  const offset =
    direction === "up"    ? "translateY(28px)"  :
    direction === "down"  ? "translateY(-28px)" :
    direction === "left"  ? "translateX(-28px)" :
    direction === "right" ? "translateX(28px)"  : "none"

  return (
    <div
      ref={ref}
      className={cn(className)}
      style={{
        opacity:    visible ? 1 : 0,
        transform:  visible ? "none" : offset,
        transition: `opacity 0.55s ease ${delay}ms, transform 0.55s cubic-bezier(0.22,1,0.36,1) ${delay}ms`,
      }}
    >
      {children}
    </div>
  )
}

/**
 * useVisible — returns { ref, visible } for driving internal card animations.
 * Bidirectional: tracks both enter and exit of viewport.
 */
export function useVisible(threshold = 0.2) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
    if (mq.matches) { setVisible(true); return }

    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { threshold },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [threshold])

  return { ref, visible }
}
