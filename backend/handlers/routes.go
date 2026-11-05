package handlers

import "github.com/gin-gonic/gin"

// RegisterRoutes connects every endpoint to its handler. All routes live here.
func RegisterRoutes(router *gin.Engine) {
	router.GET("/health", health)
	router.GET("/api/conversations", getConversations)
	router.POST("/api/conversations", createConversation)
	router.GET("/api/conversations/:id", getConversationByID)
	router.DELETE("/api/conversations/:id", deleteConversation)
	router.POST("/api/conversations/:id/messages", sendMessage)
}
