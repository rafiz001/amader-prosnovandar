package main

import (
	"database/sql"
	"embed"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	_ "github.com/mattn/go-sqlite3"
)

// Migrations are compiled into the binary.
//
//go:embed migrations/*.sql
var migrationsFS embed.FS

// SQLite stores TEXT as UTF-8, so Arabic and Bengali are stored natively.
func openDB(path string) (*sql.DB, error) {
	abs, err := filepath.Abs(path)
	if err != nil {
		return nil, err
	}
	if err := os.MkdirAll(filepath.Dir(abs), 0o755); err != nil {
		return nil, err
	}
	db, err := sql.Open("sqlite3", "file:"+abs+"?_foreign_keys=on&_journal_mode=WAL&_busy_timeout=5000")
	if err != nil {
		return nil, err
	}
	// One connection keeps SQLite writes serialised and PRAGMAs consistent.
	// Never run a second query while a *sql.Rows is still open.
	db.SetMaxOpenConns(1)
	return db, db.Ping()
}

func runMigrations(db *sql.DB) ([]string, error) {
	if _, err := db.Exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
		name TEXT PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`); err != nil {
		return nil, err
	}
	applied := map[string]bool{}
	rows, err := db.Query(`SELECT name FROM schema_migrations`)
	if err != nil {
		return nil, err
	}
	for rows.Next() {
		var n string
		if err := rows.Scan(&n); err != nil {
			rows.Close()
			return nil, err
		}
		applied[n] = true
	}
	rows.Close()

	entries, err := migrationsFS.ReadDir("migrations") // returned sorted by filename
	if err != nil {
		return nil, err
	}
	var ran []string
	for _, e := range entries {
		name := e.Name()
		if e.IsDir() || !strings.HasSuffix(name, ".sql") || applied[name] {
			continue
		}
		data, err := migrationsFS.ReadFile("migrations/" + name)
		if err != nil {
			return nil, err
		}
		tx, err := db.Begin()
		if err != nil {
			return nil, err
		}
		if _, err := tx.Exec(string(data)); err != nil {
			tx.Rollback()
			return nil, fmt.Errorf("migration %s: %w", name, err)
		}
		if _, err := tx.Exec(`INSERT INTO schema_migrations (name) VALUES (?)`, name); err != nil {
			tx.Rollback()
			return nil, err
		}
		if err := tx.Commit(); err != nil {
			return nil, err
		}
		ran = append(ran, name)
	}
	return ran, nil
}
