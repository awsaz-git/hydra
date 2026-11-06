package models

import "time"

// The struct User maps to the table "users": our own ID for a Clerk account.
// Users are only created by the database function hydra_user_for_clerk (services/auth.go).
type User struct {
	ID        string    `json:"id"         gorm:"type:uuid;primaryKey;default:gen_random_uuid()"`
	ClerkID   string    `json:"-"          gorm:"not null;unique"`
	CreatedAt time.Time `json:"created_at"`
}

// The struct Conversation maps to the table "conversations".
type Conversation struct {
	ID        string    `json:"id"         gorm:"type:uuid;primaryKey;default:gen_random_uuid()"`
	UserID    string    `json:"-"          gorm:"type:uuid;not null;index"`
	Title     string    `json:"title"      gorm:"not null"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`

	// One conversation has many messages; deleting a conversation deletes its messages.
	Messages []Message `json:"messages,omitempty" gorm:"constraint:OnDelete:CASCADE"`
}

// The struct Message maps to the table "messages".
// UserID is a copy of its conversation's owner (D5); the database checks they match.
type Message struct {
	ID             int64     `json:"id"         gorm:"primaryKey"`
	ConversationID string    `json:"-"          gorm:"type:uuid;not null;index"`
	UserID         string    `json:"-"          gorm:"type:uuid;not null;index"`
	Role           string    `json:"role"       gorm:"not null"` // "user" or "assistant"
	Content        string    `json:"content"    gorm:"not null"`
	CreatedAt      time.Time `json:"created_at"`
}

// The struct Profile maps to the table "profiles": the athlete profile from onboarding.
// Everything is stored in kg, cm and seconds; the user's units only change how it's shown.
// Lift and endurance fields are nil when the user skipped them.
type Profile struct {
	UserID            string    `json:"-"                  gorm:"type:uuid;primaryKey"`
	BirthDate         time.Time `json:"birth_date"         gorm:"type:date;not null"`
	Sex               string    `json:"sex"                gorm:"not null"` // "male" or "female"
	HeightCm          float64   `json:"height_cm"          gorm:"not null"`
	WeightKg          float64   `json:"weight_kg"          gorm:"not null"`
	AthleteGroups     []string  `json:"athlete_groups"     gorm:"type:jsonb;serializer:json;not null"`
	MainGroup         *string   `json:"main_group"` // not asked in onboarding: set later (settings or the coach)
	SquatKg           *float64  `json:"squat_kg"`
	SquatReps         *int      `json:"squat_reps"`
	BenchKg           *float64  `json:"bench_kg"`
	BenchReps         *int      `json:"bench_reps"`
	DeadliftKg        *float64  `json:"deadlift_kg"`
	DeadliftReps      *int      `json:"deadlift_reps"`
	EnduranceDistance *string   `json:"endurance_distance"` // "5k", "10k", "half", "full"
	EnduranceSeconds  *int      `json:"endurance_seconds"`
	CreatedAt         time.Time `json:"created_at"`
	UpdatedAt         time.Time `json:"updated_at"`
}

// The struct Preferences maps to the table "preferences": how the app shows things to the user.
type Preferences struct {
	UserID            string    `json:"-"                   gorm:"type:uuid;primaryKey"`
	Language          string    `json:"language"            gorm:"not null"`
	Theme             string    `json:"theme"               gorm:"not null"`
	WeightUnit        string    `json:"weight_unit"         gorm:"not null"` // "kg" or "lb"
	DistanceUnit      string    `json:"distance_unit"       gorm:"not null"` // "km" or "mi"
	ShortDistanceUnit string    `json:"short_distance_unit" gorm:"not null"` // "m" or "yd"
	HeightUnit        string    `json:"height_unit"         gorm:"not null"` // "cm" or "ft_in"
	EnergyUnit        string    `json:"energy_unit"         gorm:"not null"` // "kcal" or "kj"
	CreatedAt         time.Time `json:"created_at"`
	UpdatedAt         time.Time `json:"updated_at"`
}

// The struct Consent maps to the table "consents": which privacy policy version a user agreed to.
type Consent struct {
	ID            int64     `json:"id"             gorm:"primaryKey"`
	UserID        string    `json:"-"              gorm:"type:uuid;not null"`
	PolicyVersion string    `json:"policy_version" gorm:"not null"`
	ConsentedAt   time.Time `json:"consented_at"   gorm:"not null;default:now()"`
}

// TableName: GORM would otherwise call the table "preferences" too, but the struct name is
// plural already; this keeps it explicit.
func (Preferences) TableName() string { return "preferences" }
