// Unit maths for showing and typing measurements. Exact constants, the same as the backend's
// services/units.go; both have tests. The API stores kg, cm and seconds; Go is the only place
// that converts what users submit (D23). This file converts for display and for the form fields.

export const KG_PER_LB = 0.45359237
export const CM_PER_IN = 2.54

export type UnitSystem = "metric" | "imperial"

export const kgToLb = (kg: number) => kg / KG_PER_LB
export const lbToKg = (lb: number) => lb * KG_PER_LB
export const cmToIn = (cm: number) => cm / CM_PER_IN
export const inToCm = (inches: number) => inches * CM_PER_IN

/** Rounds to a number of decimals, for display (e.g. 81.64 → 81.6). */
export function round(value: number, decimals = 1): number {
  const scale = 10 ** decimals
  return Math.round(value * scale) / scale
}

/** A height in cm as whole feet and inches (177.8 cm → 5 ft 10 in). */
export function cmToFeetInches(cm: number): { feet: number; inches: number } {
  const total = Math.round(cmToIn(cm))
  return { feet: Math.floor(total / 12), inches: total % 12 }
}

/** Seconds as h:mm:ss, or m:ss under an hour (755 → "12:35", 7170 → "1:59:30"). */
export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.round(seconds % 60)
  const mm = h > 0 ? String(m).padStart(2, "0") : String(m)
  return `${h > 0 ? `${h}:` : ""}${mm}:${String(s).padStart(2, "0")}`
}

/** Parses "m:ss" or "h:mm:ss" into seconds; null if it isn't a time. */
export function parseDuration(text: string): number | null {
  const match = text.trim().match(/^(?:(\d{1,2}):)?(\d{1,2}):(\d{2})$/)
  if (!match) return null
  const [, h = "0", m, s] = match
  if (Number(s) > 59 || (match[1] !== undefined && Number(m) > 59)) return null
  return Number(h) * 3600 + Number(m) * 60 + Number(s)
}
