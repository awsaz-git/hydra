// Forwards /api/* from the browser to the Go backend.
// Why: the browser only ever talks to Next.js, so there's no CORS to configure,
// and the backend's address (BACKEND_URL) stays a server-side setting.
import type { NextRequest } from "next/server"

// Accept "http://host:port", "http://host:port/" and "http://host:port/api":
// strip trailing slashes and a trailing /api, since /api/... is added below.
const BACKEND_URL = (process.env.BACKEND_URL ?? "http://localhost:8080").replace(/\/+$/, "").replace(/\/api$/, "")
console.log(`[proxy] forwarding /api/* to ${BACKEND_URL}`)

async function forward(req: NextRequest, ctx: RouteContext<"/api/[...path]">) {
  const { path } = await ctx.params
  const url = `${BACKEND_URL}/api/${path.join("/")}`

  try {
    const res = await fetch(url, {
      method: req.method,
      headers: { "Content-Type": "application/json" },
      body: req.method === "GET" || req.method === "DELETE" ? undefined : await req.text(),
      cache: "no-store",
    })
    return new Response(res.status === 204 ? null : res.body, {
      status: res.status,
      headers: { "Content-Type": res.headers.get("Content-Type") ?? "application/json" },
    })
  } catch {
    // Backend not running / unreachable
    return Response.json({ error: "Can't reach the backend. Is it running?" }, { status: 503 })
  }
}

export { forward as GET, forward as POST, forward as DELETE }
