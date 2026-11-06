// The languages the UI supports. The language isn't in the URL (the app is behind a login):
// it comes from a cookie, which the language preference will set later (FEATURE-PLAN 10.4).
// Adding a language = a messages/<locale>.json file + one entry here.
export const locales = ["en"] as const
export type Locale = (typeof locales)[number]

export const defaultLocale: Locale = "en"
export const LOCALE_COOKIE = "locale"

// Languages written right to left. Only used for <html dir>; none is supported yet.
const rtlLocales = new Set(["ar", "fa", "he", "ur"])

export function isLocale(value: string | undefined): value is Locale {
  return locales.includes(value as Locale)
}

export function directionOf(locale: string): "ltr" | "rtl" {
  return rtlLocales.has(locale) ? "rtl" : "ltr"
}
