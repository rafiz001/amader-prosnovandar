package main

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"mime"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"gopkg.in/yaml.v3"
)

func exportName(ext string) string {
	return fmt.Sprintf("question-bank-%s.%s", time.Now().Format("20060102"), ext)
}

// GET /api/export?format=json|yml|sqlite[&include_files=false]
func (a *App) export(w http.ResponseWriter, r *http.Request) error {
	format := strings.ToLower(r.URL.Query().Get("format"))
	if format == "" {
		format = "json"
	}
	includeFiles := r.URL.Query().Get("include_files") != "false"

	switch format {
	case "json":
		doc, err := buildDoc(a.db, includeFiles)
		if err != nil {
			return err
		}
		var buf bytes.Buffer
		enc := json.NewEncoder(&buf)
		enc.SetEscapeHTML(false)
		enc.SetIndent("", "  ")
		if err := enc.Encode(doc); err != nil {
			return err
		}
		w.Header().Set("Content-Disposition", `attachment; filename="`+exportName("json")+`"`)
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		_, _ = w.Write(buf.Bytes())
	case "yml", "yaml":
		doc, err := buildDoc(a.db, includeFiles)
		if err != nil {
			return err
		}
		var buf bytes.Buffer
		enc := yaml.NewEncoder(&buf)
		enc.SetIndent(2)
		if err := enc.Encode(doc); err != nil {
			return err
		}
		enc.Close()
		w.Header().Set("Content-Disposition", `attachment; filename="`+exportName("yml")+`"`)
		w.Header().Set("Content-Type", "application/x-yaml; charset=utf-8")
		_, _ = w.Write(buf.Bytes())
	case "sqlite":
		dir, err := os.MkdirTemp("", "qb-export-")
		if err != nil {
			return err
		}
		defer os.RemoveAll(dir)
		tmp := filepath.Join(dir, "export.sqlite")
		if _, err := a.db.Exec(`VACUUM INTO ?`, tmp); err != nil { // consistent full copy (includes papers)
			return err
		}
		f, err := os.Open(tmp)
		if err != nil {
			return err
		}
		defer f.Close()
		st, _ := f.Stat()
		w.Header().Set("Content-Disposition", `attachment; filename="`+exportName("sqlite")+`"`)
		w.Header().Set("Content-Type", "application/vnd.sqlite3")
		w.Header().Set("Content-Length", fmt.Sprint(st.Size()))
		_, _ = io.Copy(w, f)
	default:
		return httpErr(400, "format must be json, yml or sqlite")
	}
	return nil
}

func detectFormat(data []byte, filename, hint string) (string, error) {
	h := strings.ToLower(hint)
	switch h {
	case "":
	case "yaml", "yml":
		return "yml", nil
	case "json", "sqlite":
		return h, nil
	default:
		return "", httpErr(400, "format must be json, yml or sqlite")
	}
	if bytes.HasPrefix(data, []byte("SQLite format 3")) {
		return "sqlite", nil
	}
	switch strings.ToLower(filepath.Ext(filename)) {
	case ".yml", ".yaml":
		return "yml", nil
	case ".json":
		return "json", nil
	}
	if strings.HasPrefix(strings.TrimSpace(string(data)), "{") {
		return "json", nil
	}
	return "yml", nil
}

func stripBOM(b []byte) []byte { return bytes.TrimPrefix(b, []byte("\xef\xbb\xbf")) }

