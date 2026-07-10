import { createServerClient } from "@supabase/ssr"
import type { EmailOtpType } from "@supabase/supabase-js"
import { type NextRequest, NextResponse } from "next/server"

/**
 * app/auth/confirm/route.ts
 * Purpose: Email-confirmation landing for NEW signups (token-hash flow).
 *
 * Why this exists: the PKCE `?code=` flow in /auth/callback requires the
 * code-verifier cookie from the browser that INITIATED signup. Confirmation
 * links opened in a mail app or another browser don't have it, so the
 * exchange fails and the user is forced to sign in again. verifyOtp with a
 * token_hash is self-contained — it works in any browser and establishes the
 * session server-side, so new users land directly on /onboarding.
 *
 * Requires the Supabase "Confirm signup" email template to link to:
 *   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const token_hash = searchParams.get("token_hash")
  const type = searchParams.get("type") as EmailOtpType | null

  if (!token_hash || !type) {
    return NextResponse.redirect(`${origin}/login?error=confirm`)
  }

  // Buffer cookies written by verifyOtp so we can attach them explicitly to
  // the redirect response (same pattern as /auth/callback — without it the
  // session cookies are missing from the redirect and middleware bounces).
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

  const { error } = await supabase.auth.verifyOtp({ type, token_hash })

  if (error) {
    // Link expired or already used — the account may still be confirmed,
    // so send them to sign in with a clear message.
    return NextResponse.redirect(`${origin}/login?error=confirm_expired`)
  }

  // Session is now active. New users → onboarding; already-onboarded
  // users (e.g. email-change confirmations) → dashboard.
  let destination = "/onboarding"
  const { data: { user } } = await supabase.auth.getUser()
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("profile_data")
      .eq("user_id", user.id)
      .single()

    if (profile?.profile_data?.onboarding_complete === true) {
      destination = "/dashboard/jobs"
    }
  }

  const response = NextResponse.redirect(`${origin}${destination}`)
  cookieBuffer.forEach(({ name, value, options }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    response.cookies.set(name, value, options as any)
  })

  return response
}
