package handlers

import (
	"encoding/json"
	"net/http"
	"testing"
	"time"

	"gorm.io/gorm"

	"hydra/backend/db"
	"hydra/backend/models"
	"hydra/backend/services"
)

// onboardingBody is a complete, valid onboarding submit; change the map to make it invalid.
func onboardingBody(t *testing.T, change func(map[string]any)) string {
	t.Helper()
	body := map[string]any{
		"policy_version": services.PrivacyPolicyVersion,
		"birth_date":     time.Now().AddDate(-30, 0, 0).Format(time.DateOnly),
		"units":          "imperial",
		"sex":            "female",
		"height":         map[string]any{"value": 66, "unit": "in"},
		"weight":         map[string]any{"value": 150, "unit": "lb"},
		"athlete_groups": []string{"functional", "endurance"}, // no main group: it isn't asked
		"squat":          map[string]any{"weight": map[string]any{"value": 135, "unit": "lb"}, "reps": 5},
		"bench":          nil, // "I don't do this lift"
		"deadlift":       nil,
		"endurance":      map[string]any{"distance": "10k", "seconds": 55 * 60},
	}
	if change != nil {
		change(body)
	}
	b, err := json.Marshal(body)
	if err != nil {
		t.Fatal(err)
	}
	return string(b)
}

func meOf(t *testing.T, token string) services.MeStatus {
	t.Helper()
	rec := call(t, http.MethodGet, "/api/me", token, "")
	if rec.Code != http.StatusOK {
		t.Fatalf("GET /api/me: status %d %s", rec.Code, rec.Body)
	}
	var me services.MeStatus
	mustDecode(t, rec.Body.Bytes(), &me)
	return me
}

