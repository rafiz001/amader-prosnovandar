package main

import (
	"context"
	"errors"
	"flag"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"
)

func env(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

type statusWriter struct {
	http.ResponseWriter
	status int
}

func (s *statusWriter) WriteHeader(code int) { s.status = code; s.ResponseWriter.WriteHeader(code) }

func middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		sw := &statusWriter{ResponseWriter: w, status: 200}
		defer func() {
			if rec := recover(); rec != nil {
				log.Printf("panic: %v", rec)
				writeError(sw, errors.New("panic"))
			}
			log.Printf("%s %s %d %s", r.Method, r.URL.Path, sw.status, time.Since(start).Round(time.Millisecond))
		}()
		h := sw.Header()
		h.Set("Access-Control-Allow-Origin", "*")
		h.Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		h.Set("Access-Control-Allow-Headers", "Content-Type")
		h.Set("Access-Control-Expose-Headers", "Content-Disposition")
		if r.Method == http.MethodOptions {
			sw.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(sw, r)
	})
}

func newRouter(a *App, frontendDir string) http.Handler {
	mux := http.NewServeMux()
	route := func(pattern string, h handler) { mux.HandleFunc(pattern, wrap(h)) }

	mux.HandleFunc("GET /api/openapi.json", serveOpenAPI)
	mux.HandleFunc("GET /health", func(w http.ResponseWriter, r *http.Request) { writeJSON(w, 200, map[string]bool{"ok": true}) })

	route("GET /api/institute", a.getInstitute)
	route("PUT /api/institute", a.updateInstitute)
	route("PUT /api/institute/logo", a.uploadLogo)
	route("DELETE /api/institute/logo", a.deleteLogo)

	route("GET /api/classes", a.listClasses)
	route("POST /api/classes", a.createClass)
	route("GET /api/classes/{id}", a.getClass)
	route("PUT /api/classes/{id}", a.updateClass)
	route("DELETE /api/classes/{id}", a.deleteClass)

	route("GET /api/classes/{classId}/subjects", a.listSubjects)
	route("POST /api/classes/{classId}/subjects", a.createSubject)
	route("GET /api/subjects/{id}", a.getSubject)
	route("PUT /api/subjects/{id}", a.updateSubject)
	route("DELETE /api/subjects/{id}", a.deleteSubject)

	route("GET /api/subjects/{subjectId}/questions", a.listQuestions)
	route("POST /api/subjects/{subjectId}/questions", a.createQuestion)
	route("GET /api/questions/{id}", a.getQuestion)
	route("PUT /api/questions/{id}", a.updateQuestion)
	route("DELETE /api/questions/{id}", a.deleteQuestion)
	route("GET /api/files/{id}", a.getFile)

	route("GET /api/subjects/{subjectId}/chapters", a.listChapters)
	route("POST /api/subjects/{subjectId}/chapters", a.createChapter)
	route("GET /api/chapters/{id}", a.getChapter)
	route("PUT /api/chapters/{id}", a.updateChapter)
	route("DELETE /api/chapters/{id}", a.deleteChapter)

	route("GET /api/subjects/{subjectId}/question-types", a.listTypes)
	route("POST /api/subjects/{subjectId}/question-types", a.createType)
	route("GET /api/question-types/{id}", a.getType)
	route("PUT /api/question-types/{id}", a.updateType)
	route("DELETE /api/question-types/{id}", a.deleteType)

	route("POST /api/generate", a.generate)
	route("GET /api/papers", a.listPapers)
	route("GET /api/papers/{id}", a.getPaper)
	route("DELETE /api/papers/{id}", a.deletePaper)

	route("GET /api/export", a.export)
	route("POST /api/import", a.importData)

	// Unknown API routes get a JSON 404; everything else is the static frontend (if present).
	mux.HandleFunc("/api/", func(w http.ResponseWriter, r *http.Request) {
		writeError(w, httpErr(404, "Route not found"))
	})
	if frontendDir != "" {
		mux.Handle("/", staticHandler(frontendDir))
	} else {
		mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
			writeError(w, httpErr(404, "Route not found"))
		})
	}
	return middleware(mux)
}

func main() {
	migrateOnly := flag.Bool("migrate", false, "apply migrations and exit")
	flag.Parse()

	db, err := openDB(env("DB_PATH", "./data/questionbank.sqlite"))
	if err != nil {
		log.Fatalf("open database: %v", err)
	}
	defer db.Close()

	ran, err := runMigrations(db)
	if err != nil {
		log.Fatalf("migrate: %v", err)
	}
	if len(ran) > 0 {
		log.Printf("Applied migrations: %v", ran)
	}
	if *migrateOnly {
		log.Println("Database is up to date.")
		return
	}

	frontendDir := findFrontendDir()
	logFrontend(frontendDir)

	srv := &http.Server{
		Addr:              ":" + env("PORT", "3000"),
		Handler:           newRouter(&App{db: db}, frontendDir),
		ReadHeaderTimeout: 10 * time.Second,
	}
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	go func() {
		<-ctx.Done()
		shutdown, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		_ = srv.Shutdown(shutdown)
	}()

	log.Printf("Question bank API listening on http://localhost%s", srv.Addr)
	if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		log.Fatal(err)
	}
}
