package services

import (
	"encoding/json"
	"errors"
	"io/fs"
	"math"
	"os"
	"reflect"
	"testing"
)

func TestStandardsTablesAreConsistent(t *testing.T) {
	// Guards the copied data: within a row each level needs more than the one before
	// (equal is allowed: StrengthLog's women's elite bench repeats 65 kg), and rows go up in bodyweight.
	for sex, lifts := range strengthStandards {
		for lift, rows := range lifts {
			for i, row := range rows {
				for level := 1; level < 5; level++ {
					if row.kg[level] < row.kg[level-1] {
						t.Errorf("%s %s at %v kg: level %d (%v) < level %d (%v)", sex, lift, row.bodyweight, level, row.kg[level], level-1, row.kg[level-1])
					}
				}
				if i > 0 && row.bodyweight <= rows[i-1].bodyweight {
					t.Errorf("%s %s: bodyweight rows out of order at %v", sex, lift, row.bodyweight)
				}
			}
		}
	}
	for sex, times := range fiveKSeconds {
		for level := 1; level < 5; level++ {
			if times[level] >= times[level-1] {
				t.Errorf("%s 5k: level %d isn't faster than level %d", sex, level, level-1)
			}
		}
	}
}

// The frontend shows levels live from a copy of these tables (frontend/lib/level-standards.json).
// This fails when the two differ, so a change to one side can't be forgotten on the other.
func TestFrontendStandardsMatch(t *testing.T) {
	data, err := os.ReadFile("../../frontend/lib/level-standards.json")
	if errors.Is(err, fs.ErrNotExist) {
		t.Skip("no frontend folder next to the backend (e.g. the Docker build)")
	}
	if err != nil {
		t.Fatal(err)
	}
	var copied struct {
		Strength          map[string]map[string][][6]float64 `json:"strength"`
		FiveKSeconds      map[string][5]float64              `json:"fiveKSeconds"`
		RaceMetres        map[string]float64                 `json:"raceMetres"`
		LiftRecordKg      map[string][][4]float64            `json:"liftRecordKg"`
		RaceRecordSeconds map[string]map[string]int          `json:"raceRecordSeconds"`
	}
	if err := json.Unmarshal(data, &copied); err != nil {
		t.Fatal(err)
	}

	strength := map[string]map[string][][6]float64{}
	for sex, lifts := range strengthStandards {
		strength[sex] = map[string][][6]float64{}
		for lift, rows := range lifts {
			for _, r := range rows {
				strength[sex][lift] = append(strength[sex][lift], [6]float64{r.bodyweight, r.kg[0], r.kg[1], r.kg[2], r.kg[3], r.kg[4]})
			}
		}
	}
	records := map[string][][4]float64{}
	for sex, rows := range liftRecords {
		for _, r := range rows {
			records[sex] = append(records[sex], [4]float64{r.over, r.kg[0], r.kg[1], r.kg[2]})
		}
	}
	for name, pair := range map[string][2]any{
		"strength":          {strength, copied.Strength},
		"fiveKSeconds":      {fiveKSeconds, copied.FiveKSeconds},
		"raceMetres":        {raceMetres, copied.RaceMetres},
		"liftRecordKg":      {records, copied.LiftRecordKg},
		"raceRecordSeconds": {raceRecordSeconds, copied.RaceRecordSeconds},
	} {
		if !reflect.DeepEqual(pair[0], pair[1]) {
			t.Errorf("%s differs between services/levels.go and frontend/lib/level-standards.json", name)
		}
	}
}

func TestLiftRecord(t *testing.T) {
	tests := []struct {
		name       string
		sex, lift  string
		bodyweight float64
		want       float64
	}{
		{"65 kg man: the 66 kg class (bench 222.5)", "male", "bench", 65, 222.5},
		{"66 kg exactly is still the 66 kg class", "male", "bench", 66, 222.5},
		{"66.1 kg is the 74 kg class (250.5)", "male", "bench", 66.1, 250.5},
		{"58 kg man: a lighter class's higher record counts (53 kg squat 292.5 > 59 kg 270)", "male", "squat", 58, 292.5},
		{"heaviest class has no upper bound", "male", "squat", 200, 525},
		{"84+ woman deadlift", "female", "deadlift", 100, 297.5},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := LiftRecord(tt.sex, tt.lift, tt.bodyweight); got != tt.want {
				t.Errorf("got %v, want %v", got, tt.want)
			}
		})
	}
}

