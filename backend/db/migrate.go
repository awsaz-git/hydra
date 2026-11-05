package db

import (
	"embed"

	"github.com/pressly/goose/v3"
	"gorm.io/gorm"
)

// migrations holds every .sql file in db/migrations. go:embed copies them into
// the binary when you build, so the Docker image can migrate without extra files.
//
//go:embed migrations/*.sql
var migrations embed.FS

// Migrate runs, in order, every migration in db/migrations that hasn't run yet.
// goose remembers which ones already ran in the goose_db_version table.
// conn must be connected as hydra_owner: hydra_app isn't allowed to create tables.
func Migrate(conn *gorm.DB) error {
	sqlDB, err := conn.DB()
	if err != nil {
		return err
	}

	goose.SetBaseFS(migrations)
	err = goose.SetDialect("postgres")
	if err != nil {
		return err
	}

	return goose.Up(sqlDB, "migrations")
}
