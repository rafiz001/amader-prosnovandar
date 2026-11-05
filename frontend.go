package main

import (
	"log"
	"mime"
	"net/http"
	"os"
	"path"
	"path/filepath"
	"strings"
)

func init() {
	// Go on Windows reads MIME types from the registry, which can wrongly serve .js
	// as text/plain (browsers then refuse to run it). Pin the common ones.
	for ext, typ := range map[string]string{
		".html": "text/html; charset=utf-8", ".htm": "text/html; charset=utf-8",
		".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8",
		".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8",
		".svg": "image/svg+xml", ".wasm": "application/wasm", ".map": "application/json",
		".woff": "font/woff", ".woff2": "font/woff2", ".ttf": "font/ttf", ".otf": "font/otf",
		".ico": "image/x-icon", ".webp": "image/webp",
	} {
		if err := mime.AddExtensionType(ext, typ); err != nil {
			log.Printf("mime: %v", err)
		}
	}
}

// findFrontendDir returns the folder holding the static frontend, or "" if none.
// Order: FRONTEND_DIR env var, <folder of the executable>/frontend/dist,
// ./frontend/dist (the last one makes `go run .` work, since its binary lives in
// a temp dir).
func findFrontendDir() string {
	if d := os.Getenv("FRONTEND_DIR"); d != "" {
		return d
	}
	dist := filepath.Join("frontend", "dist")
	var candidates []string
	if exe, err := os.Executable(); err == nil {
		if real, err := filepath.EvalSymlinks(exe); err == nil {
			exe = real
		}
		candidates = append(candidates, filepath.Join(filepath.Dir(exe), dist))
	}
	candidates = append(candidates, dist)
	for _, c := range candidates {
		if st, err := os.Stat(c); err == nil && st.IsDir() {
			if abs, err := filepath.Abs(c); err == nil {
				return abs
			}
			return c
		}
	}
	return ""
}

func serveFile(w http.ResponseWriter, r *http.Request, root http.FileSystem, name string) bool {
	f, err := root.Open(name)
	if err != nil {
		return false
	}
	defer f.Close()
	st, err := f.Stat()
	if err != nil {
		return false
	}
	if st.IsDir() { // no directory listings: serve its index.html if it has one
		return serveFile(w, r, root, path.Join(name, "index.html"))
	}
	w.Header().Set("Cache-Control", "no-cache") // revalidate (cheap) so frontend updates show up
	http.ServeContent(w, r, st.Name(), st.ModTime(), f)
	return true
}

// staticHandler serves files from dir. Requests for paths without a file extension that
// match no file fall back to index.html (client-side routing); missing assets get a 404.
func staticHandler(dir string) http.Handler {
	root := http.Dir(dir)
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet && r.Method != http.MethodHead {
			w.Header().Set("Allow", "GET, HEAD")
			writeError(w, httpErr(405, "Method not allowed"))
			return
		}
		p := path.Clean("/" + r.URL.Path)
		for _, seg := range strings.Split(p, "/") { // never expose .git, .env, ...
			if strings.HasPrefix(seg, ".") {
				writeError(w, httpErr(404, "Not found"))
				return
			}
		}
		if serveFile(w, r, root, p) {
			return
		}
		if path.Ext(p) == "" && serveFile(w, r, root, "/index.html") {
			return
		}
		writeError(w, httpErr(404, "Not found"))
	})
}

func logFrontend(dir string) {
	if dir == "" {
		log.Printf("No frontend folder found (looked for FRONTEND_DIR, <binary folder>/frontend/dist, ./frontend/dist); serving the API only")
		return
	}
	if _, err := os.Stat(filepath.Join(dir, "index.html")); err != nil {
		log.Printf("Serving frontend from %s (warning: no index.html found there)", dir)
		return
	}
	log.Printf("Serving frontend from %s", dir)
}
