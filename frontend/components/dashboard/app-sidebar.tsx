"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Briefcase, BookOpen, User, ChevronRight,
  Wand2, Send, LayoutDashboard,
} from "lucide-react"
import { createClient } from "@/lib/supabase"
import { Logo } from "@/components/logo"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"

const NAV = [
  { href: "/dashboard/jobs",    label: "Matches",    icon: Briefcase },
  { href: "/dashboard/tracker", label: "Tracker",    icon: BookOpen  },
  { href: "/dashboard/profile", label: "Profile",    icon: User      },
]

const COMING_SOON = [
  { label: "Auto-apply", icon: Send },
]

export function AppSidebar() {
  const pathname = usePathname()
  const [userName,    setUserName]    = useState("")
  const [userEmail,   setUserEmail]   = useState("")
  const [initials,    setInitials]    = useState("??")

  useEffect(() => {
    const supabase = createClient()
    // Try profile_data first (set during onboarding), fall back to auth metadata
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      setUserEmail(user.email || "")

      const { data: profileRow } = await supabase
        .from("profiles")
        .select("profile_data")
        .eq("user_id", user.id)
        .single()

      const name =
        profileRow?.profile_data?.name ||
        user.user_metadata?.full_name ||
        user.user_metadata?.name ||
        user.email?.split("@")[0] ||
        "You"

      setUserName(name)
      setInitials(
        name.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase()
      )
    })
  }, [])

  return (
    <aside className="flex h-screen w-60 shrink-0 flex-col border-r border-border bg-background">
      {/* Logo — links back to public landing page */}
      <div className="flex h-16 items-center border-b border-border px-5">
        <Link href="/" title="Back to home" className="transition-opacity hover:opacity-70">
          <Logo />
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-4">
        <p className="mb-1 px-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground/40">
          Navigation
        </p>
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/")
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-secondary text-foreground"
                  : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground",
              )}
            >
              <Icon className="size-4 shrink-0" />
              {label}
              {active && <ChevronRight className="ml-auto size-3.5 text-muted-foreground/40" />}
            </Link>
          )
        })}

        {/* Tools — live features launched from a job match */}
        <p className="mb-1 mt-5 px-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground/40">
          Tools
        </p>
        <Link
          href="/dashboard/jobs"
          title="Open a job match and press Tailor"
          className="group flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary/50 hover:text-foreground"
        >
          <Wand2 className="size-4 shrink-0" />
          Resume tailoring
          <span className="ml-auto rounded-full border border-border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-widest text-muted-foreground/50 group-hover:hidden">
            live
          </span>
          <span className="ml-auto hidden whitespace-nowrap rounded-full border border-border px-1.5 py-0.5 font-mono text-[9px] tracking-widest text-foreground/70 group-hover:inline">
            select a job →
          </span>
        </Link>

        {/* Coming soon */}
        <p className="mb-1 mt-5 px-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground/40">
          Coming soon
        </p>
        {COMING_SOON.map(({ label, icon: Icon }) => (
          <div
            key={label}
            className="flex cursor-not-allowed items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground/30"
          >
            <Icon className="size-4 shrink-0" />
            {label}
            <span className="ml-auto rounded-full border border-border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-widest text-muted-foreground/30">
              soon
            </span>
          </div>
        ))}
      </nav>

      {/* User info at bottom */}
      <div className="border-t border-border p-3">
        <Link
          href="/dashboard/profile"
          className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-secondary/50"
        >
          <Avatar className="size-8 border border-border">
            <AvatarFallback className="bg-secondary text-xs font-medium">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-foreground">{userName}</p>
            <p className="truncate font-mono text-[10px] text-muted-foreground/50">{userEmail}</p>
          </div>
        </Link>
      </div>
    </aside>
  )
}
