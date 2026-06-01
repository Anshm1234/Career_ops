"use client"

import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"

/**
 * Rotates through a list of words with a typewriter effect.
 */
export function RotatingWords({
  words,
  className,
}: {
  words: string[]
  className?: string
}) {
  const [index, setIndex] = useState(0)
  const [display, setDisplay] = useState("")
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    const current = words[index % words.length]
    let timeout: ReturnType<typeof setTimeout>

    if (!deleting && display === current) {
      timeout = setTimeout(() => setDeleting(true), 1400)
    } else if (deleting && display === "") {
      setDeleting(false)
      setIndex((i) => (i + 1) % words.length)
    } else {
      timeout = setTimeout(
        () => {
          setDisplay((prev) =>
            deleting ? current.slice(0, prev.length - 1) : current.slice(0, prev.length + 1),
          )
        },
        deleting ? 45 : 85,
      )
    }

    return () => clearTimeout(timeout)
  }, [display, deleting, index, words])

  return (
    <span className={cn("relative", className)}>
      {display}
      <span className="ml-0.5 inline-block h-[1em] w-[3px] translate-y-[0.12em] animate-pulse bg-primary align-middle" />
    </span>
  )
}

/**
 * Reveals text one word at a time with a staggered fade-up.
 */
export function FadeUpWords({
  text,
  className,
  delay = 0,
}: {
  text: string
  className?: string
  delay?: number
}) {
  const words = text.split(" ")
  return (
    <span className={className}>
      {words.map((word, i) => (
        <span key={i} className="inline-block overflow-hidden align-bottom">
          <span
            className="inline-block opacity-0 [animation-fill-mode:forwards]"
            style={{
              animation: `fade-up 0.6s cubic-bezier(0.22,1,0.36,1) forwards`,
              animationDelay: `${delay + i * 0.07}s`,
            }}
          >
            {word}
            {i < words.length - 1 ? "\u00A0" : ""}
          </span>
        </span>
      ))}
    </span>
  )
}
