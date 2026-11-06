package services

import (
	"testing"
	"time"
)

func TestCheckOnboarding(t *testing.T) {
	today := time.Date(2026, 11, 7, 0, 0, 0, 0, time.UTC)
	str := func(s string) *string { return &s }
	kg := func(v float64) *Measurement { return &Measurement{v, "kg"} }
	man80 := func(in OnboardingInput) OnboardingInput { // a valid 80 kg man, plus what the case adds
		in.Sex, in.Weight = str("male"), kg(80)
		return in
	}
	lift := func(v float64, unit string, reps int) *LiftInput { return &LiftInput{Measurement{v, unit}, reps} }

	tests := []struct {
		name         string
		in           OnboardingInput
		wantField    string // "" = no finding at all
		wantSeverity string
		wantCode     string
	}{
		// Birth date: 16 or older on the day.
		{"16 today is fine", OnboardingInput{BirthDate: str("2010-11-07")}, "", "", ""},
		{"16 tomorrow is too young", OnboardingInput{BirthDate: str("2010-11-08")}, "birth_date", SeverityError, "under_16"},
		{"not a date", OnboardingInput{BirthDate: str("07/11/2000")}, "birth_date", SeverityError, "invalid_date"},
		{"in the future", OnboardingInput{BirthDate: str("2030-01-01")}, "birth_date", SeverityError, "invalid_date"},

		// Choices.
		{"unknown units", OnboardingInput{Units: str("imperial-ish")}, "units", SeverityError, "invalid_choice"},
		{"unknown sex", OnboardingInput{Sex: str("other")}, "sex", SeverityError, "invalid_choice"},

		// Height and weight: range, then usual range (a warning that says to check the number and unit).
		{"normal height", OnboardingInput{Height: &Measurement{180, "cm"}}, "", "", ""},
		{"5 ft 10 in", OnboardingInput{Height: &Measurement{70, "in"}}, "", "", ""},
		{"70 cm: out of range", OnboardingInput{Height: &Measurement{70, "cm"}}, "height", SeverityError, "out_of_range"},
		{"unusual but possible height", OnboardingInput{Height: &Measurement{215, "cm"}}, "height", SeverityWarning, "unusual_height"},
		{"300 cm: out of range in both units", OnboardingInput{Height: &Measurement{300, "cm"}}, "height", SeverityError, "out_of_range"},
		{"180 kg bodyweight: unusual", OnboardingInput{Weight: kg(180)}, "weight", SeverityWarning, "unusual_weight"},
		{"70 lb bodyweight (31.8 kg): unusual", OnboardingInput{Weight: &Measurement{70, "lb"}}, "weight", SeverityWarning, "unusual_weight"},
		{"20 kg: out of range", OnboardingInput{Weight: kg(20)}, "weight", SeverityError, "out_of_range"},
		{"unknown unit", OnboardingInput{Weight: &Measurement{80, "stone"}}, "weight", SeverityError, "invalid_unit"},

		// Groups (the main group is optional).
		{"one group", OnboardingInput{AthleteGroups: []string{"functional"}}, "", "", ""},
		{"three groups, no main", OnboardingInput{AthleteGroups: []string{"functional", "strength", "endurance"}}, "", "", ""},
		{"a main group that's one of them", OnboardingInput{AthleteGroups: []string{"functional", "strength"}, MainGroup: str("strength")}, "", "", ""},
		{"a main group that isn't one of them", OnboardingInput{AthleteGroups: []string{"functional", "strength"}, MainGroup: str("sport")}, "main_group", SeverityError, "invalid_choice"},
		{"no groups", OnboardingInput{AthleteGroups: []string{}}, "athlete_groups", SeverityError, "groups_count"},
		{"every group (no limit)", OnboardingInput{AthleteGroups: []string{"strength", "physique", "functional", "endurance", "sport", "combat", "general"}}, "", "", ""},
		{"unknown group", OnboardingInput{AthleteGroups: []string{"dancing"}}, "athlete_groups", SeverityError, "invalid_choice"},
		{"tactical is gone", OnboardingInput{AthleteGroups: []string{"tactical"}}, "athlete_groups", SeverityError, "invalid_choice"},
		{"hybrid is now called functional", OnboardingInput{AthleteGroups: []string{"hybrid"}}, "athlete_groups", SeverityError, "invalid_choice"},
		{"the same group twice", OnboardingInput{AthleteGroups: []string{"sport", "sport"}}, "athlete_groups", SeverityError, "invalid_choice"},

		// Lifts, for an 80 kg man (elite squat 2.25×; squat record up to 83 kg: 366 kg).
		{"elite exactly is fine", man80(OnboardingInput{Squat: lift(180, "kg", 1)}), "", "", ""},
		{"above elite: a warning", man80(OnboardingInput{Squat: lift(200, "kg", 1)}), "squat", SeverityWarning, "unusual_lift"},
		{"the record for his bodyweight is fine", man80(OnboardingInput{Squat: lift(366, "kg", 1)}), "squat", SeverityWarning, "unusual_lift"},
		{"above the record for his bodyweight: impossible", man80(OnboardingInput{Squat: lift(367, "kg", 1)}), "squat", SeverityError, "impossible_lift"},
		{"a 330 × 3 (≈ 363 kg) is under it", man80(OnboardingInput{Squat: lift(330, "kg", 3)}), "squat", SeverityWarning, "unusual_lift"},
		{"a 340 × 3 (≈ 374 kg) is over it", man80(OnboardingInput{Squat: lift(340, "kg", 3)}), "squat", SeverityError, "impossible_lift"},
		{"140 kg man, 500 kg deadlift: over the heaviest class's record", OnboardingInput{Sex: str("male"), Weight: kg(140), Deadlift: lift(500, "kg", 1)}, "deadlift", SeverityError, "impossible_lift"},
		{"65 kg man benching 200 × 6 (≈ 240 kg, record up to 66 kg: 222.5)", OnboardingInput{Sex: str("male"), Weight: kg(65), Bench: lift(200, "kg", 6)}, "bench", SeverityError, "impossible_lift"},
		{"one finding per field: impossible wins over bench > deadlift", OnboardingInput{Sex: str("male"), Weight: kg(65), Bench: lift(200, "kg", 6), Deadlift: lift(150, "kg", 1)}, "bench", SeverityError, "impossible_lift"},
		{"over 500 kg: out of range", man80(OnboardingInput{Deadlift: lift(600, "kg", 1)}), "deadlift", SeverityError, "out_of_range"},
		{"16 reps: out of range", man80(OnboardingInput{Bench: lift(60, "kg", 16)}), "bench", SeverityError, "reps_out_of_range"},
		{"without sex and bodyweight only the range is checked", OnboardingInput{Squat: lift(450, "kg", 1)}, "", "", ""},
		{"bench heavier than deadlift: a warning", man80(OnboardingInput{Bench: lift(120, "kg", 1), Deadlift: lift(100, "kg", 1)}), "bench", SeverityWarning, "bench_over_deadlift"},

		// Endurance, for a man (5k record 12:35, unusual under 15:00).
		{"normal 5k", man80(OnboardingInput{Endurance: &EnduranceInput{"5k", 20 * 60}}), "", "", ""},
		{"faster than the world record", man80(OnboardingInput{Endurance: &EnduranceInput{"5k", 12 * 60}}), "endurance", SeverityError, "impossible_time"},
		{"national class: a warning", man80(OnboardingInput{Endurance: &EnduranceInput{"5k", 14 * 60}}), "endurance", SeverityWarning, "unusual_time"},
		{"57:00 half is allowed (record 56:51), but unusual", man80(OnboardingInput{Endurance: &EnduranceInput{"half", 57 * 60}}), "endurance", SeverityWarning, "unusual_time"},
		{"slower than the slowest accepted", man80(OnboardingInput{Endurance: &EnduranceInput{"5k", 3 * 3600}}), "endurance", SeverityError, "time_out_of_range"},
		{"unknown distance", man80(OnboardingInput{Endurance: &EnduranceInput{"3k", 600}}), "endurance", SeverityError, "invalid_choice"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			findings := CheckOnboarding(tt.in, today)
			if tt.wantField == "" {
				if len(findings) > 0 {
					t.Fatalf("want no findings, got %+v", findings)
				}
				return
			}
			if len(findings) != 1 {
				t.Fatalf("want exactly one finding, got %+v", findings)
			}
			f := findings[0]
			if f.Field != tt.wantField || f.Severity != tt.wantSeverity || f.Code != tt.wantCode {
				t.Errorf("got %s/%s/%s, want %s/%s/%s", f.Field, f.Severity, f.Code, tt.wantField, tt.wantSeverity, tt.wantCode)
			}
		})
	}
}

func TestCheckOnboardingParams(t *testing.T) {
	// The numbers the messages show: 200 kg for an 80 kg man is 2.5×, elite at 80 kg is 2.25× (shown 2.3×).
	male := "male"
	findings := CheckOnboarding(OnboardingInput{Sex: &male, Weight: &Measurement{80, "kg"}, Squat: &LiftInput{Measurement{200, "kg"}, 1}}, time.Now())
	if len(findings) != 1 || findings[0].Params["ratio"] != 2.5 || findings[0].Params["elite_ratio"] != 2.3 {
		t.Errorf("got %+v", findings)
	}

	// The record shown is the one for his bodyweight: 222.5 kg bench up to 66 kg.
	findings = CheckOnboarding(OnboardingInput{Sex: &male, Weight: &Measurement{65, "kg"}, Bench: &LiftInput{Measurement{200, "kg"}, 6}}, time.Now())
	if len(findings) != 1 || findings[0].Params["record_kg"] != 222.5 {
		t.Errorf("got %+v", findings)
	}
}
