package main

import (
	"database/sql"
	"fmt"
	"math"
	"regexp"
	"strings"
	"time"
)

var (
	questionKinds = []string{"mcq", "true_false", "text"}
	difficulties  = []string{"easy", "medium", "hard"}
	rtlLangs      = map[string]bool{"ar": true, "fa": true, "ur": true, "he": true}
	langRe        = regexp.MustCompile(`^[a-z]{2,3}(-[a-z0-9]+)*$`)

	// Created for every new subject (editable afterwards).
	defaultTypes     = []struct{ Name, Kind string }{{"MCQ", "mcq"}, {"True/False", "true_false"}, {"Plain", "text"}}
	defaultTypeNames = map[string]string{"mcq": "MCQ", "true_false": "True/False", "text": "Plain"}
)

func contains(list []string, s string) bool {
	for _, x := range list {
		if x == s {
			return true
		}
	}
	return false
}

// parseTrueFalse accepts booleans and common words (English, Bengali, Arabic).
func parseTrueFalse(v any) (bool, bool) {
	if b, ok := v.(bool); ok {
		return b, true
	}
	switch strings.ToLower(clean(toStr(v))) {
	case "true", "t", "yes", "y", "1", "সত্য", "ঠিক", "صح", "صحيح":
		return true, true
	case "false", "f", "no", "n", "0", "মিথ্যা", "ভুল", "خطأ", "خاطئ":
		return false, true
	}
	return false, false
}

// aliasDescription lets older clients keep sending "explanation".
func aliasDescription(f Fields) {
	if !f.Has("description") && f.Has("explanation") {
		f["description"] = f["explanation"]
	}
}

// QInput is a validated, normalised question ready to be stored.
type QInput struct {
	TypeID                                            int64
	Kind                                              string
	ChapterID                                         *int64
	Text, Math, Answer, Description, Lang, Difficulty string
	Marks                                             float64
	Options                                           [4]string
	Correct                                           int64 // 0 = none
}

// normalizeQuestion validates input against the kind of the question's type:
//
//	mcq        4 non-empty options + correct_option (1-4); answer = text of the correct option
//	true_false answer must be true/false
//	text       optional free-text answer
func normalizeQuestion(in Fields, t *QType, hasImage bool) (QInput, error) {
	n := QInput{TypeID: t.ID, Kind: t.Kind}
	n.Difficulty = strings.ToLower(in.StrDef("difficulty", "medium"))
	if !contains(difficulties, n.Difficulty) {
		return n, httpErr(400, "difficulty must be one of: %s", strings.Join(difficulties, ", "))
	}
	n.Lang = strings.ToLower(in.StrDef("lang", "en"))
	if !langRe.MatchString(n.Lang) {
		return n, httpErr(400, "lang must be a language code like en, ar, bn")
	}
	n.Marks = 1
	if v, ok := in["marks"]; ok && v != nil && toStr(v) != "" {
		m, ok := toFloat(v)
		if !ok || math.IsNaN(m) || math.IsInf(m, 0) || m < 0 {
			return n, httpErr(400, "marks must be a non-negative number")
		}
		n.Marks = m
	}
	n.Text, n.Math, n.Description = in.Str("text"), in.Str("math"), in.Str("description")
	if n.Text == "" && n.Math == "" && !hasImage {
		return n, httpErr(400, "A question needs at least one of: text, math, image")
	}

	switch t.Kind {
	case "mcq":
		var src []any
		if list, ok := in["options"].([]any); ok {
			src = list
		} else {
			src = []any{in["option_1"], in["option_2"], in["option_3"], in["option_4"]}
		}
		if len(src) != 4 {
			return n, httpErr(400, "An MCQ requires exactly 4 non-empty options")
		}
		for i, o := range src {
			n.Options[i] = clean(toStr(o))
			if n.Options[i] == "" {
				return n, httpErr(400, "An MCQ requires exactly 4 non-empty options")
			}
		}
		c, ok := in.Int("correct_option")
		if !ok || c < 1 || c > 4 {
			return n, httpErr(400, "correct_option must be an integer from 1 to 4")
		}
		n.Correct = c
		n.Answer = n.Options[c-1]
	case "true_false":
		b, ok := parseTrueFalse(in["answer"])
		if !ok {
			return n, httpErr(400, "answer must be true or false for a true/false question")
		}
		n.Answer = fmt.Sprint(b)
	default:
		n.Answer = in.Str("answer")
	}
	return n, nil
}