func TestOnboarding(t *testing.T) {
	needDB(t)
	ivy := sign(t, "RS256", claimsFor("user_ivy"))
	jack := sign(t, "RS256", claimsFor("user_jack"))

	// Before onboarding: not onboarded, no consent, and the coach won't take a message.
	if me := meOf(t, ivy); me.Onboarded || me.ConsentCurrent || me.PolicyVersion != services.PrivacyPolicyVersion {
		t.Fatalf("before onboarding: %+v", me)
	}
	rec := call(t, http.MethodPost, "/api/conversations", ivy, "")
	var chat models.Conversation
	mustDecode(t, rec.Body.Bytes(), &chat)
	rec = call(t, http.MethodPost, "/api/conversations/"+chat.ID+"/messages", ivy, `{"content":"hi"}`)
	if code, _ := errorOf(t, rec); rec.Code != http.StatusForbidden || code != codeConsentRequired {
		t.Fatalf("message without consent: status %d code %q, want 403 %q", rec.Code, code, codeConsentRequired)
	}

	// The check endpoint returns findings and stores nothing.
	rec = call(t, http.MethodPost, "/api/onboarding/check", ivy, `{"sex":"male","weight":{"value":80,"unit":"kg"},"squat":{"weight":{"value":200,"unit":"kg"},"reps":1}}`)
	var checked struct{ Findings []services.Finding }
	mustDecode(t, rec.Body.Bytes(), &checked)
	if rec.Code != http.StatusOK || len(checked.Findings) != 1 || checked.Findings[0].Code != "unusual_lift" {
		t.Errorf("check: status %d %s", rec.Code, rec.Body)
	}
	if me := meOf(t, ivy); me.Onboarded {
		t.Error("the check endpoint saved something")
	}

	// Rejected submits save nothing.
	rejected := []struct {
		name       string
		change     func(map[string]any)
		wantStatus int
		wantCode   string
		wantReason string
	}{
		{"under 16", func(b map[string]any) { b["birth_date"] = time.Now().AddDate(-15, 0, 0).Format(time.DateOnly) }, http.StatusBadRequest, codeInvalidOnboarding, "under_16"},
		{"no sex", func(b map[string]any) { delete(b, "sex") }, http.StatusBadRequest, codeInvalidOnboarding, "required"},
		{"impossible lift", func(b map[string]any) {
			b["squat"] = map[string]any{"weight": map[string]any{"value": 320, "unit": "kg"}, "reps": 1}
		}, http.StatusBadRequest, codeInvalidOnboarding, "impossible_lift"},
		{"old policy version", func(b map[string]any) { b["policy_version"] = "2020-01-01" }, http.StatusConflict, codePolicyOutdated, ""},
		{"not JSON", nil, http.StatusBadRequest, codeInvalidBody, ""},
	}
	for _, tt := range rejected {
		t.Run(tt.name, func(t *testing.T) {
			body := "not json"
			if tt.change != nil {
				body = onboardingBody(t, tt.change)
			}
			rec := call(t, http.MethodPost, "/api/onboarding", ivy, body)
			code, params := errorOf(t, rec)
			if rec.Code != tt.wantStatus || code != tt.wantCode || (tt.wantReason != "" && params["reason"] != tt.wantReason) {
				t.Errorf("status %d code %q params %v, want %d %q %q", rec.Code, code, params, tt.wantStatus, tt.wantCode, tt.wantReason)
			}
			if me := meOf(t, ivy); me.Onboarded || me.ConsentCurrent {
				t.Errorf("a rejected submit saved something: %+v", me)
			}
		})
	}

	// A valid submit saves everything, in stored units.
	if rec := call(t, http.MethodPost, "/api/onboarding", ivy, onboardingBody(t, nil)); rec.Code != http.StatusCreated {
		t.Fatalf("submit: status %d %s", rec.Code, rec.Body)
	}
	if me := meOf(t, ivy); !me.Onboarded || !me.ConsentCurrent {
		t.Fatalf("after onboarding: %+v", me)
	}
	ivyID, _ := services.UserIDForClerk("user_ivy")
	err := db.AsUser(ivyID, func(tx *gorm.DB) error {
		var p models.Profile
		var prefs models.Preferences
		if err := tx.First(&p, "user_id = ?", ivyID).Error; err != nil {
			return err
		}
		if err := tx.First(&prefs, "user_id = ?", ivyID).Error; err != nil {
			return err
		}
		if p.HeightCm != 167.6 || p.WeightKg != 68.04 || *p.SquatKg != 61.23 || p.BenchKg != nil || p.MainGroup != nil {
			t.Errorf("profile not stored as kg/cm: %+v", p)
		}
		if prefs.WeightUnit != "lb" || prefs.HeightUnit != "ft_in" || prefs.EnergyUnit != "kcal" || prefs.Language != "en" {
			t.Errorf("preferences: %+v", prefs)
		}
		return nil
	})
	if err != nil {
		t.Fatal(err)
	}

	// Only once.
	if rec := call(t, http.MethodPost, "/api/onboarding", ivy, onboardingBody(t, nil)); rec.Code != http.StatusConflict {
		t.Errorf("second submit: status %d, want 409", rec.Code)
	}

	// Jack is untouched by Ivy's onboarding, and can't see her profile even without a WHERE.
	if me := meOf(t, jack); me.Onboarded || me.ConsentCurrent {
		t.Errorf("jack: %+v", me)
	}
	jackID, _ := services.UserIDForClerk("user_jack")
	err = db.AsUser(jackID, func(tx *gorm.DB) error {
		var count int64
		if err := tx.Model(&models.Profile{}).Count(&count).Error; err != nil {
			return err
		}
		if count != 0 {
			t.Errorf("jack sees %d profiles, want 0", count)
		}
		return nil
	})
	if err != nil {
		t.Fatal(err)
	}
}

func TestConsent(t *testing.T) {
	needDB(t)
	kim := sign(t, "RS256", claimsFor("user_kim"))

	rec := call(t, http.MethodPost, "/api/consent", kim, `{"policy_version":"2020-01-01"}`)
	if code, params := errorOf(t, rec); rec.Code != http.StatusConflict || code != codePolicyOutdated || params["current_version"] != services.PrivacyPolicyVersion {
		t.Errorf("old version: status %d code %q params %v", rec.Code, code, params)
	}
	for i := 1; i <= 2; i++ { // agreeing twice is fine and changes nothing
		if rec := call(t, http.MethodPost, "/api/consent", kim, `{"policy_version":"`+services.PrivacyPolicyVersion+`"}`); rec.Code != http.StatusCreated {
			t.Fatalf("consent %d: status %d %s", i, rec.Code, rec.Body)
		}
	}
	if me := meOf(t, kim); !me.ConsentCurrent || me.Onboarded {
		t.Errorf("after consent: %+v", me)
	}
}
