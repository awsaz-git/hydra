package services

import (
	"fmt"
	"time"

	"hydra/backend/db"
)

// Limit is how many requests a user may make per window.
type Limit struct {
	Requests int
	Window   time.Duration
}

// RateLimits per bucket. The bucket names must match the CHECK on rate_limits.bucket.
// "chat" is the costly one (each message is an LLM call), as in FEATURE-PLAN 7.1.
var RateLimits = map[string]Limit{
	"api":  {Requests: 120, Window: time.Minute},
	"chat": {Requests: 20, Window: 10 * time.Minute},
}

// CheckRateLimit counts one request for the user in a bucket and returns how long they
// must wait: 0 if this request is allowed. The count lives in the database
// (hydra_rate_limit_hit), so all backend replicas share it.
func CheckRateLimit(userID string, bucket string) (time.Duration, error) {
	limit, ok := RateLimits[bucket]
	if !ok {
		return 0, fmt.Errorf("unknown rate limit bucket %q", bucket)
	}

	var waitSeconds int
	err := db.DB.Raw("SELECT hydra_rate_limit_hit(?, ?, ?, ?)",
		userID, bucket, limit.Requests, int(limit.Window.Seconds())).Scan(&waitSeconds).Error
	return time.Duration(waitSeconds) * time.Second, err
}
