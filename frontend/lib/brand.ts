/**
 * Everything a user sees about the product's identity comes from here (D30), so a
 * rename is an edit to this file + the logo files in public/brand/ (see docs/BRAND.md
 * → "Renaming the product"). Components never hard-code the name.
 *
 * Only what doesn't depend on the language lives here. The tagline and the description are
 * sentences, so they're in messages/<locale>.json under "brand". UI text never hard-codes
 * the name: messages use {brand} / {coach} placeholders, filled from this file.
 */
export const brand: Brand = {
  /** The product name, as written in titles and sentences. */
  name: "Hydra",
  /** The name as drawn next to the logo mark (lowercase by design). */
  wordmark: "hydra",
  /** The coach's persona name in the chat. The backend has its own COACH_NAME setting. */
  coachName: "Hydra",
  /** Not set until there's a domain. Anything that shows it must handle null. */
  supportEmail: null,
  /** The company or person behind the product (privacy policy, emails). Not set yet. */
  legalName: null,
}

type Brand = {
  name: string
  wordmark: string
  coachName: string
  supportEmail: string | null
  legalName: string | null
}
