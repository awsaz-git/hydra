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
		c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "not signed in"})
		return
	}

	clerkID, err := services.VerifyToken(c.Request.Context(), token)
	if err != nil {
		log.Println("auth: rejected token:", err) // the reason only, never the token
		c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "not signed in"})
		return
	}

	userID, err := services.UserIDForClerk(clerkID)
	if err != nil {
		log.Println("auth: user lookup failed:", err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "something went wrong"})
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
			log.Println("rate limit check failed:", err)
			c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "something went wrong"})
			return
		}
		if wait > 0 {
			c.Header("Retry-After", strconv.Itoa(int(wait.Seconds())))
			c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{"error": "too many requests, please wait a moment"})
			return
		}
		c.Next()
	}
}

// currentUser is the signed-in user's ID, set by requireAuth.
func currentUser(c *gin.Context) string {
	return c.GetString(userIDKey)
}
