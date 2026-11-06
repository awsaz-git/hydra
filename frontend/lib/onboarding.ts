// The onboarding answers and the logic around them (kept out of the components so it can be
// tested: node --test). Imports use the .ts extension so Node can run this file directly.
import type { Lift, OnboardingInput, RaceDistance } from "@/lib/types"
import { enduranceLevel, liftLevel, type Level } from "./levels.ts"
import { cmToFeetInches, inToCm, kgToLb, lbToKg, parseDuration, round, type UnitSystem } from "./units.ts"

export const STEPS = 4

/** Everything the onboarding pages collect, as typed (strings for the number fields). */
export type Answers = {
  birthDate: string
  units: UnitSystem
  sex: "male" | "female" | null
  heightCm: string
  heightFt: string
  heightIn: string
  weight: string
  groups: string[]
  /** The level cards: a lift or the race counts only if the user picked its card. */
  lifts: Record<Lift, { selected: boolean; weight: string; reps: string }>
  race: { selected: boolean; distance: RaceDistance; time: string }
}

const LIFTS: Lift[] = ["squat", "bench", "deadlift"]

export const emptyAnswers: Answers = {
  birthDate: "",
  units: "metric",
  sex: null,
  heightCm: "",
  heightFt: "",
  heightIn: "",
  weight: "",
  groups: [],
  lifts: {
    squat: { selected: false, weight: "", reps: "" },
    bench: { selected: false, weight: "", reps: "" },
    deadlift: { selected: false, weight: "", reps: "" },
  },
  race: { selected: false, distance: "5k", time: "" },
}

/** Under 16 on today's date (the backend checks again; this just answers instantly). */
export function isUnder16(birthDate: string): boolean {
  const [y, m, d] = birthDate.split("-").map(Number)
  const sixteenth = new Date(y + 16, m - 1, d)
  return sixteenth > new Date()
}

/** The answers so far as the API wants them: pages up to `step`, measurements as {value, unit}. */
export function toInput(a: Answers, step: number): OnboardingInput {
  const input: OnboardingInput = { birth_date: a.birthDate }
  if (step < 2) return input
  const metric = a.units === "metric"
  input.units = a.units
  input.sex = a.sex ?? undefined
  input.height = metric
    ? { value: Number(a.heightCm), unit: "cm" }
    : { value: Number(a.heightFt) * 12 + Number(a.heightIn || 0), unit: "in" } // feet + inches as inches
  input.weight = { value: Number(a.weight), unit: metric ? "kg" : "lb" }
  if (step < 3) return input
  input.athlete_groups = a.groups // the main group isn't asked: it's set later
  if (step < 4) return input
  for (const lift of LIFTS) {
    const l = a.lifts[lift]
    input[lift] = l.selected ? { weight: { value: Number(l.weight), unit: metric ? "kg" : "lb" }, reps: Number(l.reps) } : null
  }
  input.endurance = a.race.selected ? { distance: a.race.distance, seconds: parseDuration(a.race.time) ?? 0 } : null
  return input
}

/** Switching metric/imperial keeps what was typed meaning the same height and weights. */
export function convertUnits(a: Answers, to: UnitSystem): Answers {
  if (a.units === to) return a
  const kgOrLb = (text: string) => {
    if (text === "") return ""
    return String(round(to === "imperial" ? kgToLb(Number(text)) : lbToKg(Number(text)), 1))
  }
  const next: Answers = { ...a, units: to, weight: kgOrLb(a.weight), lifts: { ...a.lifts } }
  for (const lift of LIFTS) next.lifts[lift] = { ...a.lifts[lift], weight: kgOrLb(a.lifts[lift].weight) }
  if (to === "imperial" && a.heightCm !== "") {
    const { feet, inches } = cmToFeetInches(Number(a.heightCm))
    next.heightFt = String(feet)
    next.heightIn = String(inches)
  } else if (to === "metric" && a.heightFt !== "") {
    next.heightCm = String(round(inToCm(Number(a.heightFt) * 12 + Number(a.heightIn || 0)), 1))
  }
  return next
}


/**
 * The level a picked card shows live: null until it's filled in with something the checks would
 * accept (the same ranges as the backend: bodyweight 30–300 kg, lifts 1–500 kg × 1–15 reps).
 */
export function liveLevel(a: Answers, card: Lift | "race"): Level | null {
  const toKg = (text: string) => (a.units === "metric" ? Number(text) : lbToKg(Number(text)))
  const bodyweight = toKg(a.weight)
  if (!a.sex || !(bodyweight >= 30 && bodyweight <= 300)) return null

  if (card === "race") {
    const seconds = parseDuration(a.race.time)
    return a.race.selected && seconds ? enduranceLevel(a.sex, a.race.distance, seconds) : null
  }
  const l = a.lifts[card]
  const kg = toKg(l.weight)
  const reps = Number(l.reps)
  if (!l.selected || l.weight === "" || !(kg >= 1 && kg <= 500) || !Number.isInteger(reps) || reps < 1 || reps > 15) return null
  return liftLevel(a.sex, card, bodyweight, kg, reps)
}

// Which answers each checked field is made of (the backend's finding.field names).
const FIELD_INPUTS: Record<string, (a: Answers) => unknown> = {
  birth_date: (a) => a.birthDate,
  sex: (a) => a.sex,
  height: (a) => [a.units, a.heightCm, a.heightFt, a.heightIn],
  weight: (a) => [a.units, a.weight],
  athlete_groups: (a) => a.groups,
  squat: (a) => [a.units, a.lifts.squat],
  bench: (a) => [a.units, a.lifts.bench],
  deadlift: (a) => [a.units, a.lifts.deadlift],
  endurance: (a) => a.race,
}

/** The checked fields whose answers differ between a and b. */
export function changedFields(a: Answers, b: Answers): string[] {
  return Object.keys(FIELD_INPUTS).filter((f) => JSON.stringify(FIELD_INPUTS[f](a)) !== JSON.stringify(FIELD_INPUTS[f](b)))
}

/** A field has enough typed to show its live check (no "fill this in" while you're still typing). */
export function isComplete(a: Answers, field: string): boolean {
  switch (field) {
    case "birth_date":
      return a.birthDate !== ""
    case "height":
      return a.units === "metric" ? a.heightCm !== "" : a.heightFt !== ""
    case "weight":
      return a.weight !== ""
    case "squat":
    case "bench":
    case "deadlift": {
      const l = a.lifts[field]
      return l.selected && l.weight !== "" && l.reps !== ""
    }
    case "endurance":
      return a.race.selected && a.race.time !== ""
    default:
      return true
  }
}
