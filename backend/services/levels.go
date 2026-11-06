package services

import (
	"math"
	"slices"
)

// Levels for strength (per lift) and endurance, plus the records used by the onboarding checks.
// Levels are computed when needed, never stored: they follow from the lifts, bodyweight and sex.

// The levels, weakest first. "untested" means the user gave nothing to grade.
const (
	LevelBeginner     = "beginner"
	LevelNovice       = "novice"
	LevelIntermediate = "intermediate"
	LevelAdvanced     = "advanced"
	LevelElite        = "elite"
	LevelUntested     = "untested"
)

var levelOrder = []string{LevelBeginner, LevelNovice, LevelIntermediate, LevelAdvanced, LevelElite}

// standardRow is one bodyweight row of a strength standard: the 1RM (kg) needed for
// beginner, novice, intermediate, advanced and elite at that bodyweight.
type standardRow struct {
	bodyweight float64
	kg         [5]float64
}

// strengthStandards: StrengthLog's tables (strengthlog.com/<lift>-strength-standards-kg,
// fetched 2026-11-07), copied exactly. They're compared as multiples of bodyweight
// (kg / bodyweight per row, interpolated between rows), because the multiple a level needs
// changes with bodyweight. Note: StrengthLog lists the women's elite bench as 65 kg at both
// 50 and 55 kg bodyweight; kept as published.
var strengthStandards = map[string]map[string][]standardRow{
	"male": {
		"squat": {
			{50, [5]float64{36, 57, 70, 80, 97}}, {55, [5]float64{40, 64, 79, 91, 114}}, {60, [5]float64{44, 70, 87, 102, 129}},
			{65, [5]float64{48, 75, 94, 112, 143}}, {70, [5]float64{51, 80, 100, 120, 157}}, {75, [5]float64{54, 84, 106, 129, 169}},
			{80, [5]float64{57, 89, 112, 137, 180}}, {85, [5]float64{60, 93, 118, 144, 191}}, {90, [5]float64{63, 97, 123, 151, 201}},
			{95, [5]float64{65, 100, 127, 157, 210}}, {100, [5]float64{67, 104, 132, 164, 219}}, {105, [5]float64{70, 107, 136, 169, 228}},
			{110, [5]float64{72, 110, 140, 175, 236}}, {115, [5]float64{74, 113, 144, 180, 244}}, {120, [5]float64{76, 116, 148, 186, 252}},
			{125, [5]float64{77, 118, 152, 191, 259}}, {130, [5]float64{79, 121, 155, 195, 266}}, {135, [5]float64{81, 124, 159, 200, 272}},
			{140, [5]float64{82, 126, 162, 204, 279}},
		},
		"bench": {
			{50, [5]float64{24, 38, 47, 55, 86}}, {55, [5]float64{30, 45, 55, 66, 98}}, {60, [5]float64{36, 52, 64, 76, 108}},
			{65, [5]float64{41, 58, 71, 85, 118}}, {70, [5]float64{46, 64, 78, 94, 127}}, {75, [5]float64{50, 69, 84, 102, 135}},
			{80, [5]float64{54, 74, 90, 109, 143}}, {85, [5]float64{58, 79, 96, 116, 151}}, {90, [5]float64{62, 83, 101, 123, 158}},
			{95, [5]float64{66, 87, 106, 129, 164}}, {100, [5]float64{69, 91, 111, 135, 170}}, {105, [5]float64{72, 95, 116, 140, 176}},
			{110, [5]float64{75, 99, 120, 146, 182}}, {115, [5]float64{78, 102, 124, 151, 187}}, {120, [5]float64{81, 105, 128, 156, 193}},
			{125, [5]float64{83, 109, 132, 160, 198}}, {130, [5]float64{86, 112, 136, 165, 202}}, {135, [5]float64{88, 114, 139, 169, 207}},
			{140, [5]float64{91, 117, 143, 173, 211}},
		},
		"deadlift": {
			{50, [5]float64{47, 72, 96, 113, 132}}, {55, [5]float64{52, 80, 106, 125, 149}}, {60, [5]float64{57, 87, 114, 136, 164}},
			{65, [5]float64{62, 94, 122, 146, 179}}, {70, [5]float64{66, 100, 129, 155, 192}}, {75, [5]float64{69, 106, 136, 164, 204}},
			{80, [5]float64{73, 111, 142, 172, 216}}, {85, [5]float64{76, 116, 148, 179, 226}}, {90, [5]float64{79, 121, 154, 187, 236}},
			{95, [5]float64{82, 125, 159, 193, 246}}, {100, [5]float64{85, 130, 164, 200, 255}}, {105, [5]float64{88, 134, 169, 206, 264}},
			{110, [5]float64{91, 137, 174, 212, 272}}, {115, [5]float64{93, 141, 178, 217, 280}}, {120, [5]float64{95, 145, 182, 223, 288}},
			{125, [5]float64{98, 148, 186, 228, 295}}, {130, [5]float64{100, 151, 190, 233, 302}}, {135, [5]float64{102, 154, 194, 238, 309}},
			{140, [5]float64{104, 157, 197, 242, 315}},
		},
	},
	"female": {
		"squat": {
			{40, [5]float64{20, 40, 58, 73, 91}}, {45, [5]float64{21, 43, 61, 77, 98}}, {50, [5]float64{22, 44, 63, 80, 105}},
			{55, [5]float64{23, 46, 65, 83, 111}}, {60, [5]float64{24, 48, 67, 85, 117}}, {65, [5]float64{25, 49, 68, 87, 122}},
			{70, [5]float64{26, 51, 70, 90, 127}}, {75, [5]float64{27, 52, 71, 92, 131}}, {80, [5]float64{28, 53, 73, 93, 135}},
			{85, [5]float64{29, 54, 74, 95, 139}}, {90, [5]float64{29, 55, 75, 97, 143}}, {95, [5]float64{30, 56, 76, 98, 147}},
			{100, [5]float64{31, 57, 77, 100, 150}}, {105, [5]float64{31, 58, 78, 101, 153}}, {110, [5]float64{32, 59, 79, 103, 156}},
			{115, [5]float64{33, 60, 80, 104, 159}}, {120, [5]float64{33, 60, 81, 105, 162}},
		},
		"bench": {
			{40, [5]float64{17, 27, 35, 39, 53}}, {45, [5]float64{19, 29, 37, 43, 59}}, {50, [5]float64{20, 30, 39, 46, 65}},
			{55, [5]float64{21, 32, 40, 49, 65}}, {60, [5]float64{22, 33, 42, 51, 75}}, {65, [5]float64{23, 34, 43, 54, 79}},
			{70, [5]float64{24, 35, 45, 56, 83}}, {75, [5]float64{25, 36, 46, 58, 87}}, {80, [5]float64{26, 37, 47, 60, 91}},
			{85, [5]float64{27, 38, 48, 62, 94}}, {90, [5]float64{27, 39, 49, 63, 97}}, {95, [5]float64{28, 40, 50, 65, 100}},
			{100, [5]float64{29, 41, 51, 67, 103}}, {105, [5]float64{29, 42, 52, 68, 106}}, {110, [5]float64{30, 42, 53, 69, 108}},
			{115, [5]float64{30, 43, 54, 71, 111}}, {120, [5]float64{31, 44, 54, 72, 113}},
		},
		"deadlift": {
			{40, [5]float64{34, 51, 66, 84, 107}}, {45, [5]float64{35, 55, 70, 90, 115}}, {50, [5]float64{36, 58, 74, 95, 122}},
			{55, [5]float64{37, 61, 78, 99, 128}}, {60, [5]float64{38, 64, 81, 103, 135}}, {65, [5]float64{39, 67, 84, 107, 140}},
			{70, [5]float64{39, 69, 86, 111, 145}}, {75, [5]float64{40, 71, 89, 114, 150}}, {80, [5]float64{41, 73, 91, 117, 154}},
			{85, [5]float64{41, 75, 94, 120, 159}}, {90, [5]float64{42, 77, 96, 122, 163}}, {95, [5]float64{42, 79, 98, 125, 166}},
			{100, [5]float64{43, 80, 99, 127, 170}}, {105, [5]float64{43, 82, 101, 130, 173}}, {110, [5]float64{44, 83, 103, 132, 176}},
			{115, [5]float64{44, 85, 105, 134, 179}}, {120, [5]float64{45, 86, 106, 136, 182}},
		},
	},
}

