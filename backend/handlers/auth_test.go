package handlers

// Tests for auth, data ownership and rate limits, through the real router.
//
// The token tests always run. The database tests need a throwaway Postgres set up like Neon
// (see docs/ENGINEERING.md → API access rules) and run only when these are set:
//   TEST_MIGRATE_DATABASE_URL  hydra_owner: migrates and empties the test database
//   TEST_DATABASE_URL          hydra_app: what the tests run as, so RLS is really exercised
// Never point them at Neon: the tests delete every user.

import (
	"crypto"
	"crypto/hmac"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"encoding/json"
	"encoding/pem"
	"log"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	"hydra/backend/db"
	"hydra/backend/models"
	"hydra/backend/services"
)

const testOrigin = "http://localhost:3000"

var (
	signingKey *rsa.PrivateKey // plays Clerk's private key
	publicPEM  []byte          // what CLERK_JWT_KEY would hold
	hasDB      bool
)

func TestMain(m *testing.M) {
	gin.SetMode(gin.TestMode)

	var err error
	signingKey, err = rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		log.Fatal(err)
	}
	der, err := x509.MarshalPKIXPublicKey(&signingKey.PublicKey)
	if err != nil {
		log.Fatal(err)
	}
	publicPEM = pem.EncodeToMemory(&pem.Block{Type: "PUBLIC KEY", Bytes: der})
	if err := services.InitAuth(string(publicPEM), testOrigin); err != nil {
		log.Fatal(err)
	}

	if os.Getenv("TEST_DATABASE_URL") != "" {
		setUpDatabase()
		hasDB = true
	}
	os.Exit(m.Run())
}

// setUpDatabase migrates the test database, empties it, and connects as hydra_app.
func setUpDatabase() {
	quiet := &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)}

	owner, err := gorm.Open(postgres.Open(os.Getenv("TEST_MIGRATE_DATABASE_URL")), quiet)
	if err != nil {
		log.Fatal("test db (owner): ", err)
	}
	if err := db.Migrate(owner); err != nil {
		log.Fatal("test db migrate: ", err)
	}
	if err := owner.Exec("TRUNCATE users, rate_limits CASCADE").Error; err != nil {
		log.Fatal("test db reset: ", err)
	}

	db.DB, err = gorm.Open(postgres.Open(os.Getenv("TEST_DATABASE_URL")), quiet)
	if err != nil {
		log.Fatal("test db (app): ", err)
	}
}

func needDB(t *testing.T) {
	t.Helper()
	if !hasDB {
		t.Skip("set TEST_DATABASE_URL and TEST_MIGRATE_DATABASE_URL to run the database tests")
	}
}

// claimsFor are the claims of a valid Clerk session token for a Clerk user.
func claimsFor(clerkID string) map[string]any {
	now := time.Now().Unix()
	return map[string]any{
		"sub": clerkID,
		"azp": testOrigin,
		"iss": "https://test.clerk.accounts.dev",
		"sid": "sess_test",
		"iat": now,
		"nbf": now - 5,
		"exp": now + 60,
	}
}

// sign builds a JWT. alg "RS256" signs with signingKey; "HS256" signs with the public key
// as an HMAC secret (the classic "algorithm confusion" attack); "none" leaves it unsigned.
func sign(t *testing.T, alg string, claims map[string]any) string {
	t.Helper()
	encode := func(v any) string {
		b, err := json.Marshal(v)
		if err != nil {
			t.Fatal(err)
		}
		return base64.RawURLEncoding.EncodeToString(b)
	}

	unsigned := encode(map[string]string{"alg": alg, "typ": "JWT", "kid": "test"}) + "." + encode(claims)
	var sig []byte
	switch alg {
	case "RS256":
		digest := sha256.Sum256([]byte(unsigned))
		var err error
		sig, err = rsa.SignPKCS1v15(rand.Reader, signingKey, crypto.SHA256, digest[:])
		if err != nil {
			t.Fatal(err)
		}
	case "HS256":
		mac := hmac.New(sha256.New, publicPEM)
		mac.Write([]byte(unsigned))
		sig = mac.Sum(nil)
	}
	return unsigned + "." + base64.RawURLEncoding.EncodeToString(sig)
}

