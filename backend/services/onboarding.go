package services

import (
	"errors"
	"math"
	"slices"
	"time"

	"github.com/jackc/pgx/v5/pgconn"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"hydra/backend/db"
	"hydra/backend/models"
)

// PrivacyPolicyVersion is the policy users must have agreed to before their data goes to the
// LLM. It must equal PRIVACY_POLICY_VERSION in frontend/lib/privacy.ts: when they differ,
// consent fails loudly (ErrPolicyOutdated) instead of recording the wrong version.
const PrivacyPolicyVersion = "2026-11-07"

var (
	ErrConsentRequired  = errors.New("consent to the current privacy policy is required")
	ErrPolicyOutdated   = errors.New("that isn't the current privacy policy")
	ErrAlreadyOnboarded = errors.New("onboarding is already done")
)

// InvalidOnboardingError is a blocking finding at submit (the frontend checks every page first,
// so this only happens if those checks were skipped).
type InvalidOnboardingError struct{ Finding Finding }

func (e InvalidOnboardingError) Error() string {
	return "invalid onboarding: " + e.Finding.Field + ": " + e.Finding.Code
}

// Severities of a finding (owner, 2026-11-07: no "Yes, that's right" any more).
const (
	SeverityError   = "error"   // blocks: fix it to continue
	SeverityWarning = "warning" // "that doesn't look right": shown, but doesn't stop you
)

// Finding is one result of the onboarding checks. Params are in stored units (kg, cm, seconds);
// the frontend shows them in the user's units.
type Finding struct {
	Field    string         `json:"field"`
	Severity string         `json:"severity"`
	Code     string         `json:"code"`
	Params   map[string]any `json:"params,omitempty"`
}

// OnboardingInput is what the onboarding pages send. A nil field wasn't sent (or was skipped:
// a lift or the endurance result). Measurements come as {value, unit} and only Go converts them.
type OnboardingInput struct {
	PolicyVersion string          `json:"policy_version"`
	BirthDate     *string         `json:"birth_date"` // YYYY-MM-DD
	Units         *string         `json:"units"`      // "metric" or "imperial"
	Sex           *string         `json:"sex"`
	Height        *Measurement    `json:"height"` // "cm", or "in" (feet + inches as inches)
	Weight        *Measurement    `json:"weight"` // "kg" or "lb"
	AthleteGroups []string        `json:"athlete_groups"`
	MainGroup     *string         `json:"main_group"`
	Squat         *LiftInput      `json:"squat"`
	Bench         *LiftInput      `json:"bench"`
	Deadlift      *LiftInput      `json:"deadlift"`
	Endurance     *EnduranceInput `json:"endurance"`
}

// LiftInput is the best recent set of a lift.
type LiftInput struct {
	Weight Measurement `json:"weight"`
	Reps   int         `json:"reps"`
}

// EnduranceInput is the best result at one distance.
type EnduranceInput struct {
	Distance string `json:"distance"` // "5k", "10k", "half", "full"
	Seconds  int    `json:"seconds"`
}

// MeStatus tells the frontend where to send the user.
type MeStatus struct {
	Onboarded      bool   `json:"onboarded"`
	ConsentCurrent bool   `json:"consent_current"`
	PolicyVersion  string `json:"policy_version"`
}

var (
	sexes         = []string{"male", "female"}
	athleteGroups = []string{"strength", "physique", "functional", "endurance", "sport", "combat", "general"}
	// What one metric/imperial choice sets (owner-approved; energy is kcal in both).
	unitPresets = map[string]models.Preferences{
		"metric":   {WeightUnit: "kg", DistanceUnit: "km", ShortDistanceUnit: "m", HeightUnit: "cm", EnergyUnit: "kcal"},
		"imperial": {WeightUnit: "lb", DistanceUnit: "mi", ShortDistanceUnit: "yd", HeightUnit: "ft_in", EnergyUnit: "kcal"},
	}
	// The slowest time accepted per distance. The fastest is the world record (raceRecordSeconds).
	raceMaxSeconds = map[string]int{"5k": 2 * 3600, "10k": 4 * 3600, "half": 6 * 3600, "full": 10 * 3600}
)

