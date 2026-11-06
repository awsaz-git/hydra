// Forwards /api/* from the browser to the Go backend, with the user's Clerk token.
// Why: the browser only ever talks to Next.js, so there's no CORS to configure,
// and the backend's address (BACKEND_URL) stays a server-side setting.
// Only our own headers go to Go (never the browser's as-is), and the token is fetched
// here on the server: page JavaScript never handles it.
import type { NextRequest } from "next/server"
import { auth } from "@clerk/nextjs/server"

// Accept "http://host:port", "http://host:port/" and "http://host:port/api":
// strip trailing slashes and a trailing /api, since /api/... is added below.
const BACKEND_URL = (process.env.BACKEND_URL ?? "http://localhost:8080").replace(/\/+$/, "").replace(/\/api$/, "")
console.log(`[proxy] forwarding /api/* to ${BACKEND_URL}`)

async function forward(req: NextRequest, ctx: RouteContext<"/api/[...path]">) {
  // Signed out (or a session that isn't finished, e.g. a pending task): stop here.
  // Go checks the token again on every request; this just saves the round trip.
  const { userId, getToken } = await auth()
  const token = userId ? await getToken() : null
  if (!token) {
    return Response.json(
      { error: { code: "not_signed_in", message: "Not signed in" } },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    )
  }

  const { path } = await ctx.params
  const url = `${BACKEND_URL}/api/${path.join("/")}`

  try {
    const res = await fetch(url, {
      method: req.method,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: req.method === "GET" || req.method === "DELETE" ? undefined : await req.text(),
      cache: "no-store",
    })
    const headers = new Headers({
      "Content-Type": res.headers.get("Content-Type") ?? "application/json",
      "Cache-Control": "no-store", // one user's data: never cached
    })
    const retryAfter = res.headers.get("Retry-After") // on 429: how long to wait
    if (retryAfter) headers.set("Retry-After", retryAfter)

    return new Response(res.status === 204 ? null : res.body, { status: res.status, headers })
  } catch {
    // Backend not running / unreachable
    return Response.json(
      { error: { code: "backend_unreachable", message: "Can't reach the backend. Is it running?" } },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    )
  }
}

export { forward as GET, forward as POST, forward as DELETE }
