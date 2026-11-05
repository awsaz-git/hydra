package models

import "time"

// The struct Conversation maps to the table "conversations".
type Conversation struct {
	ID        string    `json:"id"         gorm:"type:uuid;primaryKey;default:gen_random_uuid()"`
	Title     string    `json:"title"      gorm:"not null"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`

	// One conversation has many messages; deleting a conversation deletes its messages.
	Messages []Message `json:"messages,omitempty" gorm:"constraint:OnDelete:CASCADE"`
}

// The struct Message maps to the table "messages".
type Message struct {
	ID             int64     `json:"id"         gorm:"primaryKey"`
	ConversationID string    `json:"-"          gorm:"type:uuid;not null;index"`
	Role           string    `json:"role"       gorm:"not null"` // "user" or "assistant"
	Content        string    `json:"content"    gorm:"not null"`
	CreatedAt      time.Time `json:"created_at"`
}
