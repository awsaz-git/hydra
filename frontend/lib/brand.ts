/**
 * Everything a user sees about the product's identity comes from here (D30), so a
 * rename is an edit to this file + the logo files in public/brand/ (see docs/BRAND.md
 * → "Renaming the product"). Components never hard-code the name.
 *
 * Write text as whole sentences with the name inserted (`Message ${brand.coachName}…`),
 * never glued from fragments, so the i18n step can turn them into next-intl messages
 * with a {coach} placeholder.
 */
export const brand: Brand = {
  /** The product name, as written in titles and sentences. */
  name: "Hydra",
  /** The name as drawn next to the logo mark (lowercase by design). */
  wordmark: "hydra",
  tagline: "your hybrid training coach",
  /** The coach's persona name in the chat. The backend has its own COACH_NAME setting. */
  coachName: "Hydra",
  /** One sentence for metadata and link previews. */
  description: "Your hybrid training coach: strength, speed and running.",
  /** Not set until there's a domain. Anything that shows it must handle null. */
  supportEmail: null,
  /** The company or person behind the product (privacy policy, emails). Not set yet. */
  legalName: null,
}

type Brand = {
  name: string
  wordmark: string
  tagline: string
  coachName: string
  description: string
  supportEmail: string | null
  legalName: string | null
}
