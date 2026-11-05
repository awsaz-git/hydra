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
)

func main() {
	// Load the variables from .env into the environment (see .env.example).
	// In Kubernetes there is no .env file: the values come from a Secret.
	godotenv.Load()

	// "go run . migrate" updates the database and stops; plain "go run ." serves the API.
	if len(os.Args) > 1 && os.Args[1] == "migrate" {
		migrate()
		return
	}

	serve()
}

// migrate connects as hydra_owner and runs the SQL files in db/migrations.
// It never starts the HTTP server, so the owner's password never sits in the
// running backend: the server only ever gets DATABASE_URL (hydra_app).
func migrate() {
	migrateURL := os.Getenv("MIGRATE_DATABASE_URL")
	if migrateURL == "" {
		log.Fatal("MIGRATE_DATABASE_URL is not set (put it in backend/.env)")
	}

	conn, err := gorm.Open(postgres.Open(migrateURL), &gorm.Config{})
	if err != nil {
		log.Fatal("could not connect to Postgres: ", err)
	}

	err = db.Migrate(conn)
	if err != nil {
		log.Fatal("migration failed: ", err)
	}
	log.Println("the database is up to date")
}

// serve connects as hydra_app (rows only) and runs the API.
// The tables must already exist: run "go run . migrate" first.
func serve() {
	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL == "" {
		log.Fatal("DATABASE_URL is not set (put it in backend/.env)")
	}
	if os.Getenv("LLM_API_KEY") == "" {
		log.Fatal("LLM_API_KEY is not set (put it in backend/.env)")
	}

	var err error
	db.DB, err = gorm.Open(postgres.Open(databaseURL), &gorm.Config{})
	if err != nil {
		// In Kubernetes the Pod crashes here and is restarted until the database is reachable.
		log.Fatal("could not connect to Postgres: ", err)
	}

	router := gin.Default()
	handlers.RegisterRoutes(router) // all routes are in handlers/routes.go

	// ":8080" (not "localhost:8080") so it's reachable from outside the container.
	router.Run(":" + config.GetEnv("PORT", "8080"))
}
