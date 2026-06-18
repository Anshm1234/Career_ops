import type React from "react"
import { TopNav } from "@/components/dashboard/top-nav"
import { CursorResume } from "@/components/dashboard/cursor-resume"

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen bg-background">
      <TopNav />
      {children}
      <CursorResume />
    </div>
  )
}
