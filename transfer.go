package main

import (
	"bytes"
	"database/sql"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"
)

// Portable, id-independent document used for JSON/YAML export and for reading uploaded
// SQLite files. Version 2 adds chapters, question types, answer and description; version 1
// documents (type = "mcq"|"text", explanation) are still accepted on import.
type Doc struct {
	Format     string       `json:"format" yaml:"format"`
	Version    int          `json:"version" yaml:"version"`
	ExportedAt string       `json:"exported_at" yaml:"exported_at"`
	Institute  DocInstitute `json:"institute" yaml:"institute"`
	Classes    []DocClass   `json:"classes" yaml:"classes"`
	Files      []DocFile    `json:"files" yaml:"files"`
}

type DocInstitute struct {
	Name     string  `json:"name" yaml:"name"`
	Location string  `json:"location" yaml:"location"`
	Logo     *string `json:"logo" yaml:"logo"`
}

type DocClass struct {
	Name        string       `json:"name" yaml:"name"`
	Description string       `json:"description" yaml:"description"`
	Subjects    []DocSubject `json:"subjects" yaml:"subjects"`
}

type DocSubject struct {
	Name          string        `json:"name" yaml:"name"`
	Code          string        `json:"code" yaml:"code"`
	Chapters      []DocChapter  `json:"chapters" yaml:"chapters"`
	QuestionTypes []DocType     `json:"question_types" yaml:"question_types"`
	Questions     []DocQuestion `json:"questions" yaml:"questions"`
}

type DocChapter struct {
	Name        string `json:"name" yaml:"name"`
	Position    int64  `json:"position" yaml:"position"`
	Description string `json:"description" yaml:"description"`
}

type DocType struct {
	Name string `json:"name" yaml:"name"`
	Kind string `json:"kind" yaml:"kind"`
}

type DocQuestion struct {
	Type          string   `json:"type" yaml:"type"` // question type name
	Chapter       *string  `json:"chapter" yaml:"chapter"`
	Text          string   `json:"text" yaml:"text"`
	Math          string   `json:"math" yaml:"math"`
	Image         *string  `json:"image" yaml:"image"`
	Options       []string `json:"options,omitempty" yaml:"options,omitempty"`
	CorrectOption *int64   `json:"correct_option,omitempty" yaml:"correct_option,omitempty"`
	Answer        string   `json:"answer" yaml:"answer"`
	Description   string   `json:"description" yaml:"description"`
	Marks         float64  `json:"marks" yaml:"marks"`
	Difficulty    string   `json:"difficulty" yaml:"difficulty"`
	Lang          string   `json:"lang" yaml:"lang"`
}

type DocFile struct {
	Key        string `json:"key" yaml:"key"`
	Filename   string `json:"filename" yaml:"filename"`
	Mime       string `json:"mime" yaml:"mime"`
	DataBase64 string `json:"data_base64" yaml:"data_base64"`
}