func TestEstimateOneRepMax(t *testing.T) {
	tests := []struct {
		name   string
		weight float64
		reps   int
		want   float64
	}{
		{"a single is the 1RM", 100, 1, 100},
		{"5 reps", 100, 5, 116.6667},
		{"10 reps", 100, 10, 133.3333},
		{"over 10 reps counts as 10", 100, 15, 133.3333},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := EstimateOneRepMax(tt.weight, tt.reps); math.Abs(got-tt.want) > 1e-3 {
				t.Errorf("got %v, want %v", got, tt.want)
			}
		})
	}
}

func TestEliteRatio(t *testing.T) {
	tests := []struct {
		name       string
		sex, lift  string
		bodyweight float64
		want       float64
	}{
		{"on a row: 80 kg man squat 180 kg", "male", "squat", 80, 2.25},
		{"between rows: halfway 80 (2.25×) and 85 (191/85)", "male", "squat", 82.5, (2.25 + 191.0/85) / 2},
		{"below the table: lightest row", "female", "deadlift", 35, 107.0 / 40},
		{"above the table: heaviest row", "male", "bench", 160, 211.0 / 140},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := EliteRatio(tt.sex, tt.lift, tt.bodyweight); math.Abs(got-tt.want) > 1e-9 {
				t.Errorf("got %v, want %v", got, tt.want)
			}
		})
	}
}

func TestLiftLevel(t *testing.T) {
	tests := []struct {
		name       string
		sex, lift  string
		bodyweight float64
		oneRepMax  float64
		want       string
	}{
		{"exactly elite", "male", "squat", 80, 180, LevelElite},
		{"just under elite", "male", "squat", 80, 179, LevelAdvanced},
		{"exactly intermediate", "female", "bench", 60, 42, LevelIntermediate},
		{"below beginner is still beginner", "male", "deadlift", 80, 40, LevelBeginner},
		{"heavy lifter graded by ratio, not kg", "male", "squat", 140, 279, LevelElite},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := LiftLevel(tt.sex, tt.lift, tt.bodyweight, tt.oneRepMax); got != tt.want {
				t.Errorf("got %q, want %q", got, tt.want)
			}
		})
	}
}

func TestOverallStrengthLevel(t *testing.T) {
	tests := []struct {
		name   string
		levels []string
		want   string
	}{
		{"no lifts", nil, LevelUntested},
		{"one lift", []string{LevelAdvanced}, LevelAdvanced},
		{"two lifts: the lower", []string{LevelElite, LevelNovice}, LevelNovice},
		{"three lifts: the middle", []string{LevelElite, LevelBeginner, LevelAdvanced}, LevelAdvanced},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := OverallStrengthLevel(tt.levels); got != tt.want {
				t.Errorf("got %q, want %q", got, tt.want)
			}
		})
	}
}

func TestEnduranceLevel(t *testing.T) {
	tests := []struct {
		name     string
		sex      string
		distance string
		seconds  int
		want     string
	}{
		{"exactly elite 5k", "male", "5k", 18*60 + 8, LevelElite},
		{"one second slower", "male", "5k", 18*60 + 9, LevelAdvanced},
		{"slow 5k is beginner", "female", "5k", 50 * 60, LevelBeginner},
		{"10k converted with Riegel (40:00 → about 19:11 for 5k)", "male", "10k", 40 * 60, LevelAdvanced},
		{"3:30 marathon (about 21:54 for 5k)", "female", "full", 3*3600 + 30*60, LevelElite},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := EnduranceLevel(tt.sex, tt.distance, tt.seconds); got != tt.want {
				t.Errorf("got %q, want %q (5k equivalent %.0f s)", got, tt.want, FiveKEquivalent(tt.distance, tt.seconds))
			}
		})
	}
}
