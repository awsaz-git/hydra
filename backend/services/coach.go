package services

import (
	"bytes"
	"context"
	_ "embed"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"

	"hydra/backend/config"
	"hydra/backend/models"
)

// systemPrompt is the coach's instructions (your training rules).
// go:embed copies system_prompt.md into the binary when you build, so the
// Docker image needs no extra files. Edit the .md file, then rebuild.
//
//go:embed system_prompt.md
var systemPrompt string

// The LLM API has no time limit of its own, so we set one.
var httpClient = &http.Client{Timeout: 90 * time.Second}

// chatMessage is one message in the format DeepSeek (and OpenAI) expect.
type chatMessage struct {
	Role    string `json:"role"` // "system", "user" or "assistant"
	Content string `json:"content"`
}

// askCoach sends the system prompt + chat history + the new message to
// DeepSeek and returns the coach's reply.
func askCoach(ctx context.Context, history []models.Message, newMessage string) (string, error) {
	messages := []chatMessage{{Role: "system", Content: systemPrompt}}
	for _, m := range history {
		messages = append(messages, chatMessage{Role: m.Role, Content: m.Content})
	}
	messages = append(messages, chatMessage{Role: "user", Content: newMessage})

	body, err := json.Marshal(map[string]any{
		"model":       config.GetEnv("LLM_MODEL", "deepseek-flash"),
		"messages":    messages,
		"temperature": 0.7,
		"max_tokens":  1200,
	})
	if err != nil {
		return "", err
	}

	url := config.GetEnv("LLM_BASE_URL", "https://api.deepseek.com") + "/chat/completions"
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+os.Getenv("LLM_API_KEY"))

	resp, err := httpClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	data, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("deepseek returned %d: %.200s", resp.StatusCode, data)
	}

	// We only need choices[0].message.content from DeepSeek's response.
	var result struct {
		Choices []struct {
			Message chatMessage `json:"message"`
		} `json:"choices"`
	}
	err = json.Unmarshal(data, &result)
	if err != nil {
		return "", err
	}
	if len(result.Choices) == 0 || strings.TrimSpace(result.Choices[0].Message.Content) == "" {
		return "", errors.New("deepseek returned an empty reply")
	}

	return strings.TrimSpace(result.Choices[0].Message.Content), nil
}