// buildDoc reads any (current-schema) question-bank SQLite database.
func buildDoc(src DBTX, includeFiles bool) (*Doc, error) {
	keys := map[int64]string{}
	files := []DocFile{}
	keyFor := func(id sql.NullInt64) (*string, error) {
		if !id.Valid || !includeFiles {
			return nil, nil
		}
		if k, ok := keys[id.Int64]; ok {
			return &k, nil
		}
		var f DocFile
		var data []byte
		err := src.QueryRow(`SELECT filename, mime, data FROM files WHERE id=?`, id.Int64).Scan(&f.Filename, &f.Mime, &data)
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		if err != nil {
			return nil, err
		}
		key := fmt.Sprintf("file-%d", id.Int64)
		keys[id.Int64] = key
		f.Key, f.DataBase64 = key, base64.StdEncoding.EncodeToString(data)
		files = append(files, f)
		return &key, nil
	}

	doc := &Doc{Format: "question-bank", Version: 2, ExportedAt: time.Now().UTC().Format("2006-01-02T15:04:05.000Z"), Classes: []DocClass{}}

	var logo sql.NullInt64
	if err := src.QueryRow(`SELECT name, location, logo_file_id FROM institute WHERE id=1`).
		Scan(&doc.Institute.Name, &doc.Institute.Location, &logo); err != nil && !errors.Is(err, sql.ErrNoRows) {
		doc.Institute = DocInstitute{}
		logo = sql.NullInt64{}
	}
	var err error
	if doc.Institute.Logo, err = keyFor(logo); err != nil {
		return nil, err
	}

	type idName struct {
		id          int64
		name, extra string
	}
	readList := func(query string, args ...any) ([]idName, error) {
		rows, err := src.Query(query, args...)
		if err != nil {
			return nil, err
		}
		defer rows.Close()
		var out []idName
		for rows.Next() {
			var x idName
			var extra sql.NullString
			if err := rows.Scan(&x.id, &x.name, &extra); err != nil {
				return nil, err
			}
			x.extra = extra.String
			out = append(out, x)
		}
		return out, rows.Err()
	}

	classes, err := readList(`SELECT id, name, description FROM classes ORDER BY id`)
	if err != nil {
		return nil, err
	}
	for _, c := range classes {
		dc := DocClass{Name: c.name, Description: c.extra, Subjects: []DocSubject{}}
		subjects, err := readList(`SELECT id, name, code FROM subjects WHERE class_id=? ORDER BY id`, c.id)
		if err != nil {
			return nil, err
		}
		for _, s := range subjects {
			ds := DocSubject{Name: s.name, Code: s.extra, Chapters: []DocChapter{}, QuestionTypes: []DocType{}, Questions: []DocQuestion{}}

			chs, err := queryChapters(src, " WHERE ch.subject_id = ? ORDER BY ch.position, ch.id", s.id)
			if err != nil {
				return nil, err
			}
			for _, ch := range chs {
				ds.Chapters = append(ds.Chapters, DocChapter{Name: ch.Name, Position: ch.Position, Description: ch.Description})
			}
			ts, err := queryTypes(src, " WHERE t.subject_id = ? ORDER BY t.id", s.id)
			if err != nil {
				return nil, err
			}
			for _, t := range ts {
				ds.QuestionTypes = append(ds.QuestionTypes, DocType{Name: t.Name, Kind: t.Kind})
			}

			qs, err := queryQuestions(src, false, " WHERE q.subject_id = ? ORDER BY q.id", s.id)
			if err != nil {
				return nil, err
			}
			for _, q := range qs {
				img, err := keyFor(q.ImageID)
				if err != nil {
					return nil, err
				}
				dq := DocQuestion{Type: q.TypeName, Chapter: nullStr(q.ChapterName), Text: q.Text, Math: q.Math, Image: img,
					Answer: q.Answer, Description: q.Description, Marks: q.Marks, Difficulty: q.Difficulty, Lang: q.Lang}
				if q.Kind == "mcq" {
					dq.Options = []string{q.Opt[0].String, q.Opt[1].String, q.Opt[2].String, q.Opt[3].String}
					c := q.Correct.Int64
					dq.CorrectOption = &c
				}
				ds.Questions = append(ds.Questions, dq)
			}
			dc.Subjects = append(dc.Subjects, ds)
		}
		doc.Classes = append(doc.Classes, dc)
	}
	doc.Files = files
	return doc, nil
}

// docToFields converts the typed document into the loose form importDoc consumes.
func docToFields(doc *Doc) (Fields, error) {
	b, err := json.Marshal(doc)
	if err != nil {
		return nil, err
	}
	dec := json.NewDecoder(bytes.NewReader(b))
	dec.UseNumber()
	f := Fields{}
	return f, dec.Decode(&f)
}

type ImportStats struct {
	ClassesCreated            int `json:"classes_created"`
	SubjectsCreated           int `json:"subjects_created"`
	ChaptersCreated           int `json:"chapters_created"`
	QuestionTypesCreated      int `json:"question_types_created"`
	QuestionsAdded            int `json:"questions_added"`
	QuestionsSkippedDuplicate int `json:"questions_skipped_duplicate"`
}

// typeForImport resolves a question's type by name inside the subject. For old (v1) documents
// whose type is just a kind ("mcq", "text", ...), it reuses the subject's first type of that
// kind, or creates the default one.
func typeForImport(db DBTX, subjectID int64, name string, stats *ImportStats) (*QType, error) {
	t, err := resolveType(db, subjectID, Fields{"type": name})
	if err == nil {
		return t, nil
	}
	var he *HTTPError
	if !errors.As(err, &he) {
		return nil, err
	}
	if kind := strings.ToLower(name); contains(questionKinds, kind) {
		t, created, err := ensureType(db, subjectID, defaultTypeNames[kind], kind)
		if created {
			stats.QuestionTypesCreated++
		}
		return t, err
	}
	return nil, httpErr(422, `unknown question type "%s" (declare it in the subject's question_types)`, name)
}

