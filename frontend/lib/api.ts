/**
 * lib/api.ts
 * Purpose: Central API client for all FastAPI backend calls.
 * Automatically attaches the Supabase JWT token to every request.
 *
 * Uploads (multipart/form-data) bypass the Next.js proxy and hit the
 * backend directly, because Vercel's edge layer mangles multipart bodies
 * sent through rewrites(). JSON requests still use the proxy.
 */

import { createClient } from "@/lib/supabase"

// Public backend URL — used ONLY for direct calls (file uploads).
// Falls back to the proxy path if unset.
const DIRECT_BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || ""

async function getAuthHeader(): Promise<HeadersInit> {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return {}
  return { Authorization: `Bearer ${session.access_token}` }
}

/**
 * Resolve a path. For multipart uploads we hit the backend directly
 * (DIRECT_BACKEND + path-without-/api). For everything else, use the proxy path.
 */
function resolveUrl(path: string, direct: boolean): string {
  if (direct && DIRECT_BACKEND) {
    // strip leading "/api" — backend routes have no /api prefix
    const backendPath = path.replace(/^\/api/, "")
    return `${DIRECT_BACKEND}${backendPath}`
  }
  return path
}

export async function apiPost(path: string, body: FormData | object): Promise<Response> {
  const headers = await getAuthHeader()
  const isFormData = body instanceof FormData
  // File uploads go direct to backend to avoid Vercel multipart mangling
  const url = resolveUrl(path, isFormData)
  return fetch(url, {
    method: "POST",
    headers: isFormData ? headers : { ...headers, "Content-Type": "application/json" },
    body: isFormData ? body : JSON.stringify(body),
  })
}

export async function apiGet(path: string): Promise<Response> {
  const headers = await getAuthHeader()
  return fetch(path, { headers })
}