import type React from "react"
import { AppSidebar } from "@/components/dashboard/app-sidebar"

/**
 * Dashboard shell — sidebar nav + scrollable main content.
 * Replaces the old TopNav layout. AppSidebar reads real user name from Supabase.
 */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <AppSidebar />
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  )
}
