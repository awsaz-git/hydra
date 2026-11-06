package handlers

import (
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
)

// Error codes the API sends. They're stable: the frontend translates them
// (messages/*.json → errors.<code>), so never rename one. The list is in docs/ENGINEERING.md.
const (
	codeNotSignedIn          = "not_signed_in"
	codeTooManyRequests      = "too_many_requests"
	codeNotFound             = "not_found"
	codeConversationNotFound = "conversation_not_found"
	codeInvalidBody          = "invalid_body"
	codeMessageEmpty         = "message_empty"
	codeMessageTooLong       = "message_too_long"
	codeCoachUnavailable     = "coach_unavailable"
	codeInternal             = "internal"
)

// respondError answers with the API's one error shape and stops the request:
//
//	{"error": {"code": "message_too_long", "message": "Message is too long", "params": {"max": 4000}}}
//
// message is English, for logs and curl; the UI shows its own text for the code.
// params (optional) are values the UI text needs.
func respondError(c *gin.Context, status int, code string, message string, params gin.H) {
	body := gin.H{"code": code, "message": message}
	if params != nil {
		body["params"] = params
	}
	c.AbortWithStatusJSON(status, gin.H{"error": body})
}

// respondInternal is for errors we didn't expect. The real error goes to the log only:
// it can contain database or internal details that must never reach a client.
func respondInternal(c *gin.Context, err error) {
	log.Printf("internal error on %s %s: %v", c.Request.Method, c.FullPath(), err)
	respondError(c, http.StatusInternalServerError, codeInternal, "Something went wrong", nil)
}