// ---- storage ------------------------------------------------------------------

type Question struct {
	ID, SubjectID, TypeID  int64
	TypeName, Kind         string
	ChapterID              sql.NullInt64
	ChapterName            sql.NullString
	Text, Math             string
	ImageID                sql.NullInt64
	Opt                    [4]sql.NullString
	Correct                sql.NullInt64
	Answer, Description    string
	Marks                  float64
	Difficulty, Lang       string
	Joined                 bool // subject/class names loaded
	SubjectName, ClassName string
	ClassID                int64
}

const (
	qSelect = `SELECT q.id, q.subject_id, q.type_id, t.name, t.kind, q.chapter_id, ch.name,
		q.text, q.math, q.image_id, q.option_1, q.option_2, q.option_3, q.option_4, q.correct_option,
		q.answer, q.description, q.marks, q.difficulty, q.lang`
	qFrom        = ` FROM questions q JOIN question_types t ON t.id = q.type_id LEFT JOIN chapters ch ON ch.id = q.chapter_id`
	qScopeSelect = `, s.name, c.id, c.name`
	qScopeFrom   = ` JOIN subjects s ON s.id = q.subject_id JOIN classes c ON c.id = s.class_id`
)

// queryQuestions runs the standard question SELECT. tail is the " WHERE ... ORDER BY ..." part
// (columns are aliased q = questions, t = question_types, ch = chapters, and s/c when scope is true).
func queryQuestions(db DBTX, scope bool, tail string, args ...any) ([]Question, error) {
	query := qSelect
	if scope {
		query += qScopeSelect
	}
	query += qFrom
	if scope {
		query += qScopeFrom
	}
	rows, err := db.Query(query+tail, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Question{}
	for rows.Next() {
		var q Question
		dest := []any{&q.ID, &q.SubjectID, &q.TypeID, &q.TypeName, &q.Kind, &q.ChapterID, &q.ChapterName,
			&q.Text, &q.Math, &q.ImageID, &q.Opt[0], &q.Opt[1], &q.Opt[2], &q.Opt[3], &q.Correct,
			&q.Answer, &q.Description, &q.Marks, &q.Difficulty, &q.Lang}
		if scope {
			dest = append(dest, &q.SubjectName, &q.ClassID, &q.ClassName)
		}
		if err := rows.Scan(dest...); err != nil {
			return nil, err
		}
		q.Joined = scope
		out = append(out, q)
	}
	return out, rows.Err()
}

func findQuestion(db DBTX, id int64) (*Question, error) {
	qs, err := queryQuestions(db, false, " WHERE q.id = ?", id)
	if err != nil {
		return nil, err
	}
	if len(qs) == 0 {
		return nil, httpErr(404, "Question not found")
	}
	return &qs[0], nil
}

func optArgs(n QInput) (opts [4]any, correct any) {
	if n.Kind == "mcq" {
		for i := range opts {
			opts[i] = n.Options[i]
		}
		correct = n.Correct
	}
	return
}

func ptrArg(p *int64) any {
	if p == nil {
		return nil
	}
	return *p
}

func insertQuestion(db DBTX, subjectID int64, n QInput, imageID *int64) (int64, error) {
	o, c := optArgs(n)
	res, err := db.Exec(`INSERT INTO questions
		(subject_id, chapter_id, type_id, text, math, image_id, option_1, option_2, option_3, option_4,
		 correct_option, answer, description, marks, difficulty, lang)
		VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
		subjectID, ptrArg(n.ChapterID), n.TypeID, n.Text, n.Math, ptrArg(imageID), o[0], o[1], o[2], o[3],
		c, n.Answer, n.Description, n.Marks, n.Difficulty, n.Lang)
	if err != nil {
		return 0, err
	}
	return res.LastInsertId()
}

func updateQuestion(db DBTX, id int64, n QInput, imageID *int64) error {
	o, c := optArgs(n)
	_, err := db.Exec(`UPDATE questions SET chapter_id=?, type_id=?, text=?, math=?, image_id=?,
		option_1=?, option_2=?, option_3=?, option_4=?, correct_option=?, answer=?, description=?,
		marks=?, difficulty=?, lang=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`,
		ptrArg(n.ChapterID), n.TypeID, n.Text, n.Math, ptrArg(imageID), o[0], o[1], o[2], o[3],
		c, n.Answer, n.Description, n.Marks, n.Difficulty, n.Lang, id)
	return err
}

// ---- API shape ----------------------------------------------------------------

type QuestionOut struct {
	ID            int64    `json:"id"`
	SubjectID     int64    `json:"subject_id"`
	SubjectName   string   `json:"subject_name,omitempty"`
	ClassID       int64    `json:"class_id,omitempty"`
	ClassName     string   `json:"class_name,omitempty"`
	TypeID        int64    `json:"type_id"`
	Type          string   `json:"type"`
	Kind          string   `json:"kind"`
	ChapterID     *int64   `json:"chapter_id"`
	ChapterName   *string  `json:"chapter_name"`
	Text          string   `json:"text"`
	Math          string   `json:"math"`
	ImageURL      *string  `json:"image_url"`
	Options       []string `json:"options"`
	Marks         float64  `json:"marks"`
	Difficulty    string   `json:"difficulty"`
	Lang          string   `json:"lang"`
	Dir           string   `json:"dir"`
	CorrectOption *int64   `json:"correct_option,omitempty"`
	Answer        *string  `json:"answer,omitempty"`
	Description   *string  `json:"description,omitempty"`
}

func serializeQuestion(q Question, answers bool) QuestionOut {
	o := QuestionOut{ID: q.ID, SubjectID: q.SubjectID, TypeID: q.TypeID, Type: q.TypeName, Kind: q.Kind,
		Text: q.Text, Math: q.Math, Marks: q.Marks, Difficulty: q.Difficulty, Lang: q.Lang, Dir: "ltr",
		ChapterName: nullStr(q.ChapterName)}
	if q.ChapterID.Valid {
		id := q.ChapterID.Int64
		o.ChapterID = &id
	}
	if q.Joined {
		o.SubjectName, o.ClassID, o.ClassName = q.SubjectName, q.ClassID, q.ClassName
	}
	if q.ImageID.Valid {
		u := fmt.Sprintf("/api/files/%d", q.ImageID.Int64)
		o.ImageURL = &u
	}
	if q.Kind == "mcq" {
		o.Options = []string{q.Opt[0].String, q.Opt[1].String, q.Opt[2].String, q.Opt[3].String}
	}
	if rtlLangs[q.Lang] {
		o.Dir = "rtl"
	}
	if answers {
		if q.Correct.Valid {
			c := q.Correct.Int64
			o.CorrectOption = &c
		}
		a, d := q.Answer, q.Description
		o.Answer, o.Description = &a, &d
	}
	return o
}

// ---- files & institute ----------------------------------------------------------

func saveFile(db DBTX, data []byte, mimeType, kind string) (int64, error) {
	name := fmt.Sprintf("%s-%d.%s", kind, time.Now().UnixMilli(), allowedImageTypes[mimeType])
	res, err := db.Exec(`INSERT INTO files (filename, mime, size, data) VALUES (?,?,?,?)`, name, mimeType, len(data), data)
	if err != nil {
		return 0, err
	}
	return res.LastInsertId()
}

// purgeOrphanFiles removes blobs no longer used by a question or the institute logo.
func purgeOrphanFiles(db DBTX) error {
	_, err := db.Exec(`DELETE FROM files
		WHERE id NOT IN (SELECT image_id FROM questions WHERE image_id IS NOT NULL)
		  AND id NOT IN (SELECT logo_file_id FROM institute WHERE logo_file_id IS NOT NULL)`)
	return err
}

type Institute struct {
	Name      string  `json:"name"`
	Location  string  `json:"location"`
	LogoURL   *string `json:"logo_url"`
	UpdatedAt *string `json:"updated_at"`
}

func getInstitute(db DBTX) (Institute, error) {
	var in Institute
	var logo sql.NullInt64
	var upd sql.NullString
	if err := db.QueryRow(`SELECT name, location, logo_file_id, updated_at FROM institute WHERE id = 1`).
		Scan(&in.Name, &in.Location, &logo, &upd); err != nil {
		return in, err
	}
	if logo.Valid {
		u := fmt.Sprintf("/api/files/%d", logo.Int64)
		in.LogoURL = &u
	}
	in.UpdatedAt = nullStr(upd)
	return in, nil
}
