// Turns an API error into text in the user's language (messages → errors.<code>).
import { useCallback } from "react"
import { useTranslations } from "next-intl"

import { ApiError } from "@/lib/api"
import { brand } from "@/lib/brand"

/**
 * Returns a function that gives the message for any caught error. The backend's code picks
 * the text and its params fill it in; an unknown code, or an error that isn't from the API,
 * gets the generic message. Never shows the backend's English `message`.
 */
export function useErrorMessage() {
  const t = useTranslations("errors")

  return useCallback((error: unknown): string => {
    if (error instanceof ApiError) {
      const key = error.code as Parameters<typeof t>[0]
      if (t.has(key)) {
        // Some texts name the coach or the product; the API doesn't send those.
        return t(key, { ...error.params, coach: brand.coachName, brand: brand.name } as never)
      }
    }
    return t("internal")
  }, [t])
}