func docFromSQLite(data []byte) (Fields, error) {
	dir, err := os.MkdirTemp("", "qb-import-")
	if err != nil {
		return nil, err
	}
	defer os.RemoveAll(dir)
	tmp := filepath.Join(dir, "import.sqlite")
	if err := os.WriteFile(tmp, data, 0o600); err != nil {
		return nil, err
	}
	src, err := sql.Open("sqlite3", "file:"+tmp+"?_foreign_keys=on") // a throw-away copy, so it may be upgraded
	if err != nil {
		return nil, err
	}
	defer src.Close()
	src.SetMaxOpenConns(1)

	tableSet := func() (map[string]bool, error) {
		rows, err := src.Query(`SELECT name FROM sqlite_master WHERE type='table'`)
		if err != nil {
			return nil, err
		}
		defer rows.Close()
		tables := map[string]bool{}
		for rows.Next() {
			var n string
			if err := rows.Scan(&n); err != nil {
				return nil, err
			}
			tables[n] = true
		}
		return tables, rows.Err()
	}
	tables, err := tableSet()
	if err != nil {
		return nil, err
	}
	for _, t := range []string{"classes", "subjects", "questions"} {
		if !tables[t] {
			return nil, httpErr(422, `SQLite file has no "%s" table`, t)
		}
	}
	// Files exported by an older version are upgraded to the current schema first.
	if tables["schema_migrations"] {
		if _, err := runMigrations(src); err != nil {
			return nil, httpErr(422, "Could not upgrade the SQLite file: %v", err)
		}
		if tables, err = tableSet(); err != nil {
			return nil, err
		}
	}
	if !tables["question_types"] || !tables["chapters"] {
		return nil, httpErr(422, "Unsupported SQLite schema (not a question-bank export)")
	}
	doc, err := buildDoc(src, true)
	if err != nil {
		return nil, err
	}
	return docToFields(doc)
}

// POST /api/import?mode=merge|replace[&format=json|yml|sqlite]
// multipart field "file", or a raw JSON body in the nested export format.
func (a *App) importData(w http.ResponseWriter, r *http.Request) error {
	q := r.URL.Query()
	mode := strings.ToLower(q.Get("mode"))
	if mode == "" {
		mode = "merge"
	}
	r.Body = http.MaxBytesReader(w, r.Body, maxImport)
	ct, _, _ := mime.ParseMediaType(r.Header.Get("Content-Type"))

	var doc Fields
	if ct == "multipart/form-data" {
		if err := r.ParseMultipartForm(32 << 20); err != nil {
			return bodyErr(err)
		}
		defer r.MultipartForm.RemoveAll()
		fhs := r.MultipartForm.File["file"]
		if len(fhs) == 0 {
			return httpErr(400, `Upload a file in the "file" field or send a JSON body`)
		}
		file, err := fhs[0].Open()
		if err != nil {
			return err
		}
		data, err := io.ReadAll(file)
		file.Close()
		if err != nil {
			return err
		}
		format, err := detectFormat(data, fhs[0].Filename, q.Get("format"))
		if err != nil {
			return err
		}
		switch format {
		case "json":
			dec := json.NewDecoder(bytes.NewReader(stripBOM(data)))
			dec.UseNumber()
			if err := dec.Decode(&doc); err != nil {
				return httpErr(422, "Could not read the JSON file: %v", err)
			}
		case "yml":
			var v any
			if err := yaml.Unmarshal(stripBOM(data), &v); err != nil {
				return httpErr(422, "Could not read the YML file: %v", err)
			}
			m, ok := v.(map[string]any)
			if !ok {
				return httpErr(422, "Could not read the YML file: the document root must be a mapping")
			}
			doc = Fields(m)
		default:
			if doc, err = docFromSQLite(data); err != nil {
				var he *HTTPError
				if errors.As(err, &he) {
					return err
				}
				return httpErr(422, "Could not read the SQLITE file: %v", err)
			}
		}
	} else {
		f, _, err := readInput(w, r, maxImport, "")
		if err != nil {
			return err
		}
		if _, ok := f["classes"].([]any); !ok {
			return httpErr(400, `Upload a file in the "file" field or send a JSON body`)
		}
		doc = f
	}

	stats, err := importDoc(a.db, doc, mode)
	if err != nil {
		return err
	}
	writeJSON(w, 200, struct {
		Mode string `json:"mode"`
		ImportStats
	}{mode, stats})
	return nil
}
