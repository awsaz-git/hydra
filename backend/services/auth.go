package services

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/clerk/clerk-sdk-go/v2"
	"github.com/clerk/clerk-sdk-go/v2/jwt"

	"hydra/backend/db"
)

// The Clerk public key and the origins allowed to use our tokens (set once by InitAuth).
var (
	jwtKey            *clerk.JSONWebKey
	authorizedParties map[string]bool
)

// InitAuth sets up token checks from CLERK_JWT_KEY (the PEM public key from Clerk's
// dashboard) and CLERK_AUTHORIZED_PARTIES (comma-separated frontend origins).
// With the public key, every check happens here: no call to Clerk per request,
// and the backend holds no Clerk secret.
func InitAuth(pemKey string, parties string) error {
	key, err := clerk.JSONWebKeyFromPEM(pemKey)
	if err != nil {
		return fmt.Errorf("CLERK_JWT_KEY: %w", err)
	}

	allowed := map[string]bool{}
	for _, origin := range strings.Split(parties, ",") {
		if origin = strings.TrimSpace(origin); origin != "" {
			allowed[origin] = true
		}
	}
	if len(allowed) == 0 {
		return errors.New("CLERK_AUTHORIZED_PARTIES has no origins")
	}

	jwtKey, authorizedParties = key, allowed
	return nil
}

// sessionStatus reads Clerk's "sts" claim. "pending" means the user still has a task
// to finish (e.g. replace a compromised password), so they aren't fully signed in yet.
type sessionStatus struct {
	Status string `json:"sts"`
}

// VerifyToken checks a Clerk session token and returns the Clerk user ID in it.
// Checked: the signature (our instance's key), expiry, issuer, and that it was made for
// one of our frontends (azp). Any error means "not signed in"; the handler answers 401.
func VerifyToken(ctx context.Context, token string) (string, error) {
	if jwtKey == nil {
		return "", errors.New("auth is not set up (InitAuth wasn't called)")
	}

	claims, err := jwt.Verify(ctx, &jwt.VerifyParams{
		Token: token,
		JWK:   jwtKey,
		// Allow a few seconds of clock difference between Clerk and this server.
		Leeway:                  5 * time.Second,
		AuthorizedPartyHandler:  func(azp string) bool { return authorizedParties[azp] },
		CustomClaimsConstructor: func(context.Context) any { return &sessionStatus{} },
	})
	if err != nil {
		return "", err
	}

	// The JWT library accepts a token without "exp"; Clerk always sets one, so require it.
	if claims.Expiry == nil {
		return "", errors.New("token has no expiry")
	}
	if status, ok := claims.Custom.(*sessionStatus); ok && status.Status == "pending" {
		return "", errors.New("session is pending")
	}
	if claims.Subject == "" {
		return "", errors.New("token has no subject")
	}

	return claims.Subject, nil
}

// UserIDForClerk returns our user ID for a Clerk user ID, creating the user on their
// first request. It goes through hydra_user_for_clerk, the only way hydra_app can
// add a user (see 00002_users_and_ownership.sql).
func UserIDForClerk(clerkID string) (string, error) {
	var id string
	err := db.DB.Raw("SELECT hydra_user_for_clerk(?)", clerkID).Scan(&id).Error
	return id, err
}
