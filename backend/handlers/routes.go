package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// RegisterRoutes connects every endpoint to its handler. All routes live here.
func RegisterRoutes(router *gin.Engine) {
	router.GET("/health", health) // public: used by checks, shows no user data

	// Unknown paths get the same error shape as everything else (Gin's default is plain text).
	router.NoRoute(func(c *gin.Context) {
		respondError(c, http.StatusNotFound, codeNotFound, "Not found", nil)
	})

	// Everything under /api: never cached, signed-in users only, rate-limited per user.
	api := router.Group("/api", noStore, requireAuth, rateLimit("api"))
	api.GET("/me", getMe) // onboarding done? consent current?
	api.POST("/onboarding/check", checkOnboarding)
	api.POST("/onboarding", submitOnboarding)
	api.POST("/consent", giveConsent)
	api.GET("/conversations", getConversations)
	api.POST("/conversations", createConversation)
	api.GET("/conversations/:id", getConversationByID)
	api.DELETE("/conversations/:id", deleteConversation)
	// Each message is an LLM call, so it also counts against the stricter "chat" limit.
	api.POST("/conversations/:id/messages", rateLimit("chat"), sendMessage)
}
