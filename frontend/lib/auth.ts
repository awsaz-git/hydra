// Small helpers shared by the custom auth flows (components/auth/*), built on Clerk's hooks.
import type { useRouter } from "next/navigation"
import type { Errors, FieldError, SetActiveNavigate } from "@clerk/nextjs/types"

import { AFTER_AUTH_URL, RESET_PASSWORD_URL } from "@/lib/auth-routes"

const GENERIC = "Something went wrong. Please try again."

/** The text to show under a field, from Clerk's field error (or null). */
export function fieldError(error: FieldError | null): string | null {
  return error ? (error.longMessage ?? error.message) : null
}

/**
 * The text for an error that isn't about one field: rate limits, a locked account,
 * the bot check failing to load, a network error. Clerk's API messages are already
 * user-facing; anything else gets a generic message (it's in the console for debugging).
 */
export function formError(errors: Errors<unknown>): string | null {
  const error = errors.global?.[0]
  if (!error) return null

  if (error.code === "protect_check_script_load_failed") {
    return "The security check couldn't load. Turn off content blockers for this page and try again."
  }
  if (error.isClerkAPIResponseError()) {
    const first = error.errors[0]
    return first ? (first.longMessage ?? first.message) : GENERIC
  }
  console.error(error)
  return GENERIC
}

/**
 * What finalize() does once sign-in/up is complete: go into the app, or, if Clerk says
 * the session still has a task to do (e.g. replace a compromised password), go there first.
 */
export function afterAuth(router: ReturnType<typeof useRouter>): SetActiveNavigate {
  return ({ session, decorateUrl }) => {
    const target = session?.currentTask?.key === "reset-password" ? RESET_PASSWORD_URL : AFTER_AUTH_URL

    // decorateUrl may turn it into an absolute URL (a Safari cookie refresh); then do a full load
    const url = decorateUrl(target)
    if (url.startsWith("http")) {
      window.location.href = url
    } else {
      router.push(url)
    }
  }
}
