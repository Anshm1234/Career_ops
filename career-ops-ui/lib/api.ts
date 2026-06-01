/**
 * lib/api.ts
 * Purpose: Central API client for all FastAPI backend calls.
 * Automatically attaches the Supabase JWT token to every request
 * so the backend can verify the user's identity.
 */

import { createClient } from "@/lib/supabase"

async function getAuthHeader(): Promise<HeadersInit> {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  console.log("Token being sent:", session?.access_token?.slice(0, 20))
  if (!session) return {}
  return { Authorization: `Bearer ${session.access_token}` }
}

export async function apiPost(path: string, body: FormData | object): Promise<Response> {
    const headers = await getAuthHeader()
    const isFormData = body instanceof FormData
    return fetch(path, {
        method: "POST",
        headers: isFormData ? headers : { ...headers, "Content-Type": "application/json" },
        body: isFormData ? body : JSON.stringify(body),
    })
}

export async function apiGet(path: string): Promise<Response> {
    const headers = await getAuthHeader()
    return fetch(path, { headers })
}