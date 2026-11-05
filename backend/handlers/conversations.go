package handlers

import (
	"errors"
	"net/http"
	"regexp"
	"strings"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"hydra/backend/services"
)

// getConversations handles GET /api/conversations (newest activity first, for the sidebar)
func getConversations(c *gin.Context) {
	conversations, err := services.ListConversations()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, conversations)
}

// createConversation handles POST /api/conversations
func createConversation(c *gin.Context) {
	conversation, err := services.CreateConversation()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, conversation)
}

// getConversationByID handles GET /api/conversations/:id (with all its messages)
func getConversationByID(c *gin.Context) {
	id := c.Param("id")
	if !isUUID(id) {
		c.JSON(http.StatusNotFound, gin.H{"error": "conversation not found"})
		return
	}

	conversation, err := services.GetConversation(id)
	if errors.Is(err, gorm.ErrRecordNotFound) {
		c.JSON(http.StatusNotFound, gin.H{"error": "conversation not found"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, conversation)
}

// deleteConversation handles DELETE /api/conversations/:id
func deleteConversation(c *gin.Context) {
	id := c.Param("id")
	if !isUUID(id) {
		c.JSON(http.StatusNotFound, gin.H{"error": "conversation not found"})
		return
	}

	found, err := services.DeleteConversation(id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if !found {
		c.JSON(http.StatusNotFound, gin.H{"error": "conversation not found"})
		return
	}

	c.Status(http.StatusNoContent)
}

// sendMessage handles POST /api/conversations/:id/messages
// It checks the input; services.SendMessage does the actual chat flow.
func sendMessage(c *gin.Context) {
	id := c.Param("id")
	if !isUUID(id) {
		c.JSON(http.StatusNotFound, gin.H{"error": "conversation not found"})
		return
	}

	var input struct {
		Content string `json:"content"`
	}
	err := c.ShouldBindJSON(&input)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	text := strings.TrimSpace(input.Content)
	err = services.ValidateMessage(text)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// c.Request.Context() cancels the coach call if the user leaves.
	userMessage, coachMessage, err := services.SendMessage(c.Request.Context(), id, text)
	if errors.Is(err, gorm.ErrRecordNotFound) {
		c.JSON(http.StatusNotFound, gin.H{"error": "conversation not found"})
		return
	}
	if errors.Is(err, services.ErrCoachFailed) {
		c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"user_message": userMessage, "assistant_message": coachMessage})
}

var uuidPattern = regexp.MustCompile(`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`)

// isUUID checks the :id looks like a UUID before it reaches Postgres
// (a malformed one would be a database error, but it's really just "not found").
func isUUID(id string) bool {
	return uuidPattern.MatchString(id)
}
