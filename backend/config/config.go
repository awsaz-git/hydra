package config

import "os"

// GetEnv returns the environment variable, or fallback if it isn't set.
func GetEnv(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}
