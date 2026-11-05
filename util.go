package main

import (
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"math"
	"mime"
	"net/http"
	"strconv"
	"strings"

	"github.com/mattn/go-sqlite3"
	"golang.org/x/text/unicode/norm"
)

const (
	maxJSONBody  = 5 << 20
	maxImage     = 5 << 20
	maxImageBody = maxImage + (1 << 20)
	maxImport    = 200 << 20
)

var allowedImageTypes = map[string]string{
	"image/png": "png", "image/jpeg": "jpg", "image/gif": "gif", "image/webp": "webp",
}

// ---- errors -----------------------------------------------------------------

type HTTPError struct {
	Status int
	Msg    string
}

func (e *HTTPError) Error() string { return e.Msg }

func httpErr(status int, format string, a ...any) *HTTPError {
	msg := format
	if len(a) > 0 {
		msg = fmt.Sprintf(format, a...)
	}
	return &HTTPError{status, msg}
}

// DBTX is satisfied by both *sql.DB and *sql.Tx.
type DBTX interface {
	Exec(query string, args ...any) (sql.Result, error)
	Query(query string, args ...any) (*sql.Rows, error)
	QueryRow(query string, args ...any) *sql.Row
}

type handler func(w http.ResponseWriter, r *http.Request) error

func wrap(h handler) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if err := h(w, r); err != nil {
			writeError(w, err)
		}
	}
}

func writeError(w http.ResponseWriter, err error) {
	status, msg := http.StatusInternalServerError, "Internal server error"
	var he *HTTPError
	var mbe *http.MaxBytesError
	var se sqlite3.Error
	switch {
	case errors.As(err, &he):
		status, msg = he.Status, he.Msg
	case errors.As(err, &mbe):
		status, msg = http.StatusRequestEntityTooLarge, "Request body too large"
	case errors.As(err, &se) && se.ExtendedCode == sqlite3.ErrConstraintUnique:
		status, msg = http.StatusConflict, "A record with the same name already exists"
	case errors.As(err, &se) && se.Code == sqlite3.ErrConstraint:
		status, msg = http.StatusBadRequest, "Constraint failed: "+se.Error()
	default:
		log.Printf("internal error: %v", err)
	}
	writeJSON(w, status, map[string]any{"error": map[string]string{"message": msg}})
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	enc := json.NewEncoder(w)
	enc.SetEscapeHTML(false) // keep <, >, & readable (LaTeX)
	if err := enc.Encode(v); err != nil {
		log.Printf("write json: %v", err)
	}
}

// ---- strings ----------------------------------------------------------------

// clean normalises to Unicode NFC and trims, so Arabic/Bengali strings compare consistently.
func clean(s string) string { return strings.TrimSpace(norm.NFC.String(s)) }

func required(v, label string) (string, error) {
	s := clean(v)
	if s == "" {
		return "", httpErr(400, "%s is required", label)
	}
	return s, nil
}

func nullStr(n sql.NullString) *string {
	if !n.Valid {
		return nil
	}
	return &n.String
}

func toStr(v any) string {
	switch t := v.(type) {
	case nil:
		return ""
	case string:
		return t
	case json.Number:
		return t.String()
	case float64:
		return strconv.FormatFloat(t, 'f', -1, 64)
	default:
		return fmt.Sprint(t)
	}
}

func toFloat(v any) (float64, bool) {
	switch t := v.(type) {
	case float64:
		return t, true
	case int:
		return float64(t), true
	case int64:
		return float64(t), true
	case json.Number:
		f, err := t.Float64()
		return f, err == nil
	case string:
		f, err := strconv.ParseFloat(strings.TrimSpace(t), 64)
		return f, err == nil
	}
	return 0, false
}

func toInt(v any) (int64, bool) {
	f, ok := toFloat(v)
	if !ok || math.IsNaN(f) || math.IsInf(f, 0) || f != math.Trunc(f) {
		return 0, false
	}
	return int64(f), true
}

