package main

import (
	"database/sql"
	"errors"
	"net/http"
)

type App struct{ db *sql.DB }

// ---- institute ------------------------------------------------------------------

func (a *App) getInstitute(w http.ResponseWriter, r *http.Request) error {
	in, err := getInstitute(a.db)
	if err != nil {
		return err
	}
	writeJSON(w, 200, in)
	return nil
}

func (a *App) updateInstitute(w http.ResponseWriter, r *http.Request) error {
	f, _, err := readInput(w, r, maxJSONBody, "")
	if err != nil {
		return err
	}
	cur, err := getInstitute(a.db)
	if err != nil {
		return err
	}
	name, location := cur.Name, cur.Location
	if f.Has("name") {
		name = f.Str("name")
	}
	if f.Has("location") {
		location = f.Str("location")
	}
	if _, err := a.db.Exec(`UPDATE institute SET name=?, location=?, updated_at=CURRENT_TIMESTAMP WHERE id=1`, name, location); err != nil {
		return err
	}
	return a.getInstitute(w, r)
}

func (a *App) uploadLogo(w http.ResponseWriter, r *http.Request) error {
	_, up, err := readInput(w, r, maxImageBody, "logo")
	if err != nil {
		return err
	}
	if up == nil {
		return httpErr(400, `Upload the image in the "logo" form field`)
	}
	tx, err := a.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()
	id, err := saveFile(tx, up.Data, up.Mime, "logo")
	if err != nil {
		return err
	}
	if _, err := tx.Exec(`UPDATE institute SET logo_file_id=?, updated_at=CURRENT_TIMESTAMP WHERE id=1`, id); err != nil {
		return err
	}
	if err := purgeOrphanFiles(tx); err != nil {
		return err
	}
	if err := tx.Commit(); err != nil {
		return err
	}
	return a.getInstitute(w, r)
}

func (a *App) deleteLogo(w http.ResponseWriter, r *http.Request) error {
	if _, err := a.db.Exec(`UPDATE institute SET logo_file_id=NULL, updated_at=CURRENT_TIMESTAMP WHERE id=1`); err != nil {
		return err
	}
	if err := purgeOrphanFiles(a.db); err != nil {
		return err
	}
	return a.getInstitute(w, r)
}

// ---- files ------------------------------------------------------------------------

func (a *App) getFile(w http.ResponseWriter, r *http.Request) error {
	id, err := pathID(r, "id", "id")
	if err != nil {
		return err
	}
	var mt string
	var data []byte
	err = a.db.QueryRow(`SELECT mime, data FROM files WHERE id=?`, id).Scan(&mt, &data)
	if errors.Is(err, sql.ErrNoRows) {
		return httpErr(404, "File not found")
	}
	if err != nil {
		return err
	}
	w.Header().Set("Content-Type", mt)
	w.Header().Set("Cache-Control", "public, max-age=86400")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	_, _ = w.Write(data)
	return nil
}

// ---- classes ----------------------------------------------------------------------

type Class struct {
	ID           int64   `json:"id"`
	Name         string  `json:"name"`
	Description  string  `json:"description"`
	CreatedAt    string  `json:"created_at"`
	UpdatedAt    *string `json:"updated_at"`
	SubjectCount int     `json:"subject_count"`
}

const classSelect = `SELECT c.id, c.name, c.description, c.created_at, c.updated_at,
	(SELECT COUNT(*) FROM subjects s WHERE s.class_id = c.id) FROM classes c`