// importDoc imports a document in one transaction (any invalid record aborts everything).
// merge: find-or-create classes/subjects/chapters/types by name, add new questions, skip exact
// duplicates. replace: wipe classes/subjects/questions first.
func importDoc(db *sql.DB, doc Fields, mode string) (ImportStats, error) {
	var stats ImportStats
	if mode != "merge" && mode != "replace" {
		return stats, httpErr(400, `mode must be "merge" or "replace"`)
	}
	classes, ok := doc["classes"].([]any)
	if !ok {
		return stats, httpErr(422, `Invalid document: a "classes" array is required`)
	}

	fileDefs := map[string]Fields{}
	for _, fv := range doc.List("files") {
		if fm, ok := fv.(map[string]any); ok {
			fileDefs[Fields(fm).Str("key")] = Fields(fm)
		}
	}
	fileIDs := map[string]int64{}

	tx, err := db.Begin()
	if err != nil {
		return stats, err
	}
	defer tx.Rollback()

	fileFor := func(key, where, kind string) (*int64, error) {
		if key == "" {
			return nil, nil
		}
		if id, ok := fileIDs[key]; ok {
			return &id, nil
		}
		def, ok := fileDefs[key]
		if !ok {
			return nil, httpErr(422, `%s: unknown file key "%s"`, where, key)
		}
		raw := strings.Map(func(r rune) rune {
			if r == '\n' || r == '\r' || r == ' ' || r == '\t' {
				return -1
			}
			return r
		}, toStr(def["data_base64"]))
		data, err := base64.StdEncoding.DecodeString(raw)
		if err != nil || len(data) == 0 {
			return nil, httpErr(422, "%s: invalid or empty image data", where)
		}
		mt := http.DetectContentType(data) // trust content, not the declared type
		if _, ok := allowedImageTypes[mt]; !ok {
			return nil, httpErr(422, "%s: unsupported image type", where)
		}
		id, err := saveFile(tx, data, mt, kind)
		if err != nil {
			return nil, err
		}
		fileIDs[key] = id
		return &id, nil
	}

	if mode == "replace" {
		if _, err := tx.Exec(`DELETE FROM classes`); err != nil {
			return stats, err
		}
		if _, err := tx.Exec(`UPDATE institute SET name='', location='', logo_file_id=NULL WHERE id=1`); err != nil {
			return stats, err
		}
	}

	if inst := doc.Map("institute"); inst != nil {
		logo, err := fileFor(inst.Str("logo"), "institute.logo", "logo")
		if err != nil {
			return stats, err
		}
		if _, err := tx.Exec(`UPDATE institute SET name=COALESCE(NULLIF(?,''),name), location=COALESCE(NULLIF(?,''),location),
			logo_file_id=COALESCE(?,logo_file_id), updated_at=CURRENT_TIMESTAMP WHERE id=1`,
			inst.Str("name"), inst.Str("location"), ptrArg(logo)); err != nil {
			return stats, err
		}
	}

	for ci, cv := range classes {
		cPath := fmt.Sprintf("classes[%d]", ci)
		cm, _ := cv.(map[string]any)
		c := Fields(cm)
		cName := c.Str("name")
		if cName == "" {
			return stats, httpErr(422, "%s: name is required", cPath)
		}
		var classID int64
		err := tx.QueryRow(`SELECT id FROM classes WHERE name=?`, cName).Scan(&classID)
		if errors.Is(err, sql.ErrNoRows) {
			res, err := tx.Exec(`INSERT INTO classes (name, description) VALUES (?,?)`, cName, c.Str("description"))
			if err != nil {
				return stats, err
			}
			classID, _ = res.LastInsertId()
			stats.ClassesCreated++
		} else if err != nil {
			return stats, err
		}

		for si, sv := range c.List("subjects") {
			sPath := fmt.Sprintf("%s.subjects[%d]", cPath, si)
			sm, _ := sv.(map[string]any)
			s := Fields(sm)
			sName := s.Str("name")
			if sName == "" {
				return stats, httpErr(422, "%s: name is required", sPath)
			}
			var subjectID int64
			err := tx.QueryRow(`SELECT id FROM subjects WHERE class_id=? AND name=?`, classID, sName).Scan(&subjectID)
			if errors.Is(err, sql.ErrNoRows) {
				res, err := tx.Exec(`INSERT INTO subjects (class_id, name, code) VALUES (?,?,?)`, classID, sName, s.Str("code"))
				if err != nil {
					return stats, err
				}
				subjectID, _ = res.LastInsertId()
				stats.SubjectsCreated++
			} else if err != nil {
				return stats, err
			}

			for ti, tv := range s.List("question_types") {
				tPath := fmt.Sprintf("%s.question_types[%d]", sPath, ti)
				tm, _ := tv.(map[string]any)
				tf := Fields(tm)
				name, kind := tf.Str("name"), strings.ToLower(tf.Str("kind"))
				if name == "" || !contains(questionKinds, kind) {
					return stats, httpErr(422, "%s: name and a kind (%s) are required", tPath, strings.Join(questionKinds, ", "))
				}
				_, created, err := ensureType(tx, subjectID, name, kind)
				if err != nil {
					return stats, httpErr(422, "%s: %s", tPath, errMsg(err))
				}
				if created {
					stats.QuestionTypesCreated++
				}
			}

			for hi, hv := range s.List("chapters") {
				hPath := fmt.Sprintf("%s.chapters[%d]", sPath, hi)
				hm, _ := hv.(map[string]any)
				hf := Fields(hm)
				name := hf.Str("name")
				if name == "" {
					return stats, httpErr(422, "%s: name is required", hPath)
				}
				pos, _ := hf.Int("position")
				if _, created, err := ensureChapter(tx, subjectID, name, pos, hf.Str("description")); err != nil {
					return stats, err
				} else if created {
					stats.ChaptersCreated++
				}
			}

			for qi, qv := range s.List("questions") {
				qPath := fmt.Sprintf("%s.questions[%d]", sPath, qi)
				qm, _ := qv.(map[string]any)
				q := Fields(qm)
				aliasDescription(q)

				typeName := q.Str("type")
				if typeName == "" {
					typeName = "mcq"
				}
				t, err := typeForImport(tx, subjectID, typeName, &stats)
				if err != nil {
					return stats, wrapPath(qPath, err)
				}
				var chapterID *int64
				if name := q.Str("chapter"); name != "" {
					id, created, err := ensureChapter(tx, subjectID, name, 0, "")
					if err != nil {
						return stats, err
					}
					if created {
						stats.ChaptersCreated++
					}
					chapterID = &id
				}
				imageID, err := fileFor(q.Str("image"), qPath, "image")
				if err != nil {
					return stats, err
				}
				n, err := normalizeQuestion(q, t, imageID != nil)
				if err != nil {
					return stats, wrapPath(qPath, err)
				}
				n.ChapterID = chapterID

				o, correct := optArgs(n)
				var dup int
				err = tx.QueryRow(`SELECT 1 FROM questions WHERE subject_id=? AND type_id=? AND text=? AND math=?
					AND option_1 IS ? AND option_2 IS ? AND option_3 IS ? AND option_4 IS ? AND correct_option IS ? AND answer=?`,
					subjectID, n.TypeID, n.Text, n.Math, o[0], o[1], o[2], o[3], correct, n.Answer).Scan(&dup)
				if err == nil {
					stats.QuestionsSkippedDuplicate++
					continue
				}
				if !errors.Is(err, sql.ErrNoRows) {
					return stats, err
				}
				if _, err := insertQuestion(tx, subjectID, n, imageID); err != nil {
					return stats, err
				}
				stats.QuestionsAdded++
			}
		}
	}
	if err := purgeOrphanFiles(tx); err != nil {
		return stats, err
	}
	return stats, tx.Commit()
}

func errMsg(err error) string {
	var he *HTTPError
	if errors.As(err, &he) {
		return he.Msg
	}
	return err.Error()
}

// wrapPath prefixes validation errors with where they happened; other errors pass through.
func wrapPath(path string, err error) error {
	var he *HTTPError
	if errors.As(err, &he) {
		return httpErr(422, "%s: %s", path, he.Msg)
	}
	return err
}
