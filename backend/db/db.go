package db

import "gorm.io/gorm"

// DB is the shared database connection. main.go opens it at startup,
// and the services use it for every query. Handlers never touch it.
var DB *gorm.DB

// AsUser runs fn in a transaction that row-level security scopes to one user: Postgres
// only lets it see and write that user's rows (the policies in 00002_users_and_ownership.sql).
// set_config(..., true) lasts for this transaction only, so a pooled connection can't
// carry one user's ID into another request. Keep fn short: never wait on the LLM inside it.
func AsUser(userID string, fn func(tx *gorm.DB) error) error {
	return DB.Transaction(func(tx *gorm.DB) error {
		err := tx.Exec("SELECT set_config('app.user_id', ?, true)", userID).Error
		if err != nil {
			return err
		}
		return fn(tx)
	})
}
