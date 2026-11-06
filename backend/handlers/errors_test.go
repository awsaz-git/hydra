package handlers

import (
	"net/http"
	"strings"
	"testing"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	"hydra/backend/db"
	"hydra/backend/services"
)

func TestUnknownRouteUsesErrorShape(t *testing.T) {
	rec := call(t, http.MethodGet, "/nope", "", "")
	if rec.Code != http.StatusNotFound {
		t.Errorf("status = %d, want 404", rec.Code)
	}
	if code, _ := errorOf(t, rec); code != codeNotFound {
		t.Errorf("code = %q, want %q", code, codeNotFound)
	}
}

func TestErrorCodes(t *testing.T) {
	needDB(t)
	token := sign(t, "RS256", claimsFor("user_grace"))
	rec := call(t, http.MethodPost, "/api/conversations", token, "")
	if rec.Code != http.StatusCreated {
		t.Fatalf("create: status %d", rec.Code)
	}
	var created struct{ ID string }
	mustDecode(t, rec.Body.Bytes(), &created)
	messages := "/api/conversations/" + created.ID + "/messages"
	tooLong := `{"content":"` + strings.Repeat("a", services.MaxMessageLength+1) + `"}`

	tests := []struct {
		name       string
		method     string
		path       string
		body       string
		wantStatus int
		wantCode   string
	}{
		{"id isn't a UUID", http.MethodGet, "/api/conversations/123", "", http.StatusNotFound, codeConversationNotFound},
		{"no such conversation", http.MethodGet, "/api/conversations/00000000-0000-0000-0000-000000000000", "", http.StatusNotFound, codeConversationNotFound},
		{"delete a missing one", http.MethodDelete, "/api/conversations/00000000-0000-0000-0000-000000000000", "", http.StatusNotFound, codeConversationNotFound},
		{"body isn't JSON", http.MethodPost, messages, "hello", http.StatusBadRequest, codeInvalidBody},
		{"empty message", http.MethodPost, messages, `{"content":"   "}`, http.StatusBadRequest, codeMessageEmpty},
		{"message too long", http.MethodPost, messages, tooLong, http.StatusBadRequest, codeMessageTooLong},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rec := call(t, tt.method, tt.path, token, tt.body)
			if rec.Code != tt.wantStatus {
				t.Errorf("status = %d, want %d", rec.Code, tt.wantStatus)
			}
			code, params := errorOf(t, rec)
			if code != tt.wantCode {
				t.Errorf("code = %q, want %q", code, tt.wantCode)
			}
			if tt.wantCode == codeMessageTooLong && params["max"] != float64(services.MaxMessageLength) {
				t.Errorf("params = %v, want max %d", params, services.MaxMessageLength)
			}
		})
	}
}

func TestInternalErrorsDontLeak(t *testing.T) {
	needDB(t)
	// A connection that's closed: every query fails with Go's own "database is closed" error.
	broken, err := gorm.Open(postgres.Open(testAppURL()), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
	if err != nil {
		t.Fatal(err)
	}
	sqlDB, err := broken.DB()
	if err != nil {
		t.Fatal(err)
	}
	sqlDB.Close()
	saved := db.DB
	db.DB = broken
	defer func() { db.DB = saved }()

	rec := call(t, http.MethodGet, "/api/conversations", sign(t, "RS256", claimsFor("user_heidi")), "")
	if rec.Code != http.StatusInternalServerError {
		t.Errorf("status = %d, want 500", rec.Code)
	}
	if code, _ := errorOf(t, rec); code != codeInternal {
		t.Errorf("code = %q, want %q", code, codeInternal)
	}
	if strings.Contains(rec.Body.String(), "closed") || strings.Contains(rec.Body.String(), "sql") {
		t.Errorf("500 body leaks the internal error: %s", rec.Body)
	}

	rec = call(t, http.MethodGet, "/health", "", "")
	if rec.Code != http.StatusServiceUnavailable || strings.Contains(rec.Body.String(), "closed") {
		t.Errorf("health: status %d, body %s; want 503 without the error text", rec.Code, rec.Body)
	}
}