// call sends one request through the real router (all middleware included).
func call(t *testing.T, method, path, token string, body string) *httptest.ResponseRecorder {
	t.Helper()
	router := gin.New()
	RegisterRoutes(router)

	req := httptest.NewRequest(method, path, strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	return rec
}

func TestRejectsBadTokens(t *testing.T) {
	// Each case changes one thing about an otherwise valid token.
	with := func(change func(map[string]any)) map[string]any {
		claims := claimsFor("user_test")
		change(claims)
		return claims
	}
	otherKey, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatal(err)
	}

	tests := []struct {
		name          string
		authorization string // the whole header; "" sends none
	}{
		{"no header", ""},
		{"not a bearer token", "Basic dXNlcjpwYXNz"},
		{"empty bearer", "Bearer "},
		{"garbage", "Bearer not.a.jwt"},
		{"expired", "Bearer " + sign(t, "RS256", with(func(c map[string]any) { c["exp"] = time.Now().Add(-time.Minute).Unix() }))},
		{"no expiry", "Bearer " + sign(t, "RS256", with(func(c map[string]any) { delete(c, "exp") }))},
		{"not valid yet", "Bearer " + sign(t, "RS256", with(func(c map[string]any) { c["nbf"] = time.Now().Add(time.Minute).Unix() }))},
		{"other frontend (azp)", "Bearer " + sign(t, "RS256", with(func(c map[string]any) { c["azp"] = "https://evil.example" }))},
		{"no azp", "Bearer " + sign(t, "RS256", with(func(c map[string]any) { delete(c, "azp") }))},
		{"not Clerk's issuer", "Bearer " + sign(t, "RS256", with(func(c map[string]any) { c["iss"] = "https://evil.example" }))},
		{"pending session", "Bearer " + sign(t, "RS256", with(func(c map[string]any) { c["sts"] = "pending" }))},
		{"no subject", "Bearer " + sign(t, "RS256", with(func(c map[string]any) { delete(c, "sub") }))},
		{"HS256 with the public key", "Bearer " + sign(t, "HS256", claimsFor("user_test"))},
		{"unsigned (alg none)", "Bearer " + sign(t, "none", claimsFor("user_test"))},
		{"signed by another key", "Bearer " + func() string {
			saved := signingKey
			signingKey = otherKey
			defer func() { signingKey = saved }()
			return sign(t, "RS256", claimsFor("user_test"))
		}()},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			router := gin.New()
			RegisterRoutes(router)
			req := httptest.NewRequest(http.MethodGet, "/api/conversations", nil)
			if tt.authorization != "" {
				req.Header.Set("Authorization", tt.authorization)
			}
			rec := httptest.NewRecorder()
			router.ServeHTTP(rec, req)

			if rec.Code != http.StatusUnauthorized {
				t.Errorf("status = %d, want 401", rec.Code)
			}
			if got := rec.Header().Get("Cache-Control"); got != "no-store" {
				t.Errorf("Cache-Control = %q, want no-store", got)
			}
		})
	}
}

