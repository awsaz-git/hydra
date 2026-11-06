// Strength and endurance levels, shown live on onboarding's level page. The same maths as the
// backend's services/levels.go, on a copy of its tables (level-standards.json); the Go test
// TestFrontendStandardsMatch fails when the copy differs. Go stays the source for anything stored.
// Imports use the .ts extension so Node can run this file directly (npm test).
import standards from "./level-standards.json" with { type: "json" }
import type { Lift, RaceDistance } from "@/lib/types"

export const LEVELS = ["beginner", "novice", "intermediate", "advanced", "elite"] as const
export type Level = (typeof LEVELS)[number]
export type Sex = "male" | "female"

/** Epley (weight × (1 + reps/30)), with sets over 10 reps counted as 10. */
export function estimateOneRepMax(weightKg: number, reps: number): number {
  if (reps <= 1) return weightKg
  return weightKg * (1 + Math.min(reps, 10) / 30)
}

// The bodyweight multiples each level needs at this bodyweight, interpolated between rows.
function levelRatios(sex: Sex, lift: Lift, bodyweightKg: number): number[] {
  const rows = standards.strength[sex][lift]
  const ratioOf = (row: number[], level: number) => row[level + 1] / row[0]
  const first = rows[0]
  const last = rows[rows.length - 1]

  return LEVELS.map((_, level) => {
    if (bodyweightKg <= first[0]) return ratioOf(first, level)
    if (bodyweightKg >= last[0]) return ratioOf(last, level)
    const i = rows.findIndex((row) => row[0] > bodyweightKg)
    const [lo, hi] = [rows[i - 1], rows[i]]
    const f = (bodyweightKg - lo[0]) / (hi[0] - lo[0])
    return ratioOf(lo, level) + f * (ratioOf(hi, level) - ratioOf(lo, level))
  })
}

const LIFT_COLUMN: Record<Lift, number> = { squat: 1, bench: 2, deadlift: 3 }

/**
 * The most anyone at this bodyweight or lighter has lifted. Rows are [class lower bound, squat,
 * bench, deadlift]; a row covers bodyweights above its bound, and lighter classes count too.
 */
export function liftRecord(sex: Sex, lift: Lift, bodyweightKg: number): number {
  let best = 0
  for (const row of standards.liftRecordKg[sex]) {
    if (row[0] >= bodyweightKg) break
    best = Math.max(best, row[LIFT_COLUMN[lift]])
  }
  return best
}

/** One lift's level from a set; null above the record for the bodyweight (the check blocks that). */
export function liftLevel(sex: Sex, lift: Lift, bodyweightKg: number, weightKg: number, reps: number): Level | null {
  const oneRepMax = estimateOneRepMax(weightKg, reps)
  if (oneRepMax > liftRecord(sex, lift, bodyweightKg)) return null
  const ratio = oneRepMax / bodyweightKg
  let level: Level = "beginner"
  levelRatios(sex, lift, bodyweightKg).forEach((needed, i) => {
    if (ratio >= needed) level = LEVELS[i]
  })
  return level
}

/** A race result's level, by its 5 km equivalent (Riegel); null faster than the world record. */
export function enduranceLevel(sex: Sex, distance: RaceDistance, seconds: number): Level | null {
  if (seconds < standards.raceRecordSeconds[sex][distance]) return null
  const fiveK = seconds * Math.pow(5000 / standards.raceMetres[distance], 1.06)
  let level: Level = "beginner"
  standards.fiveKSeconds[sex].forEach((needed, i) => {
    if (fiveK <= needed) level = LEVELS[i]
  })
  return level
}
