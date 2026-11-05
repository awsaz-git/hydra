package services

import (
	"strings"
	"testing"
)

func TestValidateMessage(t *testing.T) {
	tests := []struct {
		name    string
		text    string
		wantErr string // "" means no error expected
	}{
		{"normal message", "How many sets for chest?", ""},
		{"exactly 4000 characters", strings.Repeat("a", 4000), ""},
		{"empty", "", "message can't be empty"},
		{"too long", strings.Repeat("a", 4001), "message must be 4000 characters or less"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidateMessage(tt.text)

			got := ""
			if err != nil {
				got = err.Error()
			}

			if got != tt.wantErr {
				t.Errorf("ValidateMessage() error = %q, want %q", got, tt.wantErr)
			}
		})
	}
}

func TestTitleFrom(t *testing.T) {
	tests := []struct {
		name string
		text string
		want string
	}{
		{"short stays as is", "Deload week?", "Deload week?"},
		{"extra spaces collapsed", "how many\n\n  sets   for chest", "how many sets for chest"},
		{"long is cut at a word", "I can train four days a week and I want to get faster without losing any strength", "I can train four days a week and I want to get faster…"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := titleFrom(tt.text)

			if got != tt.want {
				t.Errorf("titleFrom() = %q, want %q", got, tt.want)
			}
		})
	}
}
