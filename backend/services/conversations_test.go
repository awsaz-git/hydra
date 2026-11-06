package services

import (
	"errors"
	"strings"
	"testing"
)

func TestValidateMessage(t *testing.T) {
	tests := []struct {
		name    string
		text    string
		wantErr error // nil means no error expected
	}{
		{"normal message", "How many sets for chest?", nil},
		{"exactly the maximum", strings.Repeat("a", MaxMessageLength), nil},
		{"empty", "", ErrMessageEmpty},
		{"one character too long", strings.Repeat("a", MaxMessageLength+1), ErrMessageTooLong},
		{"long but multi-byte characters still count as one each", strings.Repeat("é", MaxMessageLength), nil},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidateMessage(tt.text)

			if !errors.Is(err, tt.wantErr) || (tt.wantErr == nil && err != nil) {
				t.Errorf("ValidateMessage() error = %v, want %v", err, tt.wantErr)
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
