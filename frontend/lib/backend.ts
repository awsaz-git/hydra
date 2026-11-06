// The Go backend's address, for server-side code only (the /api proxy and server components).
// Accepts "http://host:port", "http://host:port/" and "http://host:port/api": trailing slashes
// and a trailing /api are stripped, since /api/... is added by the callers.
export const BACKEND_URL = (process.env.BACKEND_URL ?? "http://localhost:8080").replace(/\/+$/, "").replace(/\/api$/, "")
