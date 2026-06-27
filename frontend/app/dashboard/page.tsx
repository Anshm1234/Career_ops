import { redirect } from "next/navigation"

// The dashboard home is the matched-jobs feed.
export default function DashboardPage() {
  redirect("/dashboard/jobs")
}