// The accepted ranges (owner-approved) and the usual ones (outside → a warning), in stored units.
const (
	minHeightCm, maxHeightCm       = 100.0, 250.0
	usualHeightCm1, usualHeightCm2 = 140.0, 210.0
	minWeightKg, maxWeightKg       = 30.0, 300.0
	usualWeightKg1, usualWeightKg2 = 40.0, 150.0
	minLiftKg, maxLiftKg           = 1.0, 500.0
	minReps, maxReps               = 1, 15
	minimumAge                     = 16
)

// CheckOnboarding runs every check on what was sent (a page sends what it has so far) and
// returns at most one finding per field: the first error, or else the first warning. It stores
// nothing.
func CheckOnboarding(in OnboardingInput, today time.Time) []Finding {
	var findings []Finding
	add := func(f *Finding) {
		if f == nil {
			return
		}
		i := slices.IndexFunc(findings, func(g Finding) bool { return g.Field == f.Field })
		switch {
		case i < 0:
			findings = append(findings, *f)
		case f.Severity == SeverityError && findings[i].Severity != SeverityError:
			findings[i] = *f
		}
	}

	if in.BirthDate != nil {
		add(checkBirthDate(*in.BirthDate, today))
	}
	if in.Units != nil && unitPresets[*in.Units].WeightUnit == "" {
		add(&Finding{"units", SeverityError, "invalid_choice", nil})
	}
	sexOK := in.Sex != nil && slices.Contains(sexes, *in.Sex)
	if in.Sex != nil && !sexOK {
		add(&Finding{"sex", SeverityError, "invalid_choice", nil})
	}
	if in.Height != nil {
		add(measured("height", *in.Height, ToCm, heightStatus))
	}

	// The bodyweight, if it's valid: the lift checks are relative to it.
	var bodyweightKg float64
	if in.Weight != nil {
		add(measured("weight", *in.Weight, ToKg, weightStatus))
		if kg, err := ToKg(*in.Weight); err == nil && kg >= minWeightKg && kg <= maxWeightKg {
			bodyweightKg = kg
		}
	}

	if in.AthleteGroups != nil || in.MainGroup != nil {
		add(checkGroups(in.AthleteGroups, in.MainGroup))
	}

	// Lifts: ranges always; records and elite only with a valid sex and bodyweight.
	oneRepMaxes := map[string]float64{}
	for _, lift := range []struct {
		name  string
		input *LiftInput
	}{{"squat", in.Squat}, {"bench", in.Bench}, {"deadlift", in.Deadlift}} {
		if lift.input == nil {
			continue
		}
		if lift.input.Reps < minReps || lift.input.Reps > maxReps {
			add(&Finding{lift.name, SeverityError, "reps_out_of_range", map[string]any{"min": minReps, "max": maxReps}})
			continue
		}
		reps := lift.input.Reps
		status := func(kg float64) *Finding {
			if kg < minLiftKg || kg > maxLiftKg {
				return &Finding{Severity: SeverityError, Code: "out_of_range", Params: map[string]any{"min": minLiftKg, "max": maxLiftKg, "unit": "kg"}}
			}
			if !sexOK || bodyweightKg == 0 {
				return nil
			}
			return liftStatus(*in.Sex, lift.name, bodyweightKg, kg, reps)
		}
		f := measured(lift.name, lift.input.Weight, ToKg, status)
		add(f)
		if kg, err := ToKg(lift.input.Weight); err == nil && (f == nil || f.Severity != SeverityError) {
			oneRepMaxes[lift.name] = EstimateOneRepMax(kg, reps)
		}
	}
	if bench, ok := oneRepMaxes["bench"]; ok {
		if deadlift, ok := oneRepMaxes["deadlift"]; ok && bench > deadlift {
			add(&Finding{"bench", SeverityWarning, "bench_over_deadlift", nil})
		}
	}

	if in.Endurance != nil {
		sex := ""
		if sexOK {
			sex = *in.Sex
		}
		add(checkEndurance(*in.Endurance, sex))
	}

	return findings
}

func checkBirthDate(value string, today time.Time) *Finding {
	born, err := time.Parse(time.DateOnly, value)
	if err != nil || born.Year() < 1900 || born.After(today) {
		return &Finding{"birth_date", SeverityError, "invalid_date", nil}
	}
	if born.AddDate(minimumAge, 0, 0).After(today) {
		return &Finding{"birth_date", SeverityError, "under_16", map[string]any{"min_age": minimumAge}}
	}
	return nil
}

