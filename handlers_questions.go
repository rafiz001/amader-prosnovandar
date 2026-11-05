package main

import (
	"net/http"
	"strconv"
	"strings"
)

var likeEscaper = strings.NewReplacer(`\`, `\\`, `%`, `\%`, `_`, `\_`)

func clamp(v, lo, hi int) int {
	if v < lo {
		return lo
	}
	if v > hi {
		return hi
	}
	return v
}

// GET /api/subjects/{subjectId}/questions
//
//	?chapter_id=1,2,none  ?type_id=3,4  ?kind=mcq,true_false  ?type=Short  ?difficulty=easy
//	?lang=bn  ?q=search  ?limit=&offset=
func (a *App) listQuestions(w http.ResponseWriter, r *http.Request) error {
	subjectID, err := pathID(r, "subjectId", "subject id")
	if err != nil {
		return err
	}
	if err := assertSubject(a.db, subjectID); err != nil {
		return err
	}
	qs := r.URL.Query()
	flt, err := filterFromQuery(qs)
	if err != nil {
		return err
	}
	where := []string{"q.subject_id = ?"}
	args := []any{subjectID}
	fw, fa := flt.build()
	where, args = append(where, fw...), append(args, fa...)
	if q := qs.Get("q"); q != "" {
		like := "%" + likeEscaper.Replace(clean(q)) + "%"
		where = append(where, `(q.text LIKE ? ESCAPE '\' OR q.math LIKE ? ESCAPE '\')`)
		args = append(args, like, like)
	}
	limit, _ := strconv.Atoi(qs.Get("limit"))
	if limit == 0 {
		limit = 50
	}
	limit = clamp(limit, 1, 500)
	offset := clamp(func() int { n, _ := strconv.Atoi(qs.Get("offset")); return n }(), 0, 1<<31-1)

	tail := " WHERE " + strings.Join(where, " AND ")
	var total int
	if err := a.db.QueryRow(`SELECT COUNT(*) FROM questions q JOIN question_types t ON t.id = q.type_id`+tail, args...).Scan(&total); err != nil {
		return err
	}
	rows, err := queryQuestions(a.db, false, tail+" ORDER BY q.id LIMIT ? OFFSET ?", append(args, limit, offset)...)
	if err != nil {
		return err
	}
	items := make([]QuestionOut, 0, len(rows))
	for _, q := range rows {
		items = append(items, serializeQuestion(q, true))
	}
	writeJSON(w, 200, map[string]any{"total": total, "limit": limit, "offset": offset, "items": items})
	return nil
}

// POST accepts JSON or multipart/form-data (field "image" for the figure).
// Body: type_id (or type = name/kind), chapter_id?, text, math, options[4]+correct_option (mcq),
// answer (true_false: true/false; text: model answer), description, marks, difficulty, lang.
func (a *App) createQuestion(w http.ResponseWriter, r *http.Request) error {
	subjectID, err := pathID(r, "subjectId", "subject id")
	if err != nil {
		return err
	}
	if err := assertSubject(a.db, subjectID); err != nil {
		return err
	}
	f, up, err := readInput(w, r, maxImageBody, "image")
	if err != nil {
		return err
	}
	aliasDescription(f)
	t, err := resolveType(a.db, subjectID, f)
	if err != nil {
		return err
	}
	chapterID, err := resolveChapter(a.db, subjectID, f)
	if err != nil {
		return err
	}
	n, err := normalizeQuestion(f, t, up != nil)
	if err != nil {
		return err
	}
	n.ChapterID = chapterID

	tx, err := a.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()
	var imageID *int64
	if up != nil {
		id, err := saveFile(tx, up.Data, up.Mime, "image")
		if err != nil {
			return err
		}
		imageID = &id
	}
	id, err := insertQuestion(tx, subjectID, n, imageID)
	if err != nil {
		return err
	}
	q, err := findQuestion(tx, id)
	if err != nil {
		return err
	}
	if err := tx.Commit(); err != nil {
		return err
	}
	writeJSON(w, 201, serializeQuestion(*q, true))
	return nil
}

func (a *App) getQuestion(w http.ResponseWriter, r *http.Request) error {
	id, err := pathID(r, "id", "id")
	if err != nil {
		return err
	}
	q, err := findQuestion(a.db, id)
	if err != nil {
		return err
	}
	writeJSON(w, 200, serializeQuestion(*q, true))
	return nil
}

func (a *App) updateQuestion(w http.ResponseWriter, r *http.Request) error {
	id, err := pathID(r, "id", "id")
	if err != nil {
		return err
	}
	cur, err := findQuestion(a.db, id)
	if err != nil {
		return err
	}
	f, up, err := readInput(w, r, maxImageBody, "image")
	if err != nil {
		return err
	}
	aliasDescription(f)
	if f.Has("subject_id") {
		sid, err := idFrom(f["subject_id"], "subject_id")
		if err != nil {
			return err
		}
		if sid != cur.SubjectID {
			return httpErr(400, "A question cannot be moved to another subject; create it there instead")
		}
	}

	// Body fields override the stored values; an `options` array overrides option_1..4.
	merged := Fields{"type_id": cur.TypeID, "text": cur.Text, "math": cur.Math, "marks": cur.Marks,
		"difficulty": cur.Difficulty, "lang": cur.Lang, "description": cur.Description, "answer": cur.Answer}
	for i := 0; i < 4; i++ {
		if cur.Opt[i].Valid {
			merged["option_"+strconv.Itoa(i+1)] = cur.Opt[i].String
		}
	}
	if cur.Correct.Valid {
		merged["correct_option"] = cur.Correct.Int64
	}
	if cur.ChapterID.Valid {
		merged["chapter_id"] = cur.ChapterID.Int64
	}
	for k, v := range f {
		merged[k] = v
	}
	if f.Has("type") && !f.Has("type_id") {
		delete(merged, "type_id") // a new type name/kind replaces the stored type
	}

	t, err := resolveType(a.db, cur.SubjectID, merged)
	if err != nil {
		return err
	}
	chapterID, err := resolveChapter(a.db, cur.SubjectID, merged)
	if err != nil {
		return err
	}
	var imageID *int64
	if cur.ImageID.Valid {
		v := cur.ImageID.Int64
		imageID = &v
	}
	if up == nil && f.Bool("remove_image") {
		imageID = nil
	}
	n, err := normalizeQuestion(merged, t, imageID != nil || up != nil)
	if err != nil {
		return err
	}
	n.ChapterID = chapterID

	tx, err := a.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()
	if up != nil {
		nid, err := saveFile(tx, up.Data, up.Mime, "image")
		if err != nil {
			return err
		}
		imageID = &nid
	}
	if err := updateQuestion(tx, id, n, imageID); err != nil {
		return err
	}
	if err := purgeOrphanFiles(tx); err != nil {
		return err
	}
	q, err := findQuestion(tx, id)
	if err != nil {
		return err
	}
	if err := tx.Commit(); err != nil {
		return err
	}
	writeJSON(w, 200, serializeQuestion(*q, true))
	return nil
}

func (a *App) deleteQuestion(w http.ResponseWriter, r *http.Request) error {
	id, err := pathID(r, "id", "id")
	if err != nil {
		return err
	}
	if _, err := findQuestion(a.db, id); err != nil {
		return err
	}
	if _, err := a.db.Exec(`DELETE FROM questions WHERE id=?`, id); err != nil {
		return err
	}
	if err := purgeOrphanFiles(a.db); err != nil {
		return err
	}
	w.WriteHeader(http.StatusNoContent)
	return nil
}