// fiveKSeconds: Running Level's 5 km standards, all ages (via how-good-am-i.vercel.app/5k-run,
// fetched 2026-11-07): the time needed for beginner, novice, intermediate, advanced, elite.
// Their "Strong" and "World class" levels are left out, so both scales have the same 5 levels.
var fiveKSeconds = map[string][5]float64{
	"male":   {34*60 + 13, 31*60 + 9, 28 * 60, 20*60 + 19, 18*60 + 8},
	"female": {42*60 + 15, 38*60 + 40, 35 * 60, 26*60 + 2, 23*60 + 29},
}

// raceMetres are the onboarding distances.
var raceMetres = map[string]float64{"5k": 5000, "10k": 10000, "half": 21097.5, "full": 42195}

// liftRecords: the heaviest lift ever recorded per IPF weight class, any federation, all ages,
// raw or with knee wraps (whichever is higher), including single-lift meets (OpenPowerlifting,
// openpowerlifting.org/records/{raw,wraps}/ipf-classes/{men,women}, "All Events", fetched
// 2026-11-07). "over" is the class's lower bound: a row covers bodyweights above it, up to the
// next row's. Above these is "impossible" (see LiftRecord).
type recordRow struct {
	over float64
	kg   [3]float64 // squat, bench, deadlift
}

