package handlers

import (
	"log"
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"

	"hydra/backend/services"
)

// userIDKey is where requireAuth stores the signed-in user's ID in the Gin context.
const userIDKey = "userID"

// noStore tells every cache (browser, proxy, CDN) not to keep API responses:
// they're always one user's private data.
func noStore(c *gin.Context) {
	c.Header("Cache-Control", "no-store")
	c.Next()
}

// requireAuth lets a request through only with a valid Clerk session token
// ("Authorization: Bearer <token>", added by the Next.js proxy). It puts our user ID
// in the context for the handlers. Anything wrong → 401 and the handler never runs.
func requireAuth(c *gin.Context) {
	token, found := strings.CutPrefix(c.GetHeader("Authorization"), "Bearer ")
	if !found || token == "" {
		respondError(c, http.StatusUnauthorized, codeNotSignedIn, "Not signed in", nil)
		return
	}

	clerkID, err := services.VerifyToken(c.Request.Context(), token)
	if err != nil {
		log.Println("auth: rejected token:", err) // the reason only, never the token
		respondError(c, http.StatusUnauthorized, codeNotSignedIn, "Not signed in", nil)
		return
	}

	userID, err := services.UserIDForClerk(clerkID)
	if err != nil {
		respondInternal(c, err)
		return
	}

	c.Set(userIDKey, userID)
	c.Next()
}

// rateLimit counts the request in a bucket (services.RateLimits) for the signed-in user.
// Over the limit → 429 with Retry-After (seconds). Must come after requireAuth.
func rateLimit(bucket string) gin.HandlerFunc {
	return func(c *gin.Context) {
		wait, err := services.CheckRateLimit(currentUser(c), bucket)
		if err != nil {
			respondInternal(c, err)
			return
		}
		if wait > 0 {
			seconds := int(wait.Seconds())
			c.Header("Retry-After", strconv.Itoa(seconds))
			respondError(c, http.StatusTooManyRequests, codeTooManyRequests, "Too many requests, please wait a moment",
				gin.H{"retry_after": seconds})
			return
		}
		c.Next()
	}
}

// currentUser is the signed-in user's ID, set by requireAuth.
func currentUser(c *gin.Context) string {
	return c.GetString(userIDKey)
}
