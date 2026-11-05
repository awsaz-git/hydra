package db

import "gorm.io/gorm"

// DB is the shared database connection. main.go opens it at startup,
// and the services use it for every query. Handlers never touch it.
var DB *gorm.DB
