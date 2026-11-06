package services

import (
	"context"
	"errors"
	"log"
	"slices"
	"strings"
	"time"
	"unicode/utf8"

	"gorm.io/gorm"

	"hydra/backend/db"
	"hydra/backend/models"
)

// How many past messages the coach "remembers" when it answers.
const contextMessages = 20

// MaxMessageLength is the longest message a user can send, in characters.
const MaxMessageLength = 4000

// The expected failures; handlers turn each into an error code (handlers/errors.go).
var (
	ErrCoachFailed    = errors.New("the coach couldn't answer right now, please try again")
	ErrMessageEmpty   = errors.New("message can't be empty")
	ErrMessageTooLong = errors.New("message is too long")
)

// Every function here takes the signed-in user's ID first and only touches that user's rows:
// each query has WHERE user_id = ?, and runs in db.AsUser so row-level security checks it too.
// Someone else's conversation looks exactly like a missing one (gorm.ErrRecordNotFound → 404).

// ListConversations returns up to 100 of the user's conversations, newest activity first (for the sidebar).
func ListConversations(userID string) ([]models.Conversation, error) {
	var conversations []models.Conversation

	err := db.AsUser(userID, func(tx *gorm.DB) error {
		return tx.Where("user_id = ?", userID).Order("updated_at DESC").Limit(100).Find(&conversations).Error
	})
	return conversations, err
}

// CreateConversation creates an empty conversation for the user (the first message gives it a title).
func CreateConversation(userID string) (models.Conversation, error) {
	conversation := models.Conversation{UserID: userID}

	err := db.AsUser(userID, func(tx *gorm.DB) error {
		return tx.Create(&conversation).Error
	})
	return conversation, err
}

// GetConversation returns one of the user's conversations with all its messages.
// If it doesn't exist (or isn't theirs), the error is gorm.ErrRecordNotFound.
func GetConversation(userID string, id string) (models.Conversation, error) {
	var conversation models.Conversation

	err := db.AsUser(userID, func(tx *gorm.DB) error {
		// Preload also loads the conversation's messages, oldest first.
		return tx.Preload("Messages", func(query *gorm.DB) *gorm.DB {
			return query.Where("user_id = ?", userID).Order("id")
		}).First(&conversation, "id = ? AND user_id = ?", id, userID).Error
	})
	return conversation, err
}

// DeleteConversation deletes one of the user's conversations and its messages.
// found is false if they have no conversation with that id.
func DeleteConversation(userID string, id string) (found bool, err error) {
	err = db.AsUser(userID, func(tx *gorm.DB) error {
		result := tx.Delete(&models.Conversation{}, "id = ? AND user_id = ?", id, userID)
		found = result.RowsAffected > 0
		return result.Error
	})
	return found, err
}

// SendMessage answers a (validated) message from the user in one of their conversations:
// 1. load the recent history  2. ask the coach  3. save the question AND the answer.
// Steps 1 and 3 are two short transactions: none stays open while the coach thinks.
// If the coach fails, nothing is saved, so the user can simply send again.
// If the conversation doesn't exist (or isn't theirs), the error is gorm.ErrRecordNotFound.
func SendMessage(ctx context.Context, userID string, id string, text string) (models.Message, models.Message, error) {
	askedAt := time.Now()

	// 1. The conversation, and its last messages: the newest ones, then flipped to oldest first.
	var conversation models.Conversation
	var history []models.Message
	err := db.AsUser(userID, func(tx *gorm.DB) error {
		err := tx.First(&conversation, "id = ? AND user_id = ?", id, userID).Error
		if err != nil {
			return err
		}
		return tx.Where("conversation_id = ? AND user_id = ?", id, userID).
			Order("id DESC").Limit(contextMessages - 1).Find(&history).Error
	})
	if err != nil {
		return models.Message{}, models.Message{}, err
	}
	slices.Reverse(history)

	// 2. Ask the coach (coach.go). ctx cancels the call if the user leaves.
	reply, err := askCoach(ctx, history, text)
	if err != nil {
		log.Println("coach failed:", err)
		return models.Message{}, models.Message{}, ErrCoachFailed
	}

	// 3. Save both messages in ONE transaction: both are saved, or neither is.
	userMessage := models.Message{ConversationID: id, UserID: userID, Role: "user", Content: text, CreatedAt: askedAt}
	coachMessage := models.Message{ConversationID: id, UserID: userID, Role: "assistant", Content: reply}

	err = db.AsUser(userID, func(tx *gorm.DB) error {
		if err := tx.Create(&userMessage).Error; err != nil {
			return err // returning an error rolls everything back
		}
		if err := tx.Create(&coachMessage).Error; err != nil {
			return err
		}
		updates := map[string]any{"updated_at": time.Now()} // moves the chat to the top of the sidebar
		if conversation.Title == "" {
			updates["title"] = titleFrom(text) // the first message names the chat
		}
		return tx.Model(&conversation).Where("user_id = ?", userID).Updates(updates).Error
	})
	if err != nil {
		return models.Message{}, models.Message{}, err
	}

	return userMessage, coachMessage, nil
}

// ValidateMessage checks a message before it's sent to the coach.
func ValidateMessage(text string) error {
	if text == "" {
		return ErrMessageEmpty
	}

	if utf8.RuneCountInString(text) > MaxMessageLength {
		return ErrMessageTooLong
	}

	return nil
}

// titleFrom names a chat after its first message, cut at a word boundary.
func titleFrom(text string) string {
	text = strings.Join(strings.Fields(text), " ") // collapse newlines and extra spaces

	if utf8.RuneCountInString(text) <= 60 {
		return text
	}

	cut := string([]rune(text)[:60])
	if i := strings.LastIndex(cut, " "); i > 20 {
		cut = cut[:i]
	}
	return cut + "…"
}
