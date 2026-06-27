import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

export async function updateSession(request: NextRequest) {
  // Demo mode — skip all auth checks so /dashboard is reachable without a session.
  if (process.env.NEXT_PUBLIC_DEMO_MODE === "true") {
    return NextResponse.next({ request })
  }

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const pathname = request.nextUrl.pathname

  // Unauthenticated: protect /dashboard and /onboarding
  if (!user) {
    if (pathname.startsWith("/dashboard") || pathname === "/onboarding") {
      const url = request.nextUrl.clone()
      url.pathname = "/"
      return NextResponse.redirect(url)
    }
    return supabaseResponse
  }

  // Authenticated: check onboarding for /login and /dashboard/** only.
  // "/" is intentionally public — everyone sees the landing page first.
  const needsOnboardingCheck =
    pathname === "/login" || pathname.startsWith("/dashboard")

  if (needsOnboardingCheck) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("profile_data")
      .eq("user_id", user.id)
      .single()

    const onboarded = profile?.profile_data?.onboarding_complete === true

    if (pathname === "/login") {
      // Authenticated users hitting /login → bounce straight to the app
      const url = request.nextUrl.clone()
      url.pathname = onboarded ? "/dashboard/jobs" : "/onboarding"
      return NextResponse.redirect(url)
    }

    if (!onboarded && pathname.startsWith("/dashboard")) {
      // Block dashboard access until onboarding is done
      const url = request.nextUrl.clone()
      url.pathname = "/onboarding"
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}