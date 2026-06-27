import { createServerClient } from "@supabase/ssr"
import { type NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=auth`)
  }

  // Buffer cookies written by exchangeCodeForSession so we can attach them
  // explicitly to the redirect response. If we omit this step the session
  // tokens are not in the Set-Cookie headers on the redirect, and the very
  // next request arrives without a session (middleware then bounces to '/').
  const cookieBuffer: { name: string; value: string; options: object }[] = []

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach((c) => cookieBuffer.push(c))
        },
      },
    }
  )

  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    return NextResponse.redirect(`${origin}/login?error=auth`)
  }

  // Determine redirect destination based on onboarding status
  let destination = "/onboarding"   // default: new user

  // Explicit allowlist — only these paths are valid redirect targets.
  // Replaces the startsWith("/") heuristic to prevent open-redirect abuse.
  const ALLOWED_NEXT: ReadonlySet<string> = new Set([
    "/dashboard/jobs",
    "/dashboard/tracker",
    "/dashboard/profile",
    "/onboarding",
  ])

  const { data: { user } } = await supabase.auth.getUser()
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("profile_data")
      .eq("user_id", user.id)
      .single()

    if (profile?.profile_data?.onboarding_complete === true) {
      const next = searchParams.get("next") ?? ""
      destination = ALLOWED_NEXT.has(next) ? next : "/dashboard/jobs"
    }
  }

  // Build the redirect and attach session cookies onto it
  const response = NextResponse.redirect(`${origin}${destination}`)
  cookieBuffer.forEach(({ name, value, options }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    response.cookies.set(name, value, options as any)
  })

  return response
}