func TestUsersOnlyReachTheirOwnChats(t *testing.T) {
	needDB(t)
	alice := sign(t, "RS256", claimsFor("user_alice"))
	bob := sign(t, "RS256", claimsFor("user_bob"))

	// Alice creates a chat.
	rec := call(t, http.MethodPost, "/api/conversations", alice, "")
	if rec.Code != http.StatusCreated {
		t.Fatalf("alice create: status %d, body %s", rec.Code, rec.Body)
	}
	if got := rec.Header().Get("Cache-Control"); got != "no-store" {
		t.Errorf("Cache-Control = %q, want no-store", got)
	}
	var created models.Conversation
	if err := json.Unmarshal(rec.Body.Bytes(), &created); err != nil || created.ID == "" {
		t.Fatalf("alice create: bad body %s", rec.Body)
	}
	path := "/api/conversations/" + created.ID

	// Bob can't see, read, message or delete it: always 404, as if it didn't exist.
	bobTries := []struct{ method, path, body string }{
		{http.MethodGet, path, ""},
		{http.MethodDelete, path, ""},
		{http.MethodPost, path + "/messages", `{"content":"hi"}`}, // 404 before any LLM call
	}
	for _, try := range bobTries {
		if rec := call(t, try.method, try.path, bob, try.body); rec.Code != http.StatusNotFound {
			t.Errorf("bob %s %s: status %d, want 404", try.method, try.path, rec.Code)
		}
	}
	if rec := call(t, http.MethodGet, "/api/conversations", bob, ""); strings.Contains(rec.Body.String(), created.ID) {
		t.Errorf("bob's list contains alice's chat: %s", rec.Body)
	}

	// Alice's chat is untouched, and she can still delete it herself.
	if rec := call(t, http.MethodGet, "/api/conversations", alice, ""); !strings.Contains(rec.Body.String(), created.ID) {
		t.Errorf("alice's list is missing her chat: %s", rec.Body)
	}
	if rec := call(t, http.MethodGet, path, alice, ""); rec.Code != http.StatusOK {
		t.Errorf("alice get: status %d, want 200", rec.Code)
	}
	if rec := call(t, http.MethodDelete, path, alice, ""); rec.Code != http.StatusNoContent {
		t.Errorf("alice delete: status %d, want 204", rec.Code)
	}
}

func TestRowLevelSecurityWithoutWhere(t *testing.T) {
	needDB(t)
	// Even a query that forgets "WHERE user_id" only sees the current user's rows.
	carol, err := services.UserIDForClerk("user_carol")
	if err != nil {
		t.Fatal(err)
	}
	dave, err := services.UserIDForClerk("user_dave")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := services.CreateConversation(carol); err != nil {
		t.Fatal(err)
	}

	err = db.AsUser(dave, func(tx *gorm.DB) error {
		var count int64
		if err := tx.Model(&models.Conversation{}).Count(&count).Error; err != nil {
			return err
		}
		if count != 0 {
			t.Errorf("dave sees %d conversations without a WHERE, want 0", count)
		}
		return nil
	})
	if err != nil {
		t.Fatal(err)
	}

	// And he can't create one in carol's name (RLS's WITH CHECK rejects the row).
	err = db.AsUser(dave, func(tx *gorm.DB) error {
		return tx.Create(&models.Conversation{UserID: carol}).Error
	})
	if err == nil || !strings.Contains(err.Error(), "row-level security") {
		t.Errorf("dave creating a conversation owned by carol: err = %v, want an RLS violation", err)
	}

	// Outside AsUser no user is set, so nothing is visible at all.
	var count int64
	if err := db.DB.Model(&models.Conversation{}).Count(&count).Error; err != nil {
		t.Fatal(err)
	}
	if count != 0 {
		t.Errorf("with no user set, %d conversations are visible, want 0", count)
	}
}

func TestRateLimit(t *testing.T) {
	needDB(t)
	saved := services.RateLimits["api"]
	services.RateLimits["api"] = services.Limit{Requests: 2, Window: time.Minute}
	defer func() { services.RateLimits["api"] = saved }()

	erin := sign(t, "RS256", claimsFor("user_erin"))
	for i := 1; i <= 2; i++ {
		if rec := call(t, http.MethodGet, "/api/conversations", erin, ""); rec.Code != http.StatusOK {
			t.Fatalf("request %d: status %d, want 200", i, rec.Code)
		}
	}
	rec := call(t, http.MethodGet, "/api/conversations", erin, "")
	if rec.Code != http.StatusTooManyRequests {
		t.Fatalf("request 3: status %d, want 429", rec.Code)
	}
	if rec.Header().Get("Retry-After") == "" {
		t.Error("429 without Retry-After")
	}

	// Another user has their own count.
	frank := sign(t, "RS256", claimsFor("user_frank"))
	if rec := call(t, http.MethodGet, "/api/conversations", frank, ""); rec.Code != http.StatusOK {
		t.Errorf("frank: status %d, want 200", rec.Code)
	}
}

func TestHealthIsPublic(t *testing.T) {
	needDB(t)
	if rec := call(t, http.MethodGet, "/health", "", ""); rec.Code != http.StatusOK {
		t.Errorf("status %d, want 200", rec.Code)
	}
}