var liftRecords = map[string][]recordRow{
	"male": {
		{0, [3]float64{292.5, 200, 271.5}}, {53, [3]float64{270, 211, 303}}, {59, [3]float64{288, 222.5, 345}},
		{66, [3]float64{341, 250.5, 365}}, {74, [3]float64{366, 250, 405}}, {83, [3]float64{400.5, 280, 413}},
		{93, [3]float64{420, 290, 447.5}}, {105, [3]float64{453.5, 310, 472.5}}, {120, [3]float64{525, 355, 492.5}},
	},
	"female": {
		{0, [3]float64{152.5, 125, 162.5}}, {43, [3]float64{182.5, 135, 212.5}}, {47, [3]float64{203, 141, 220.5}},
		{52, [3]float64{260, 143, 240}}, {57, [3]float64{255, 145, 242.6}}, {63, [3]float64{263, 158, 260}},
		{69, [3]float64{310, 183.7, 291.5}}, {76, [3]float64{311, 172.5, 291}}, {84, [3]float64{320, 207.5, 297.5}},
	},
}

var liftIndex = map[string]int{"squat": 0, "bench": 1, "deadlift": 2}

// LiftRecord is the most anyone at this bodyweight or lighter has lifted: the records of the
// user's class and every lighter one. (Records don't always rise with the class: a lighter
// class's record can be higher, and a heavier lifter can always do what a lighter one did.)
func LiftRecord(sex, lift string, bodyweightKg float64) float64 {
	best := 0.0
	for _, row := range liftRecords[sex] {
		if row.over >= bodyweightKg {
			break
		}
		best = max(best, row.kg[liftIndex[lift]])
	}
	return best
}

// raceRecordSeconds: world records (World Athletics lists via The Running Channel, Runhive,
// Wikipedia, checked 2026-11-07; where sources differ, the fastest). Faster is "impossible".
var raceRecordSeconds = map[string]map[string]int{
	"male":   {"5k": 12*60 + 35, "10k": 26*60 + 11, "half": 56*60 + 51, "full": 3600 + 59*60 + 30},
	"female": {"5k": 13*60 + 58, "10k": 28*60 + 54, "half": 3600 + 2*60 + 52, "full": 2*3600 + 9*60 + 56},
}

