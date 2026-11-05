package services

import "hydra/backend/db"

// CheckDatabase pings Postgres, so a nil error means the database is up.
func CheckDatabase() error {
	sqlDB, err := db.DB.DB()
	if err != nil {
		return err
	}

	return sqlDB.Ping()
}
