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

// ErrCoachFailed means the LLM call failed. The handler answers 502 with this text.
var ErrCoachFailed = errors.New("the coach couldn't answer right now, please try again")

// ListConversations returns up to 100 conversations, newest activity first (for the sidebar).
func ListConversations() ([]models.Conversation, error) {
	var conversations []models.Conversation

	err := db.DB.Order("updated_at DESC").Limit(100).Find(&conversations).Error
	return conversations, err
}

// CreateConversation creates an empty conversation (the first message gives it a title).
func CreateConversation() (models.Conversation, error) {
	var conversation models.Conversation

	err := db.DB.Create(&conversation).Error
	return conversation, err
}

// GetConversation returns one conversation with all its messages.
// If it doesn't exist, the error is gorm.ErrRecordNotFound.
func GetConversation(id string) (models.Conversation, error) {
	var conversation models.Conversation

	// Preload also loads the conversation's messages, oldest first.
	err := db.DB.Preload("Messages", func(query *gorm.DB) *gorm.DB { return query.Order("id") }).
		First(&conversation, "id = ?", id).Error
	return conversation, err
}

// DeleteConversation deletes a conversation and its messages.
// found is false if there was no conversation with that id.
func DeleteConversation(id string) (found bool, err error) {
	result := db.DB.Delete(&models.Conversation{}, "id = ?", id)
	return result.RowsAffected > 0, result.Error
}

// SendMessage answers a (validated) message from the user:
// 1. load the recent history  2. ask the coach  3. save the question AND the answer.
// If the coach fails, nothing is saved, so the user can simply send again.
// If the conversation doesn't exist, the error is gorm.ErrRecordNotFound.
func SendMessage(ctx context.Context, id string, text string) (models.Message, models.Message, error) {
	askedAt := time.Now()

	var conversation models.Conversation
	err := db.DB.First(&conversation, "id = ?", id).Error
	if err != nil {
		return models.Message{}, models.Message{}, err
	}

	// 1. The last messages of this chat: the newest ones, then flipped to oldest first.
	var history []models.Message
	err = db.DB.Where("conversation_id = ?", id).Order("id DESC").Limit(contextMessages - 1).Find(&history).Error
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
	userMessage := models.Message{ConversationID: id, Role: "user", Content: text, CreatedAt: askedAt}
	coachMessage := models.Message{ConversationID: id, Role: "assistant", Content: reply}

	err = db.DB.Transaction(func(tx *gorm.DB) error {
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
		return tx.Model(&conversation).Updates(updates).Error
	})
	if err != nil {
		return models.Message{}, models.Message{}, err
	}

	return userMessage, coachMessage, nil
}

// ValidateMessage checks a message before it's sent to the coach.
func ValidateMessage(text string) error {
	if text == "" {
		return errors.New("message can't be empty")
	}

	if utf8.RuneCountInString(text) > 4000 {
		return errors.New("message must be 4000 characters or less")
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