func heightStatus(cm float64) *Finding {
	switch {
	case cm < minHeightCm || cm > maxHeightCm:
		return &Finding{Severity: SeverityError, Code: "out_of_range", Params: map[string]any{"min": minHeightCm, "max": maxHeightCm, "unit": "cm"}}
	case cm < usualHeightCm1 || cm > usualHeightCm2:
		return &Finding{Severity: SeverityWarning, Code: "unusual_height"}
	}
	return nil
}

func weightStatus(kg float64) *Finding {
	switch {
	case kg < minWeightKg || kg > maxWeightKg:
		return &Finding{Severity: SeverityError, Code: "out_of_range", Params: map[string]any{"min": minWeightKg, "max": maxWeightKg, "unit": "kg"}}
	case kg < usualWeightKg1 || kg > usualWeightKg2:
		return &Finding{Severity: SeverityWarning, Code: "unusual_weight"}
	}
	return nil
}

// liftStatus: above the record for the bodyweight → impossible; above elite for it → unusual.
func liftStatus(sex, lift string, bodyweightKg, kg float64, reps int) *Finding {
	oneRepMax := EstimateOneRepMax(kg, reps)
	if record := LiftRecord(sex, lift, bodyweightKg); oneRepMax > record {
		return &Finding{Severity: SeverityError, Code: "impossible_lift", Params: map[string]any{"lift": lift, "record_kg": record}}
	}
	if ratio, elite := oneRepMax/bodyweightKg, EliteRatio(sex, lift, bodyweightKg); ratio > elite {
		return &Finding{Severity: SeverityWarning, Code: "unusual_lift", Params: map[string]any{
			"lift": lift, "ratio": round(ratio, 1), "elite_ratio": round(elite, 1),
		}}
	}
	return nil
}

// measured converts a measurement to stored units and checks it; a unit we don't know → invalid_unit.
func measured(field string, m Measurement, convert func(Measurement) (float64, error), status func(float64) *Finding) *Finding {
	value, err := convert(m)
	if err != nil {
		return &Finding{field, SeverityError, "invalid_unit", nil}
	}
	f := status(value)
	if f != nil {
		f.Field = field
	}
	return f
}

// checkGroups: at least one group, as many as apply (no upper limit, owner 2026-11-07), no
// duplicates, so at most every group once.
func checkGroups(groups []string, main *string) *Finding {
	if len(groups) < 1 {
		return &Finding{"athlete_groups", SeverityError, "groups_count", map[string]any{"min": 1}}
	}
	for i, g := range groups {
		if !slices.Contains(athleteGroups, g) || slices.Contains(groups[:i], g) {
			return &Finding{"athlete_groups", SeverityError, "invalid_choice", nil}
		}
	}
	// The main group isn't asked in onboarding; when it's sent, it must be one of the groups.
	if main != nil && !slices.Contains(groups, *main) {
		return &Finding{"main_group", SeverityError, "invalid_choice", nil}
	}
	return nil
}

func checkEndurance(e EnduranceInput, sex string) *Finding {
	maxSeconds, ok := raceMaxSeconds[e.Distance]
	if !ok {
		return &Finding{"endurance", SeverityError, "invalid_choice", nil}
	}
	if e.Seconds <= 0 || e.Seconds > maxSeconds {
		return &Finding{"endurance", SeverityError, "time_out_of_range", map[string]any{"max_seconds": maxSeconds}}
	}
	if sex == "" {
		return nil
	}
	if record := raceRecordSeconds[sex][e.Distance]; e.Seconds < record {
		return &Finding{"endurance", SeverityError, "impossible_time", map[string]any{"distance": e.Distance, "record_seconds": record}}
	}
	if e.Seconds < raceUnusualSeconds[sex][e.Distance] {
		return &Finding{"endurance", SeverityWarning, "unusual_time", map[string]any{"distance": e.Distance}}
	}
	return nil
}

