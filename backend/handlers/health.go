package handlers

import (
	"log"
	"net/http"

	"github.com/gin-gonic/gin"

	"hydra/backend/services"
)

// health handles GET /health.
// It pings Postgres, so "ok" means both the server and the database are up.
func health(c *gin.Context) {
	err := services.CheckDatabase()
	if err != nil {
		// /health is public: the reason goes to the log, not to whoever asks.
		log.Println("health: database unreachable:", err)
		c.JSON(http.StatusServiceUnavailable, gin.H{"status": "error", "database": "unreachable"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "ok", "database": "connected"})
}
