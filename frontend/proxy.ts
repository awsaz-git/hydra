// Runs before every page and /api request (Next.js 16 renamed middleware.ts to proxy.ts).
// clerkMiddleware reads Clerk's session cookie so auth() works in pages and route handlers.
// It doesn't block anything by itself: each page group and route handler checks auth
// where the data is (Clerk's current advice, since path matching can miss routes).
import { clerkMiddleware } from "@clerk/nextjs/server"

import { SIGN_IN_URL, SIGN_UP_URL } from "@/lib/auth-routes"

export default clerkMiddleware({ signInUrl: SIGN_IN_URL, signUpUrl: SIGN_UP_URL })

export const config = {
  matcher: [
    // Every page, but not Next.js internals or static files (logo, fonts, ...)
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always the API routes
    "/(api|trpc)(.*)",
  ],
}