func idFrom(v any, label string) (int64, error) {
	n, ok := toInt(v)
	if !ok || n < 1 {
		return 0, httpErr(400, "Invalid %s", label)
	}
	return n, nil
}

func pathID(r *http.Request, name, label string) (int64, error) {
	return idFrom(r.PathValue(name), label)
}

// ---- loosely typed request/document fields ------------------------------------

type Fields map[string]any

func (f Fields) Has(k string) bool   { _, ok := f[k]; return ok }
func (f Fields) Str(k string) string { return clean(toStr(f[k])) }
func (f Fields) StrDef(k, def string) string {
	if v, ok := f[k]; !ok || v == nil {
		return def
	}
	return f.Str(k)
}
func (f Fields) Int(k string) (int64, bool) { return toInt(f[k]) }
func (f Fields) Bool(k string) bool {
	switch t := f[k].(type) {
	case bool:
		return t
	case string:
		return t == "true" || t == "1"
	default:
		n, ok := toInt(t)
		return ok && n == 1
	}
}
func (f Fields) Map(k string) Fields {
	if m, ok := f[k].(map[string]any); ok {
		return Fields(m)
	}
	return nil
}
func (f Fields) List(k string) []any { l, _ := f[k].([]any); return l }

// ---- request input ------------------------------------------------------------

type upload struct {
	Data []byte
	Mime string
}

// readInput accepts JSON, multipart/form-data or urlencoded bodies. If fileField is
// set, an optional image upload in that field is returned (type sniffed from content).
func readInput(w http.ResponseWriter, r *http.Request, limit int64, fileField string) (Fields, *upload, error) {
	r.Body = http.MaxBytesReader(w, r.Body, limit)
	ct, _, _ := mime.ParseMediaType(r.Header.Get("Content-Type"))
	f := Fields{}
	switch ct {
	case "multipart/form-data":
		if err := r.ParseMultipartForm(16 << 20); err != nil {
			return nil, nil, bodyErr(err)
		}
		defer r.MultipartForm.RemoveAll()
		for k, v := range r.MultipartForm.Value {
			if len(v) > 0 {
				f[k] = v[0]
			}
		}
		if fileField == "" || len(r.MultipartForm.File[fileField]) == 0 {
			return f, nil, nil
		}
		file, err := r.MultipartForm.File[fileField][0].Open()
		if err != nil {
			return nil, nil, err
		}
		defer file.Close()
		data, err := io.ReadAll(io.LimitReader(file, maxImage+1))
		if err != nil {
			return nil, nil, err
		}
		if len(data) > maxImage {
			return nil, nil, httpErr(413, "Image is larger than 5 MB")
		}
		mt := http.DetectContentType(data)
		if _, ok := allowedImageTypes[mt]; !ok {
			return nil, nil, httpErr(415, "Only PNG, JPEG, GIF or WebP images are allowed")
		}
		return f, &upload{data, mt}, nil
	case "application/x-www-form-urlencoded":
		if err := r.ParseForm(); err != nil {
			return nil, nil, bodyErr(err)
		}
		for k, v := range r.PostForm {
			if len(v) > 0 {
				f[k] = v[0]
			}
		}
		return f, nil, nil
	default:
		dec := json.NewDecoder(r.Body)
		dec.UseNumber()
		if err := dec.Decode(&f); err != nil && !errors.Is(err, io.EOF) {
			return nil, nil, bodyErr(err)
		}
		if f == nil { // body was the JSON literal null
			f = Fields{}
		}
		return f, nil, nil
	}
}

func bodyErr(err error) error {
	var mbe *http.MaxBytesError
	if errors.As(err, &mbe) {
		return err
	}
	var se *json.SyntaxError
	var ue *json.UnmarshalTypeError
	if errors.As(err, &se) || errors.As(err, &ue) || errors.Is(err, io.ErrUnexpectedEOF) {
		return httpErr(400, "Malformed JSON body")
	}
	return httpErr(400, "Could not read request body: %v", err)
}
