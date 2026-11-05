package main

import (
	"log"
	"os"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"

	"hydra/backend/config"
	"hydra/backend/db"
	"hydra/backend/handlers"
	"hydra/backend/models"
)

func main() {
	// Load DATABASE_URL and LLM_API_KEY from .env into the environment.
	// In Kubernetes there is no .env file: the values come from a ConfigMap and a Secret.
	godotenv.Load()

	databaseURL := os.Getenv("DATABASE_URL")
	if os.Getenv("LLM_API_KEY") == "" {
		log.Fatal("LLM_API_KEY is not set (put it in backend/.env)")
	}

	var err error
	db.DB, err = gorm.Open(postgres.Open(databaseURL), &gorm.Config{})
	if err != nil {
		// In Kubernetes, if Postgres isn't up yet, the pod crashes here and
		// Kubernetes simply restarts it until the database is ready.
		log.Fatal("could not connect to Postgres: ", err)
	}

	// AutoMigrate creates the tables from the structs in models/models.go if they don't exist.
	db.DB.AutoMigrate(&models.Conversation{}, &models.Message{})

	router := gin.Default()
	handlers.RegisterRoutes(router) // all routes are in handlers/routes.go

	// ":8080" (not "localhost:8080") so it's reachable from outside the container.
	router.Run(":" + config.GetEnv("PORT", "8080"))
}
