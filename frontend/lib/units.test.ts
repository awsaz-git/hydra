// Run with: node --test lib/   (Node 24 runs TypeScript directly)
import { test } from "node:test"
import assert from "node:assert/strict"

import { cmToFeetInches, formatDuration, inToCm, kgToLb, lbToKg, parseDuration, round } from "./units.ts"

test("exact constants, the same as the backend", () => {
  assert.equal(lbToKg(1), 0.45359237)
  assert.equal(inToCm(1), 2.54)
  assert.equal(round(lbToKg(180), 1), 81.6)
  assert.equal(round(kgToLb(100), 1), 220.5)
  assert.ok(Math.abs(kgToLb(lbToKg(225)) - 225) < 1e-9)
})

test("height in feet and inches", () => {
  assert.deepEqual(cmToFeetInches(177.8), { feet: 5, inches: 10 })
  assert.deepEqual(cmToFeetInches(182.88), { feet: 6, inches: 0 })
  assert.deepEqual(cmToFeetInches(152.4), { feet: 5, inches: 0 })
})

test("durations", () => {
  assert.equal(formatDuration(755), "12:35")
  assert.equal(formatDuration(7170), "1:59:30")
  assert.equal(formatDuration(3600), "1:00:00")
  assert.equal(parseDuration("12:35"), 755)
  assert.equal(parseDuration("1:59:30"), 7170)
  assert.equal(parseDuration(" 25:00 "), 1500)
  for (const bad of ["", "12", "12:60", "1:60:00", "abc", "1:2:3"]) assert.equal(parseDuration(bad), null, bad)
})
