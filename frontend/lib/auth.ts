// Small helpers shared by the custom auth flows (components/auth/*), built on Clerk's hooks.
import type { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import type { Errors, FieldError, SetActiveNavigate } from "@clerk/nextjs/types"

import { AFTER_AUTH_URL, RESET_PASSWORD_URL } from "@/lib/auth-routes"

/**
 * Turns Clerk's errors into text in the user's language. A Clerk error code we have a
 * message for (messages → auth.clerkErrors) uses ours; any other falls back to Clerk's
 * own English sentence, so an unknown code still shows something sensible.
 */
export function useAuthErrors() {
  const t = useTranslations()

  function textFor(code: string, clerkText: string | undefined): string {
    const key = `auth.clerkErrors.${code}` as Parameters<typeof t>[0]
    return t.has(key) ? t(key) : (clerkText ?? t("errors.internal"))
  }

  return {
    /** The text to show under a field (or null). */
    field(error: FieldError | null): string | null {
      return error ? textFor(error.code, error.longMessage ?? error.message) : null
    },

    /**
     * The text for an error that isn't about one field: rate limits, a locked account,
     * the bot check failing to load, a network error.
     */
    form(errors: Errors<unknown>): string | null {
      const error = errors.global?.[0]
      if (!error) return null

      if (error.code === "protect_check_script_load_failed") return t("auth.securityCheckBlocked")
      if (error.isClerkAPIResponseError()) {
        const first = error.errors[0]
        return first ? textFor(first.code, first.longMessage ?? first.message) : t("errors.internal")
      }
      console.error(error) // not from Clerk's API (e.g. a network error): the detail is for debugging
      return t("errors.internal")
    },
  }
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
