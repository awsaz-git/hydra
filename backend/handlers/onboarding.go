package handlers

import (
	"errors"
	"maps"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"

	"hydra/backend/services"
)

// getMe handles GET /api/me: has the user finished onboarding and agreed to the current policy?
// The frontend uses it to decide whether to send them to onboarding.
func getMe(c *gin.Context) {
	status, err := services.GetMe(currentUser(c))
	if err != nil {
		respondInternal(c, err)
		return
	}

	c.JSON(http.StatusOK, status)
}

// checkOnboarding handles POST /api/onboarding/check: runs the checks on what a page has so far
// and returns the findings (at most one per field: "blocked" or a warning). It stores nothing.
func checkOnboarding(c *gin.Context) {
	var input services.OnboardingInput
	if err := c.ShouldBindJSON(&input); err != nil {
		respondError(c, http.StatusBadRequest, codeInvalidBody, "The body must be the onboarding answers as JSON", nil)
		return
	}

	findings := services.CheckOnboarding(input, time.Now().UTC())
	if findings == nil {
		findings = []services.Finding{} // [] rather than null
	}
	c.JSON(http.StatusOK, gin.H{"findings": findings})
}

// submitOnboarding handles POST /api/onboarding: saves the profile, preferences and consent.
func submitOnboarding(c *gin.Context) {
	var input services.OnboardingInput
	if err := c.ShouldBindJSON(&input); err != nil {
		respondError(c, http.StatusBadRequest, codeInvalidBody, "The body must be the onboarding answers as JSON", nil)
		return
	}

	err := services.SubmitOnboarding(currentUser(c), input)
	var invalid services.InvalidOnboardingError
	switch {
	case errors.As(err, &invalid):
		params := gin.H{"field": invalid.Finding.Field, "reason": invalid.Finding.Code}
		maps.Copy(params, invalid.Finding.Params)
		respondError(c, http.StatusBadRequest, codeInvalidOnboarding, "An onboarding answer isn't valid", params)
	case errors.Is(err, services.ErrPolicyOutdated):
		policyOutdated(c)
	case errors.Is(err, services.ErrAlreadyOnboarded):
		respondError(c, http.StatusConflict, codeAlreadyOnboarded, "Onboarding is already done", nil)
	case err != nil:
		respondInternal(c, err)
	default:
		c.Status(http.StatusCreated)
	}
}

// giveConsent handles POST /api/consent {"policy_version": "..."}: agreeing to a new policy
// version after onboarding.
func giveConsent(c *gin.Context) {
	var input struct {
		PolicyVersion string `json:"policy_version"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		respondError(c, http.StatusBadRequest, codeInvalidBody, `The body must be JSON like {"policy_version": "..."}`, nil)
		return
	}

	err := services.RecordConsent(currentUser(c), input.PolicyVersion)
	if errors.Is(err, services.ErrPolicyOutdated) {
		policyOutdated(c)
		return
	}
	if err != nil {
		respondInternal(c, err)
		return
	}

	c.Status(http.StatusCreated)
}

// policyOutdated: the version the user agreed to isn't the current one (reload and read it again).
func policyOutdated(c *gin.Context) {
	respondError(c, http.StatusConflict, codePolicyOutdated, "That isn't the current privacy policy",
		gin.H{"current_version": services.PrivacyPolicyVersion})
}
