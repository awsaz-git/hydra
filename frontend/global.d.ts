// Types next-intl's t() against the English messages: a missing or mistyped key is a
// TypeScript error, not a raw key on screen. en.json is the source of truth for keys.
import type messages from "./messages/en.json"
import type { Locale } from "./i18n/config"

declare module "next-intl" {
  interface AppConfig {
    Locale: Locale
    Messages: typeof messages
  }
}
