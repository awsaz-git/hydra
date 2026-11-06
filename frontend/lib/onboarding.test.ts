// Run with: npm test
import { test } from "node:test"
import assert from "node:assert/strict"

import { changedFields, convertUnits, emptyAnswers, isComplete, isUnder16, liveLevel, toInput, type Answers } from "./onboarding.ts"

const filled: Answers = {
  ...emptyAnswers,
  birthDate: "1996-04-12",
  sex: "male",
  heightCm: "177.8",
  weight: "80",
  groups: ["functional"],
  lifts: {
    squat: { selected: true, weight: "140", reps: "5" },
    bench: { selected: false, weight: "", reps: "" },
    deadlift: { selected: true, weight: "180", reps: "3" },
  },
  race: { selected: true, distance: "10k", time: "45:00" },
}

test("16 or older on today's date", () => {
  const today = new Date()
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
  const sixteenToday = new Date(today.getFullYear() - 16, today.getMonth(), today.getDate())
  const sixteenTomorrow = new Date(today.getFullYear() - 16, today.getMonth(), today.getDate() + 1)
  assert.equal(isUnder16(iso(sixteenToday)), false)
  assert.equal(isUnder16(iso(sixteenTomorrow)), true)
  assert.equal(isUnder16("1990-01-01"), false)
})

test("the API input, page by page, as {value, unit}", () => {
  assert.deepEqual(toInput(filled, 1), { birth_date: "1996-04-12" })
  const all = toInput(filled, 4)
  assert.deepEqual(all.height, { value: 177.8, unit: "cm" })
  assert.deepEqual(all.weight, { value: 80, unit: "kg" })
  assert.equal(all.main_group, undefined) // not asked in onboarding
  assert.deepEqual(all.squat, { weight: { value: 140, unit: "kg" }, reps: 5 })
  assert.equal(all.bench, null) // its card wasn't picked
  assert.deepEqual(all.endurance, { distance: "10k", seconds: 2700 })
  assert.equal(toInput({ ...filled, race: { ...filled.race, selected: false } }, 4).endurance, null)
  // no card picked at all is fine: everything is null
  const none = toInput({ ...emptyAnswers, birthDate: "1996-04-12", sex: "male", heightCm: "180", weight: "80", groups: ["general"] }, 4)
  assert.deepEqual([none.squat, none.bench, none.deadlift, none.endurance], [null, null, null, null])
})

test("imperial height is sent as inches", () => {
  const imperial = { ...filled, units: "imperial" as const, heightFt: "5", heightIn: "10", weight: "176" }
  const input = toInput(imperial, 2)
  assert.deepEqual(input.height, { value: 70, unit: "in" })
  assert.deepEqual(input.weight, { value: 176, unit: "lb" })
  assert.deepEqual(toInput({ ...imperial, heightIn: "" }, 2).height, { value: 60, unit: "in" }) // 5 ft, no inches typed
})

test("switching units keeps what was typed meaning the same", () => {
  const imperial = convertUnits(filled, "imperial")
  assert.equal(imperial.units, "imperial")
  assert.equal(imperial.weight, "176.4") // 80 kg
  assert.equal(imperial.heightFt, "5")
  assert.equal(imperial.heightIn, "10") // 177.8 cm
  assert.equal(imperial.lifts.squat.weight, "308.6") // 140 kg
  assert.equal(imperial.lifts.bench.weight, "") // empty stays empty

  const back = convertUnits(imperial, "metric")
  assert.equal(back.weight, "80")
  assert.equal(back.heightCm, "177.8")
  assert.equal(back.lifts.squat.weight, "140")
  assert.equal(convertUnits(filled, "metric"), filled) // no change: same object
})

test("live level per card", () => {
  // 80 kg man: 140 × 5 squat ≈ 163 kg 1RM → advanced; 180 × 3 deadlift ≈ 198 kg → advanced.
  assert.equal(liveLevel(filled, "squat"), "advanced")
  assert.equal(liveLevel(filled, "deadlift"), "advanced")
  assert.equal(liveLevel(filled, "race"), "intermediate") // 10 km in 45:00
  // Not picked, not filled in, or not a valid answer: nothing to show.
  assert.equal(liveLevel(filled, "bench"), null)
  const edit = (lift: Partial<Answers["lifts"]["squat"]>): Answers => ({ ...filled, lifts: { ...filled.lifts, squat: { ...filled.lifts.squat, ...lift } } })
  assert.equal(liveLevel(edit({ reps: "" }), "squat"), null)
  assert.equal(liveLevel(edit({ reps: "20" }), "squat"), null)
  assert.equal(liveLevel(edit({ reps: "2.5" }), "squat"), null)
  assert.equal(liveLevel(edit({ weight: "600" }), "squat"), null)
  assert.equal(liveLevel({ ...filled, sex: null }, "squat"), null)
  assert.equal(liveLevel({ ...filled, race: { ...filled.race, time: "45" } }, "race"), null)
  // Imperial: the same lift typed in lb gives the same level.
  const imperial = convertUnits(filled, "imperial")
  assert.equal(liveLevel(imperial, "squat"), "advanced")
})

test("which checked fields an edit changed", () => {
  assert.deepEqual(changedFields(filled, filled), [])
  assert.deepEqual(changedFields(filled, { ...filled, weight: "81" }), ["weight"])
  assert.deepEqual(changedFields(filled, { ...filled, lifts: { ...filled.lifts, bench: { ...filled.lifts.bench, selected: true } } }), ["bench"])
  // Switching units changes every measurement.
  assert.deepEqual(changedFields(filled, convertUnits(filled, "imperial")), ["height", "weight", "squat", "bench", "deadlift"])
})

test("a field is complete once there's something to check", () => {
  assert.equal(isComplete(filled, "squat"), true)
  assert.equal(isComplete({ ...filled, lifts: { ...filled.lifts, squat: { ...filled.lifts.squat, reps: "" } } }, "squat"), false)
  assert.equal(isComplete(filled, "bench"), false) // not picked
  assert.equal(isComplete({ ...filled, weight: "" }, "weight"), false)
  assert.equal(isComplete(filled, "endurance"), true)
})
