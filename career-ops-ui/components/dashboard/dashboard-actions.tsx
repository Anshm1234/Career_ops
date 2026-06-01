"use client"

import Link from "next/link"
import { ArrowUpRight, UploadCloud } from "lucide-react"
import { UploadResumeDialog } from "@/components/dashboard/upload-resume-dialog"
import { Button, buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function DashboardActions() {
  return (
    <div className="flex flex-wrap items-center gap-3 pt-8">
      <UploadResumeDialog>
        <Button size="lg" className="group h-12 px-6 text-base glow-primary">
          <UploadCloud className="size-5" />
          Upload resume
        </Button>
      </UploadResumeDialog>
      <Link
        href="/dashboard/jobs"
        className={cn(
          buttonVariants({ size: "lg", variant: "outline" }),
          "h-12 bg-transparent px-6 text-base",
        )}
      >
        View matches
        <ArrowUpRight className="size-4" />
      </Link>
    </div>
  )
}
