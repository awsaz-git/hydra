package services

import (
	"strings"
	"testing"
)

func TestPromptFor(t *testing.T) {
	tests := []struct {
		name      string
		coachName string
		wantStart string
	}{
		{"current name", "Hydra", "You are Hydra, "},
		{"after a rename", "Atlas", "You are Atlas, "},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := promptFor(tt.coachName)

			if !strings.HasPrefix(got, tt.wantStart) {
				t.Errorf("promptFor(%q) starts with %q, want %q", tt.coachName, got[:30], tt.wantStart)
			}
			if strings.Contains(got, "{{") {
				t.Errorf("promptFor(%q) still has an unfilled {{placeholder}}", tt.coachName)
			}
		})
	}
}