func queryClasses(db DBTX, where string, args ...any) ([]Class, error) {
	rows, err := db.Query(classSelect+where, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Class{}
	for rows.Next() {
		var c Class
		var upd sql.NullString
		if err := rows.Scan(&c.ID, &c.Name, &c.Description, &c.CreatedAt, &upd, &c.SubjectCount); err != nil {
			return nil, err
		}
		c.UpdatedAt = nullStr(upd)
		out = append(out, c)
	}
	return out, rows.Err()
}

func findClass(db DBTX, id int64) (*Class, error) {
	cs, err := queryClasses(db, " WHERE c.id = ?", id)
	if err != nil {
		return nil, err
	}
	if len(cs) == 0 {
		return nil, httpErr(404, "Class not found")
	}
	return &cs[0], nil
}

func (a *App) listClasses(w http.ResponseWriter, r *http.Request) error {
	cs, err := queryClasses(a.db, " ORDER BY c.id")
	if err != nil {
		return err
	}
	writeJSON(w, 200, cs)
	return nil
}

func (a *App) createClass(w http.ResponseWriter, r *http.Request) error {
	f, _, err := readInput(w, r, maxJSONBody, "")
	if err != nil {
		return err
	}
	name, err := required(f.Str("name"), "name")
	if err != nil {
		return err
	}
	res, err := a.db.Exec(`INSERT INTO classes (name, description) VALUES (?,?)`, name, f.Str("description"))
	if err != nil {
		return err
	}
	id, _ := res.LastInsertId()
	c, err := findClass(a.db, id)
	if err != nil {
		return err
	}
	writeJSON(w, 201, c)
	return nil
}

func (a *App) getClass(w http.ResponseWriter, r *http.Request) error {
	id, err := pathID(r, "id", "id")
	if err != nil {
		return err
	}
	c, err := findClass(a.db, id)
	if err != nil {
		return err
	}
	writeJSON(w, 200, c)
	return nil
}

func (a *App) updateClass(w http.ResponseWriter, r *http.Request) error {
	id, err := pathID(r, "id", "id")
	if err != nil {
		return err
	}
	cur, err := findClass(a.db, id)
	if err != nil {
		return err
	}
	f, _, err := readInput(w, r, maxJSONBody, "")
	if err != nil {
		return err
	}
	name, desc := cur.Name, cur.Description
	if f.Has("name") {
		if name, err = required(f.Str("name"), "name"); err != nil {
			return err
		}
	}
	if f.Has("description") {
		desc = f.Str("description")
	}
	if _, err := a.db.Exec(`UPDATE classes SET name=?, description=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`, name, desc, id); err != nil {
		return err
	}
	c, err := findClass(a.db, id)
	if err != nil {
		return err
	}
	writeJSON(w, 200, c)
	return nil
}

func (a *App) deleteClass(w http.ResponseWriter, r *http.Request) error {
	id, err := pathID(r, "id", "id")
	if err != nil {
		return err
	}
	if _, err := findClass(a.db, id); err != nil {
		return err
	}
	if _, err := a.db.Exec(`DELETE FROM classes WHERE id=?`, id); err != nil { // cascades
		return err
	}
	if err := purgeOrphanFiles(a.db); err != nil {
		return err
	}
	w.WriteHeader(http.StatusNoContent)
	return nil
}

// ---- subjects ---------------------------------------------------------------------

type Subject struct {
	ID            int64   `json:"id"`
	ClassID       int64   `json:"class_id"`
	Name          string  `json:"name"`
	Code          string  `json:"code"`
	CreatedAt     string  `json:"created_at"`
	UpdatedAt     *string `json:"updated_at"`
	QuestionCount int     `json:"question_count"`
	ChapterCount  int     `json:"chapter_count"`
	TypeCount     int     `json:"type_count"`
}

const subjectSelect = `SELECT s.id, s.class_id, s.name, s.code, s.created_at, s.updated_at,
	(SELECT COUNT(*) FROM questions q WHERE q.subject_id = s.id),
	(SELECT COUNT(*) FROM chapters ch WHERE ch.subject_id = s.id),
	(SELECT COUNT(*) FROM question_types t WHERE t.subject_id = s.id) FROM subjects s`

func querySubjects(db DBTX, where string, args ...any) ([]Subject, error) {
	rows, err := db.Query(subjectSelect+where, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Subject{}
	for rows.Next() {
		var s Subject
		var upd sql.NullString
		if err := rows.Scan(&s.ID, &s.ClassID, &s.Name, &s.Code, &s.CreatedAt, &upd, &s.QuestionCount, &s.ChapterCount, &s.TypeCount); err != nil {
			return nil, err
		}
		s.UpdatedAt = nullStr(upd)
		out = append(out, s)
	}
	return out, rows.Err()
}

func findSubject(db DBTX, id int64) (*Subject, error) {
	ss, err := querySubjects(db, " WHERE s.id = ?", id)
	if err != nil {
		return nil, err
	}
	if len(ss) == 0 {
		return nil, httpErr(404, "Subject not found")
	}
	return &ss[0], nil
}

func assertClass(db DBTX, id int64) error {
	var one int
	err := db.QueryRow(`SELECT 1 FROM classes WHERE id=?`, id).Scan(&one)
	if errors.Is(err, sql.ErrNoRows) {
		return httpErr(404, "Class not found")
	}
	return err
}

func assertSubject(db DBTX, id int64) error {
	var one int
	err := db.QueryRow(`SELECT 1 FROM subjects WHERE id=?`, id).Scan(&one)
	if errors.Is(err, sql.ErrNoRows) {
		return httpErr(404, "Subject not found")
	}
	return err
}

func (a *App) listSubjects(w http.ResponseWriter, r *http.Request) error {
	classID, err := pathID(r, "classId", "class id")
	if err != nil {
		return err
	}
	if err := assertClass(a.db, classID); err != nil {
		return err
	}
	ss, err := querySubjects(a.db, " WHERE s.class_id = ? ORDER BY s.id", classID)
	if err != nil {
		return err
	}
	writeJSON(w, 200, ss)
	return nil
}

func (a *App) createSubject(w http.ResponseWriter, r *http.Request) error {
	classID, err := pathID(r, "classId", "class id")
	if err != nil {
		return err
	}
	if err := assertClass(a.db, classID); err != nil {
		return err
	}
	f, _, err := readInput(w, r, maxJSONBody, "")
	if err != nil {
		return err
	}
	name, err := required(f.Str("name"), "name")
	if err != nil {
		return err
	}
	// A new subject starts with the default question types (MCQ, True/False, Plain); edit them freely.
	tx, err := a.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()
	res, err := tx.Exec(`INSERT INTO subjects (class_id, name, code) VALUES (?,?,?)`, classID, name, f.Str("code"))
	if err != nil {
		return err
	}
	id, _ := res.LastInsertId()
	if err := seedDefaultTypes(tx, id); err != nil {
		return err
	}
	if err := tx.Commit(); err != nil {
		return err
	}
	s, err := findSubject(a.db, id)
	if err != nil {
		return err
	}
	writeJSON(w, 201, s)
	return nil
}

func (a *App) getSubject(w http.ResponseWriter, r *http.Request) error {
	id, err := pathID(r, "id", "id")
	if err != nil {
		return err
	}
	s, err := findSubject(a.db, id)
	if err != nil {
		return err
	}
	writeJSON(w, 200, s)
	return nil
}

func (a *App) updateSubject(w http.ResponseWriter, r *http.Request) error {
	id, err := pathID(r, "id", "id")
	if err != nil {
		return err
	}
	cur, err := findSubject(a.db, id)
	if err != nil {
		return err
	}
	f, _, err := readInput(w, r, maxJSONBody, "")
	if err != nil {
		return err
	}
	name, code, classID := cur.Name, cur.Code, cur.ClassID
	if f.Has("name") {
		if name, err = required(f.Str("name"), "name"); err != nil {
			return err
		}
	}
	if f.Has("code") {
		code = f.Str("code")
	}
	if f.Has("class_id") {
		if classID, err = idFrom(f["class_id"], "class_id"); err != nil {
			return err
		}
	}
	if err := assertClass(a.db, classID); err != nil {
		return err
	}
	if _, err := a.db.Exec(`UPDATE subjects SET class_id=?, name=?, code=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`, classID, name, code, id); err != nil {
		return err
	}
	s, err := findSubject(a.db, id)
	if err != nil {
		return err
	}
	writeJSON(w, 200, s)
	return nil
}

func (a *App) deleteSubject(w http.ResponseWriter, r *http.Request) error {
	id, err := pathID(r, "id", "id")
	if err != nil {
		return err
	}
	if _, err := findSubject(a.db, id); err != nil {
		return err
	}
	if _, err := a.db.Exec(`DELETE FROM subjects WHERE id=?`, id); err != nil {
		return err
	}
	if err := purgeOrphanFiles(a.db); err != nil {
		return err
	}
	w.WriteHeader(http.StatusNoContent)
	return nil
}