// SubmitOnboarding checks everything again, then saves the profile, the preferences and the
// consent in one transaction: all of it, or nothing. Nothing about the user is stored before this.
func SubmitOnboarding(userID string, in OnboardingInput) error {
	if in.PolicyVersion != PrivacyPolicyVersion {
		return ErrPolicyOutdated
	}
	for field, missing := range map[string]bool{
		"birth_date": in.BirthDate == nil, "units": in.Units == nil, "sex": in.Sex == nil,
		"height": in.Height == nil, "weight": in.Weight == nil, "athlete_groups": in.AthleteGroups == nil,
	} {
		if missing {
			return InvalidOnboardingError{Finding{field, SeverityError, "required", nil}}
		}
	}
	for _, f := range CheckOnboarding(in, time.Now().UTC()) {
		if f.Severity == SeverityError {
			return InvalidOnboardingError{f}
		}
	}

	birthDate, _ := time.Parse(time.DateOnly, *in.BirthDate) // checked above
	profile := models.Profile{
		UserID:        userID,
		BirthDate:     birthDate,
		Sex:           *in.Sex,
		AthleteGroups: in.AthleteGroups,
		MainGroup:     in.MainGroup, // checked above: nil, or one of the groups
	}
	heightCm, _ := ToCm(*in.Height) // the checks above already rejected unknown units
	weightKg, _ := ToKg(*in.Weight)
	profile.HeightCm, profile.WeightKg = round(heightCm, 1), round(weightKg, 2)
	profile.SquatKg, profile.SquatReps = liftColumns(in.Squat)
	profile.BenchKg, profile.BenchReps = liftColumns(in.Bench)
	profile.DeadliftKg, profile.DeadliftReps = liftColumns(in.Deadlift)
	if in.Endurance != nil {
		profile.EnduranceDistance, profile.EnduranceSeconds = &in.Endurance.Distance, &in.Endurance.Seconds
	}

	preferences := unitPresets[*in.Units]
	preferences.UserID, preferences.Language, preferences.Theme = userID, "en", "hydra-dark"

	err := db.AsUser(userID, func(tx *gorm.DB) error {
		var count int64
		if err := tx.Model(&models.Profile{}).Where("user_id = ?", userID).Count(&count).Error; err != nil {
			return err
		}
		if count > 0 {
			return ErrAlreadyOnboarded
		}
		if err := tx.Create(&profile).Error; err != nil {
			return err
		}
		if err := tx.Create(&preferences).Error; err != nil {
			return err
		}
		return recordConsent(tx, userID)
	})
	if isUniqueViolation(err) {
		return ErrAlreadyOnboarded // two submits at the same moment: the other one won
	}
	return err
}

// GetMe says whether the user finished onboarding and agreed to the current policy.
func GetMe(userID string) (MeStatus, error) {
	status := MeStatus{PolicyVersion: PrivacyPolicyVersion}
	err := db.AsUser(userID, func(tx *gorm.DB) error {
		var profiles int64
		if err := tx.Model(&models.Profile{}).Where("user_id = ?", userID).Count(&profiles).Error; err != nil {
			return err
		}
		status.Onboarded = profiles > 0
		var err error
		status.ConsentCurrent, err = hasCurrentConsent(tx, userID)
		return err
	})
	return status, err
}

// RecordConsent stores the user's agreement to a policy version, which must be the current one.
// Used when the policy changes after onboarding (onboarding records it itself).
func RecordConsent(userID string, policyVersion string) error {
	if policyVersion != PrivacyPolicyVersion {
		return ErrPolicyOutdated
	}
	return db.AsUser(userID, func(tx *gorm.DB) error { return recordConsent(tx, userID) })
}

// recordConsent adds the consent row; agreeing twice to the same version changes nothing.
func recordConsent(tx *gorm.DB, userID string) error {
	consent := models.Consent{UserID: userID, PolicyVersion: PrivacyPolicyVersion}
	return tx.Clauses(clause.OnConflict{DoNothing: true}).Omit("ConsentedAt").Create(&consent).Error
}

// hasCurrentConsent: did the user agree to the current policy version?
func hasCurrentConsent(tx *gorm.DB, userID string) (bool, error) {
	var count int64
	err := tx.Model(&models.Consent{}).Where("user_id = ? AND policy_version = ?", userID, PrivacyPolicyVersion).Count(&count).Error
	return count > 0, err
}

func liftColumns(lift *LiftInput) (*float64, *int) {
	if lift == nil {
		return nil, nil
	}
	kg, _ := ToKg(lift.Weight)
	kg = round(kg, 2)
	return &kg, &lift.Reps
}

func round(value float64, decimals int) float64 {
	scale := math.Pow(10, float64(decimals))
	return math.Round(value*scale) / scale
}

// isUniqueViolation: Postgres error 23505, a row with that key already exists.
func isUniqueViolation(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23505"
}