// raceUnusualSeconds: national-class times (owner-approved, 2026-11-07). Faster is "unusual":
// allowed after the user confirms.
var raceUnusualSeconds = map[string]map[string]int{
	"male":   {"5k": 15 * 60, "10k": 31 * 60, "half": 3600 + 8*60, "full": 2*3600 + 25*60},
	"female": {"5k": 17 * 60, "10k": 35 * 60, "half": 3600 + 17*60, "full": 2*3600 + 45*60},
}

// EstimateOneRepMax estimates a 1RM from a set (Epley: weight × (1 + reps/30)). Epley is only
// reliable up to 10 reps, so longer sets count as 10 (a conservative estimate).
func EstimateOneRepMax(weightKg float64, reps int) float64 {
	if reps <= 1 {
		return weightKg
	}
	return weightKg * (1 + float64(min(reps, 10))/30)
}

// levelRatios are the bodyweight multiples a lift needs for each level at this bodyweight,
// interpolated between the table's rows (and the nearest row outside the table).
func levelRatios(sex, lift string, bodyweightKg float64) [5]float64 {
	rows := strengthStandards[sex][lift]
	ratioOf := func(r standardRow, level int) float64 { return r.kg[level] / r.bodyweight }

	var ratios [5]float64
	for level := range ratios {
		switch {
		case bodyweightKg <= rows[0].bodyweight:
			ratios[level] = ratioOf(rows[0], level)
		case bodyweightKg >= rows[len(rows)-1].bodyweight:
			ratios[level] = ratioOf(rows[len(rows)-1], level)
		default:
			i := slices.IndexFunc(rows, func(r standardRow) bool { return r.bodyweight > bodyweightKg })
			lo, hi := rows[i-1], rows[i]
			f := (bodyweightKg - lo.bodyweight) / (hi.bodyweight - lo.bodyweight)
			ratios[level] = ratioOf(lo, level) + f*(ratioOf(hi, level)-ratioOf(lo, level))
		}
	}
	return ratios
}

// EliteRatio is the bodyweight multiple an elite lifter of this sex and bodyweight lifts.
func EliteRatio(sex, lift string, bodyweightKg float64) float64 {
	return levelRatios(sex, lift, bodyweightKg)[4]
}

// LiftLevel grades one lift: its estimated 1RM as a multiple of bodyweight against the table.
// Below the beginner line is still "beginner" (there's nothing lower).
func LiftLevel(sex, lift string, bodyweightKg, oneRepMaxKg float64) string {
	ratio := oneRepMaxKg / bodyweightKg
	ratios := levelRatios(sex, lift, bodyweightKg)
	level := LevelBeginner
	for i, needed := range ratios {
		if ratio >= needed {
			level = levelOrder[i]
		}
	}
	return level
}

// OverallStrengthLevel combines the levels of the lifts given: the middle one, or with two
// lifts the lower one, so one weak or strong lift doesn't decide it. None → "untested".
func OverallStrengthLevel(liftLevels []string) string {
	if len(liftLevels) == 0 {
		return LevelUntested
	}
	sorted := slices.Clone(liftLevels)
	slices.SortFunc(sorted, func(a, b string) int { return slices.Index(levelOrder, a) - slices.Index(levelOrder, b) })
	return sorted[(len(sorted)-1)/2]
}

// FiveKEquivalent converts a race time to a 5 km time with Riegel's formula, T₂ = T₁ × (D₂/D₁)^1.06.
func FiveKEquivalent(distance string, seconds int) float64 {
	return float64(seconds) * math.Pow(5000/raceMetres[distance], 1.06)
}

// EnduranceLevel grades a race result by its 5 km equivalent (faster or equal → that level).
func EnduranceLevel(sex, distance string, seconds int) string {
	time := FiveKEquivalent(distance, seconds)
	level := LevelBeginner
	for i, needed := range fiveKSeconds[sex] {
		if time <= needed {
			level = levelOrder[i]
		}
	}
	return level
}
