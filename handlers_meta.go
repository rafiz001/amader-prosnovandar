package main

import (
	"database/sql"
	"errors"
	"net/http"
	"strings"
)

// ======================= question types (per subject) =======================

type QType struct {
	ID            int64   `json:"id"`
	SubjectID     int64   `json:"subject_id"`
	Name          string  `json:"name"`
	Kind          string  `json:"kind"`
	CreatedAt     string  `json:"created_at"`
	UpdatedAt     *string `json:"updated_at"`
	QuestionCount int     `json:"question_count"`
}

const typeSelect = `SELECT t.id, t.subject_id, t.name, t.kind, t.created_at, t.updated_at,
	(SELECT COUNT(*) FROM questions q WHERE q.type_id = t.id) FROM question_types t`

func queryTypes(db DBTX, where string, args ...any) ([]QType, error) {
	rows, err := db.Query(typeSelect+where, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []QType{}
	for rows.Next() {
		var t QType
		var upd sql.NullString
		if err := rows.Scan(&t.ID, &t.SubjectID, &t.Name, &t.Kind, &t.CreatedAt, &upd, &t.QuestionCount); err != nil {
			return nil, err
		}
		t.UpdatedAt = nullStr(upd)
		out = append(out, t)
	}
	return out, rows.Err()
}

func findType(db DBTX, id int64) (*QType, error) {
	ts, err := queryTypes(db, " WHERE t.id = ?", id)
	if err != nil {
		return nil, err
	}
	if len(ts) == 0 {
		return nil, httpErr(404, "Question type not found")
	}
	return &ts[0], nil
}

func seedDefaultTypes(db DBTX, subjectID int64) error {
	for _, d := range defaultTypes {
		if _, err := db.Exec(`INSERT INTO question_types (subject_id, name, kind) VALUES (?,?,?)`, subjectID, d.Name, d.Kind); err != nil {
			return err
		}
	}
	return nil
}

// ensureType finds a type by name (case-insensitive) or creates it. A name that already
// exists with a different kind is an error.
func ensureType(db DBTX, subjectID int64, name, kind string) (*QType, bool, error) {
	ts, err := queryTypes(db, " WHERE t.subject_id = ? AND t.name = ?", subjectID, name)
	if err != nil {
		return nil, false, err
	}
	if len(ts) > 0 {
		if ts[0].Kind != kind {
			return nil, false, httpErr(422, `question type "%s" already exists with kind "%s" (not "%s")`, name, ts[0].Kind, kind)
		}
		return &ts[0], false, nil
	}
	res, err := db.Exec(`INSERT INTO question_types (subject_id, name, kind) VALUES (?,?,?)`, subjectID, name, kind)
	if err != nil {
		return nil, false, err
	}
	id, _ := res.LastInsertId()
	t, err := findType(db, id)
	return t, true, err
}

// resolveType picks the question type for a question of the given subject from:
//
//	type_id        id of one of the subject's types
//	type           a type name (case-insensitive) or, failing that, a kind (mcq, true_false, text)
//	(neither)      the subject's first "mcq" type
func resolveType(db DBTX, subjectID int64, f Fields) (*QType, error) {
	if v, ok := f["type_id"]; ok && v != nil && toStr(v) != "" {
		id, err := idFrom(v, "type_id")
		if err != nil {
			return nil, err
		}
		ts, err := queryTypes(db, " WHERE t.id = ? AND t.subject_id = ?", id, subjectID)
		if err != nil {
			return nil, err
		}
		if len(ts) == 0 {
			return nil, httpErr(400, "type_id %d does not belong to this subject", id)
		}
		return &ts[0], nil
	}
	if name := f.Str("type"); name != "" {
		ts, err := queryTypes(db, " WHERE t.subject_id = ? AND t.name = ?", subjectID, name)
		if err != nil {
			return nil, err
		}
		if len(ts) > 0 {
			return &ts[0], nil
		}
		if kind := strings.ToLower(name); contains(questionKinds, kind) {
			if ts, err = queryTypes(db, " WHERE t.subject_id = ? AND t.kind = ? ORDER BY t.id LIMIT 1", subjectID, kind); err != nil {
				return nil, err
			}
			if len(ts) > 0 {
				return &ts[0], nil
			}
		}
		return nil, httpErr(400, `Unknown question type "%s" for this subject`, name)
	}
	ts, err := queryTypes(db, " WHERE t.subject_id = ? AND t.kind = 'mcq' ORDER BY t.id LIMIT 1", subjectID)
	if err != nil {
		return nil, err
	}
	if len(ts) == 0 {
		return nil, httpErr(400, "type_id is required")
	}
	return &ts[0], nil
}

func (a *App) listTypes(w http.ResponseWriter, r *http.Request) error {
	subjectID, err := pathID(r, "subjectId", "subject id")
	if err != nil {
		return err
	}
	if err := assertSubject(a.db, subjectID); err != nil {
		return err
	}
	ts, err := queryTypes(a.db, " WHERE t.subject_id = ? ORDER BY t.id", subjectID)
	if err != nil {
		return err
	}
	writeJSON(w, 200, ts)
	return nil
}

func (a *App) createType(w http.ResponseWriter, r *http.Request) error {
	subjectID, err := pathID(r, "subjectId", "subject id")
	if err != nil {
		return err
	}
	if err := assertSubject(a.db, subjectID); err != nil {
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
	kind := strings.ToLower(f.Str("kind"))
	if !contains(questionKinds, kind) {
		return httpErr(400, "kind must be one of: %s", strings.Join(questionKinds, ", "))
	}
	res, err := a.db.Exec(`INSERT INTO question_types (subject_id, name, kind) VALUES (?,?,?)`, subjectID, name, kind)
	if err != nil {
		return err
	}
	id, _ := res.LastInsertId()
	t, err := findType(a.db, id)
	if err != nil {
		return err
	}
	writeJSON(w, 201, t)
	return nil
}

func (a *App) getType(w http.ResponseWriter, r *http.Request) error {
	id, err := pathID(r, "id", "id")
	if err != nil {
		return err
	}
	t, err := findType(a.db, id)
	if err != nil {
		return err
	}
	writeJSON(w, 200, t)
	return nil
}

func (a *App) updateType(w http.ResponseWriter, r *http.Request) error {
	id, err := pathID(r, "id", "id")
	if err != nil {
		return err
	}
	cur, err := findType(a.db, id)
	if err != nil {
		return err
	}
	f, _, err := readInput(w, r, maxJSONBody, "")
	if err != nil {
		return err
	}
	name, kind := cur.Name, cur.Kind
	if f.Has("name") {
		if name, err = required(f.Str("name"), "name"); err != nil {
			return err
		}
	}
	if f.Has("kind") {
		kind = strings.ToLower(f.Str("kind"))
		if !contains(questionKinds, kind) {
			return httpErr(400, "kind must be one of: %s", strings.Join(questionKinds, ", "))
		}
		if kind != cur.Kind && cur.QuestionCount > 0 {
			return httpErr(409, "Cannot change the kind of a type that has %d question(s)", cur.QuestionCount)
		}
	}
	if _, err := a.db.Exec(`UPDATE question_types SET name=?, kind=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`, name, kind, id); err != nil {
		return err
	}
	t, err := findType(a.db, id)
	if err != nil {
		return err
	}
	writeJSON(w, 200, t)
	return nil
}

func (a *App) deleteType(w http.ResponseWriter, r *http.Request) error {
	id, err := pathID(r, "id", "id")
	if err != nil {
		return err
	}
	cur, err := findType(a.db, id)
	if err != nil {
		return err
	}
	if cur.QuestionCount > 0 {
		return httpErr(409, "%d question(s) use this type; delete them or change their type first", cur.QuestionCount)
	}
	if _, err := a.db.Exec(`DELETE FROM question_types WHERE id=?`, id); err != nil {
		return err
	}
	w.WriteHeader(http.StatusNoContent)
	return nil
}

// ============================ chapters (per subject) ============================

type Chapter struct {
	ID            int64   `json:"id"`
	SubjectID     int64   `json:"subject_id"`
	Name          string  `json:"name"`
	Position      int64   `json:"position"`
	Description   string  `json:"description"`
	CreatedAt     string  `json:"created_at"`
	UpdatedAt     *string `json:"updated_at"`
	QuestionCount int     `json:"question_count"`
}

const chapterSelect = `SELECT ch.id, ch.subject_id, ch.name, ch.position, ch.description, ch.created_at, ch.updated_at,
	(SELECT COUNT(*) FROM questions q WHERE q.chapter_id = ch.id) FROM chapters ch`

func queryChapters(db DBTX, where string, args ...any) ([]Chapter, error) {
	rows, err := db.Query(chapterSelect+where, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Chapter{}
	for rows.Next() {
		var c Chapter
		var upd sql.NullString
		if err := rows.Scan(&c.ID, &c.SubjectID, &c.Name, &c.Position, &c.Description, &c.CreatedAt, &upd, &c.QuestionCount); err != nil {
			return nil, err
		}
		c.UpdatedAt = nullStr(upd)
		out = append(out, c)
	}
	return out, rows.Err()
}

func findChapter(db DBTX, id int64) (*Chapter, error) {
	cs, err := queryChapters(db, " WHERE ch.id = ?", id)
	if err != nil {
		return nil, err
	}
	if len(cs) == 0 {
		return nil, httpErr(404, "Chapter not found")
	}
	return &cs[0], nil
}

func nextChapterPosition(db DBTX, subjectID int64) (int64, error) {
	var n int64
	err := db.QueryRow(`SELECT COALESCE(MAX(position), 0) + 1 FROM chapters WHERE subject_id = ?`, subjectID).Scan(&n)
	return n, err
}

// ensureChapter finds a chapter by name or creates it (position 0 = append at the end).
func ensureChapter(db DBTX, subjectID int64, name string, position int64, description string) (int64, bool, error) {
	var id int64
	err := db.QueryRow(`SELECT id FROM chapters WHERE subject_id=? AND name=?`, subjectID, name).Scan(&id)
	if err == nil {
		return id, false, nil
	}
	if !errors.Is(err, sql.ErrNoRows) {
		return 0, false, err
	}
	if position == 0 {
		if position, err = nextChapterPosition(db, subjectID); err != nil {
			return 0, false, err
		}
	}
	res, err := db.Exec(`INSERT INTO chapters (subject_id, name, position, description) VALUES (?,?,?,?)`,
		subjectID, name, position, description)
	if err != nil {
		return 0, false, err
	}
	id, _ = res.LastInsertId()
	return id, true, nil
}

// resolveChapter validates an optional chapter_id (null / "" = no chapter).
func resolveChapter(db DBTX, subjectID int64, f Fields) (*int64, error) {
	v, ok := f["chapter_id"]
	if !ok || v == nil || toStr(v) == "" {
		return nil, nil
	}
	id, err := idFrom(v, "chapter_id")
	if err != nil {
		return nil, err
	}
	var one int
	err = db.QueryRow(`SELECT 1 FROM chapters WHERE id=? AND subject_id=?`, id, subjectID).Scan(&one)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, httpErr(400, "chapter_id %d does not belong to this subject", id)
	}
	if err != nil {
		return nil, err
	}
	return &id, nil
}

func (a *App) listChapters(w http.ResponseWriter, r *http.Request) error {
	subjectID, err := pathID(r, "subjectId", "subject id")
	if err != nil {
		return err
	}
	if err := assertSubject(a.db, subjectID); err != nil {
		return err
	}
	cs, err := queryChapters(a.db, " WHERE ch.subject_id = ? ORDER BY ch.position, ch.id", subjectID)
	if err != nil {
		return err
	}
	writeJSON(w, 200, cs)
	return nil
}

func (a *App) createChapter(w http.ResponseWriter, r *http.Request) error {
	subjectID, err := pathID(r, "subjectId", "subject id")
	if err != nil {
		return err
	}
	if err := assertSubject(a.db, subjectID); err != nil {
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
	var pos int64
	if f.Has("position") && f["position"] != nil && toStr(f["position"]) != "" {
		p, ok := f.Int("position")
		if !ok {
			return httpErr(400, "position must be an integer")
		}
		pos = p
	} else if pos, err = nextChapterPosition(a.db, subjectID); err != nil {
		return err
	}
	res, err := a.db.Exec(`INSERT INTO chapters (subject_id, name, position, description) VALUES (?,?,?,?)`,
		subjectID, name, pos, f.Str("description"))
	if err != nil {
		return err
	}
	id, _ := res.LastInsertId()
	c, err := findChapter(a.db, id)
	if err != nil {
		return err
	}
	writeJSON(w, 201, c)
	return nil
}

func (a *App) getChapter(w http.ResponseWriter, r *http.Request) error {
	id, err := pathID(r, "id", "id")
	if err != nil {
		return err
	}
	c, err := findChapter(a.db, id)
	if err != nil {
		return err
	}
	writeJSON(w, 200, c)
	return nil
}

func (a *App) updateChapter(w http.ResponseWriter, r *http.Request) error {
	id, err := pathID(r, "id", "id")
	if err != nil {
		return err
	}
	cur, err := findChapter(a.db, id)
	if err != nil {
		return err
	}
	f, _, err := readInput(w, r, maxJSONBody, "")
	if err != nil {
		return err
	}
	name, pos, desc := cur.Name, cur.Position, cur.Description
	if f.Has("name") {
		if name, err = required(f.Str("name"), "name"); err != nil {
			return err
		}
	}
	if f.Has("position") {
		p, ok := f.Int("position")
		if !ok {
			return httpErr(400, "position must be an integer")
		}
		pos = p
	}
	if f.Has("description") {
		desc = f.Str("description")
	}
	if _, err := a.db.Exec(`UPDATE chapters SET name=?, position=?, description=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`, name, pos, desc, id); err != nil {
		return err
	}
	c, err := findChapter(a.db, id)
	if err != nil {
		return err
	}
	writeJSON(w, 200, c)
	return nil
}

// Deleting a chapter keeps its questions; they simply lose their chapter.
func (a *App) deleteChapter(w http.ResponseWriter, r *http.Request) error {
	id, err := pathID(r, "id", "id")
	if err != nil {
		return err
	}
	if _, err := findChapter(a.db, id); err != nil {
		return err
	}
	if _, err := a.db.Exec(`DELETE FROM chapters WHERE id=?`, id); err != nil {
		return err
	}
	w.WriteHeader(http.StatusNoContent)
	return nil
}
