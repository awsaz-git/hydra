package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"hydra/backend/services"
)

// health handles GET /health.
// It pings Postgres, so "ok" means both the server and the database are up.
func health(c *gin.Context) {
	err := services.CheckDatabase()
	if err != nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"status": "error", "database": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "ok", "database": "connected"})
}
