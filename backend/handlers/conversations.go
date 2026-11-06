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
	conversations, err := services.ListConversations(currentUser(c))
	if err != nil {
		respondInternal(c, err)
		return
	}

	c.JSON(http.StatusOK, conversations)
}

// createConversation handles POST /api/conversations
func createConversation(c *gin.Context) {
	conversation, err := services.CreateConversation(currentUser(c))
	if err != nil {
		respondInternal(c, err)
		return
	}

	c.JSON(http.StatusCreated, conversation)
}

// getConversationByID handles GET /api/conversations/:id (with all its messages)
func getConversationByID(c *gin.Context) {
	id := c.Param("id")
	if !isUUID(id) {
		conversationNotFound(c)
		return
	}

	conversation, err := services.GetConversation(currentUser(c), id)
	if errors.Is(err, gorm.ErrRecordNotFound) {
		conversationNotFound(c)
		return
	}
	if err != nil {
		respondInternal(c, err)
		return
	}

	c.JSON(http.StatusOK, conversation)
}

// deleteConversation handles DELETE /api/conversations/:id
func deleteConversation(c *gin.Context) {
	id := c.Param("id")
	if !isUUID(id) {
		conversationNotFound(c)
		return
	}

	found, err := services.DeleteConversation(currentUser(c), id)
	if err != nil {
		respondInternal(c, err)
		return
	}
	if !found {
		conversationNotFound(c)
		return
	}

	c.Status(http.StatusNoContent)
}

// sendMessage handles POST /api/conversations/:id/messages
// It checks the input; services.SendMessage does the actual chat flow.
func sendMessage(c *gin.Context) {
	id := c.Param("id")
	if !isUUID(id) {
		conversationNotFound(c)
		return
	}

	var input struct {
		Content string `json:"content"`
	}
	err := c.ShouldBindJSON(&input)
	if err != nil {
		respondError(c, http.StatusBadRequest, codeInvalidBody, `The body must be JSON like {"content": "..."}`, nil)
		return
	}

	text := strings.TrimSpace(input.Content)
	err = services.ValidateMessage(text)
	if errors.Is(err, services.ErrMessageEmpty) {
		respondError(c, http.StatusBadRequest, codeMessageEmpty, "Message can't be empty", nil)
		return
	}
	if errors.Is(err, services.ErrMessageTooLong) {
		respondError(c, http.StatusBadRequest, codeMessageTooLong, "Message is too long",
			gin.H{"max": services.MaxMessageLength})
		return
	}

	// c.Request.Context() cancels the coach call if the user leaves.
	userMessage, coachMessage, err := services.SendMessage(c.Request.Context(), currentUser(c), id, text)
	if errors.Is(err, gorm.ErrRecordNotFound) {
		conversationNotFound(c)
		return
	}
	if errors.Is(err, services.ErrConsentRequired) {
		respondError(c, http.StatusForbidden, codeConsentRequired, "Agree to the current privacy policy first", nil)
		return
	}
	if errors.Is(err, services.ErrCoachFailed) {
		respondError(c, http.StatusBadGateway, codeCoachUnavailable, "The coach couldn't answer right now, please try again", nil)
		return
	}
	if err != nil {
		respondInternal(c, err)
		return
	}

	c.JSON(http.StatusCreated, gin.H{"user_message": userMessage, "assistant_message": coachMessage})
}

// conversationNotFound is the answer for a missing conversation AND for someone else's:
// the same 404, so nobody can tell whether a conversation exists.
func conversationNotFound(c *gin.Context) {
	respondError(c, http.StatusNotFound, codeConversationNotFound, "Conversation not found", nil)
}

var uuidPattern = regexp.MustCompile(`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`)

// isUUID checks the :id looks like a UUID before it reaches Postgres
// (a malformed one would be a database error, but it's really just "not found").
func isUUID(id string) bool {
	return uuidPattern.MatchString(id)
}
