// Shapes of the JSON the Go backend returns (see backend/models/models.go).

export type Role = "user" | "assistant"

export interface Message {
  id: number
  role: Role
  content: string
  created_at: string
}

export interface Conversation {
  id: string
  title: string
  created_at: string
  updated_at: string
  messages?: Message[] // only included when fetching one conversation
}

export interface SendMessageResult {
  user_message: Message
  assistant_message: Message
}

// GET /api/me: where the app sends the user (onboarding until both are true).
export interface MeStatus {
  onboarded: boolean
  consent_current: boolean
  policy_version: string
}

// A measurement as the user typed it; the backend converts (D23).
export interface Measurement {
  value: number
  unit: "kg" | "lb" | "cm" | "in"
}

export interface LiftInput {
  weight: Measurement
  reps: number
}

export type Lift = "squat" | "bench" | "deadlift"
export type RaceDistance = "5k" | "10k" | "half" | "full"

// POST /api/onboarding (and /check, which takes what a page has so far).
// null = skipped ("I don't do this lift", no race result).
export interface OnboardingInput {
  policy_version?: string
  birth_date?: string // YYYY-MM-DD
  units?: "metric" | "imperial"
  sex?: "male" | "female"
  height?: Measurement
  weight?: Measurement
  athlete_groups?: string[]
  main_group?: string
  squat?: LiftInput | null
  bench?: LiftInput | null
  deadlift?: LiftInput | null
  endurance?: { distance: RaceDistance; seconds: number } | null
}

// One result of the onboarding checks. Params are in kg, cm and seconds.
export interface Finding {
  field: string
  severity: "error" | "warning"
  code: string
  params?: Record<string, string | number>
}
