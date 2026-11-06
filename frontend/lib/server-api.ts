// Calls to the Go backend from the Next.js server (server components and layouts),
// with the signed-in user's Clerk token. The browser uses lib/api.ts instead (auth() from
// @clerk/nextjs/server only works on the server, so this can't end up in browser code).
import { auth } from "@clerk/nextjs/server"

import { BACKEND_URL } from "@/lib/backend"
import type { MeStatus } from "@/lib/types"

/**
 * The user's onboarding and consent status, or null if it can't be read (signed out, or the
 * backend is down). Callers treat null as "don't redirect": the page then shows the error itself.
 */
export async function getMe(): Promise<MeStatus | null> {
  const token = await (await auth()).getToken()
  if (!token) return null
  try {
    const res = await fetch(`${BACKEND_URL}/api/me`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    })
    return res.ok ? ((await res.json()) as MeStatus) : null
  } catch {
    return null
  }
}
