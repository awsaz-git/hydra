// Run with: npm test. The same cases as backend/services/levels_test.go.
import { test } from "node:test"
import assert from "node:assert/strict"

import { enduranceLevel, estimateOneRepMax, liftLevel, liftRecord } from "./levels.ts"

test("one-rep max (Epley, capped at 10 reps)", () => {
  assert.equal(estimateOneRepMax(100, 1), 100)
  assert.ok(Math.abs(estimateOneRepMax(100, 5) - 116.6667) < 1e-3)
  assert.ok(Math.abs(estimateOneRepMax(100, 15) - 133.3333) < 1e-3)
})

test("lift levels against the bodyweight table", () => {
  // 80 kg man: elite squat is 180 kg (a table row).
  assert.equal(liftLevel("male", "squat", 80, 180, 1), "elite")
  assert.equal(liftLevel("male", "squat", 80, 179, 1), "advanced")
  assert.equal(liftLevel("male", "squat", 80, 40, 1), "beginner")
  // Between rows (82.5 kg) and outside the table (160 kg) use the interpolated / nearest ratios.
  // At 82.5 kg elite is halfway between 180/80 and 191/85 = 2.2485×, so 185.5 kg.
  assert.equal(liftLevel("male", "squat", 82.5, 186, 1), "elite")
  assert.equal(liftLevel("male", "squat", 82.5, 185, 1), "advanced")
  assert.equal(liftLevel("male", "bench", 160, 242, 1), "elite") // 1.51× ≥ the heaviest row's 211/140 = 1.507×
  // Over the record for the bodyweight: no level (the check blocks it). 65 kg man, 200 × 6 bench ≈ 240 kg.
  assert.equal(liftLevel("male", "bench", 65, 200, 6), null)
  assert.equal(liftLevel("male", "deadlift", 80, 500, 1), null)
})

test("records by bodyweight (the same cases as Go's TestLiftRecord)", () => {
  assert.equal(liftRecord("male", "bench", 65), 222.5)
  assert.equal(liftRecord("male", "bench", 66), 222.5)
  assert.equal(liftRecord("male", "bench", 66.1), 250.5)
  assert.equal(liftRecord("male", "squat", 58), 292.5) // the lighter 53 kg class's record is higher
  assert.equal(liftRecord("male", "squat", 200), 525)
  assert.equal(liftRecord("female", "deadlift", 100), 297.5)
})

test("endurance levels (Riegel to a 5 km time)", () => {
  assert.equal(enduranceLevel("male", "5k", 18 * 60 + 8), "elite")
  assert.equal(enduranceLevel("male", "5k", 18 * 60 + 9), "advanced")
  assert.equal(enduranceLevel("female", "5k", 50 * 60), "beginner")
  assert.equal(enduranceLevel("male", "10k", 40 * 60), "advanced")
  assert.equal(enduranceLevel("female", "full", 3 * 3600 + 30 * 60), "elite")
  // Faster than the world record: no level.
  assert.equal(enduranceLevel("male", "5k", 12 * 60), null)
})
