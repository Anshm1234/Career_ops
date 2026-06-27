"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { cn } from "@/lib/utils"

const NAV_LINKS = [
  { label: "How it works", href: "#how-it-works" },
  { label: "Features",     href: "#features" },
  { label: "Pricing",      href: "#pricing" },
]

export function LandingNavbar() {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60)
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  function smoothScroll(e: React.MouseEvent<HTMLAnchorElement>, href: string) {
    if (!href.startsWith("#")) return
    e.preventDefault()
    document.querySelector(href)?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  return (
    <div className="fixed top-5 left-0 right-0 z-50 flex justify-center px-4">
      <nav
        className={cn(
          "flex items-center gap-6 rounded-full border border-border px-5 py-2.5 transition-all duration-300",
          scrolled
            ? "bg-background/95 shadow-lg shadow-black/20 backdrop-blur-xl"
            : "bg-background/60 backdrop-blur-md",
        )}
      >
        {/* Wordmark */}
        <Link
          href="/"
          className="font-semibold tracking-tight text-foreground text-sm whitespace-nowrap"
        >
          Career<span className="text-primary">Ops</span>
        </Link>

        {/* Divider */}
        <div className="h-4 w-px bg-border" />

        {/* Anchor links */}
        <div className="hidden items-center gap-1 sm:flex">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={(e) => smoothScroll(e, link.href)}
              className="rounded-full px-3 py-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {link.label}
            </a>
          ))}
        </div>

        {/* CTA */}
        <Link
          href="/login"
          className="rounded-full bg-foreground px-4 py-1.5 text-sm font-medium text-background transition-opacity hover:opacity-80"
        >
          Try Now
        </Link>
      </nav>
    </div>
  )
}
