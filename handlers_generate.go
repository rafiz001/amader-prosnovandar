package main

import (
	"database/sql"
	"encoding/json"
	"errors"
	"math/rand"
	"net/http"
	"strconv"
	"strings"
	"time"
)

type PaperQuestion struct {
	Number int `json:"number"`
	QuestionOut
}

type AnswerKeyItem struct {
	Number        int    `json:"number"`
	Type          string `json:"type"`
	Kind          string `json:"kind"`
	CorrectOption *int64 `json:"correct_option,omitempty"`
	Answer        string `json:"answer"`
}

type Paper struct {
	ID             *int64          `json:"id,omitempty"`
	Title          string          `json:"title"`
	GeneratedAt    string          `json:"generated_at"`
	Institute      Institute       `json:"institute"`
	Meta           map[string]any  `json:"meta"`
	TotalQuestions int             `json:"total_questions"`
	TotalMarks     float64         `json:"total_marks"`
	Questions      []PaperQuestion `json:"questions"`
	AnswerKey      []AnswerKeyItem `json:"answer_key,omitempty"`
}

func placeholders(n int) string { return strings.TrimSuffix(strings.Repeat("?,", n), ",") }

// POST /api/generate
//
//	{
//	  "title": "Mid-term",
//	  "question_ids": [3, 7],                 // hand-picked (order kept), optional
//	  "subject_id": 1  |  "class_id": 1,      // scope for random picking
//	  "random": {
//	    // pool filters, each takes one value or a list:
//	    "chapter_ids": [1, 2, "none"], "type_ids": [3, 4], "kinds": ["mcq"], "types": ["Short"],
//	    "difficulty": ["easy","medium"], "lang": "bn",
//	    // how many - exactly ONE of:
//	    "count": 10                            // total from the pool
//	    "by_type": {"3": 8, "Short": 2}        // per type: key = type id, type name, or kind
//	    "by_chapter": {"1": 5, "2": 5}         // per chapter: key = chapter id or "none"
//	    "allow_fewer": false
//	  },
//	  "shuffle_questions": true, "shuffle_options": true, "include_answers": false, "save": false, "meta": {}
//	}
//
// Hand-picked and random can be combined; random picks never repeat a question.
func (a *App) generate(w http.ResponseWriter, r *http.Request) error {
	b, _, err := readInput(w, r, maxJSONBody, "")
	if err != nil {
		return err
	}

	var fixedIDs []int64
	seen := map[int64]bool{}
	for _, v := range b.List("question_ids") {
		id, err := idFrom(v, "question id")
		if err != nil {
			return err
		}
		if seen[id] {
			return httpErr(400, "question_ids contains duplicates")
		}
		seen[id] = true
		fixedIDs = append(fixedIDs, id)
	}

	var picked []Question
	pickedIDs := map[int64]bool{}
	add := func(qs []Question) {
		for _, q := range qs {
			picked = append(picked, q)
			pickedIDs[q.ID] = true
		}
	}

	if len(fixedIDs) > 0 {
		rows, err := queryQuestions(a.db, true, " WHERE q.id IN ("+placeholders(len(fixedIDs))+")", int64Args(fixedIDs)...)
		if err != nil {
			return err
		}
		byID := map[int64]Question{}
		for _, q := range rows {
			byID[q.ID] = q
		}
		var missing []string
		var found []Question
		for _, id := range fixedIDs {
			if q, ok := byID[id]; ok {
				found = append(found, q)
			} else {
				missing = append(missing, strconv.FormatInt(id, 10))
			}
		}
		if len(missing) > 0 {
			return httpErr(404, "Questions not found: %s", strings.Join(missing, ", "))
		}
		add(found)
	}

	if v, ok := b["random"]; ok && v != nil && v != false {
		rm := b.Map("random")
		if rm == nil {
			return httpErr(400, "random must be an object")
		}
		var poolWhere []string
		var poolArgs []any
		if b.Has("subject_id") && b["subject_id"] != nil {
			id, err := idFrom(b["subject_id"], "subject_id")
			if err != nil {
				return err
			}
			poolWhere, poolArgs = append(poolWhere, "q.subject_id = ?"), append(poolArgs, id)
		} else if b.Has("class_id") && b["class_id"] != nil {
			id, err := idFrom(b["class_id"], "class_id")
			if err != nil {
				return err
			}
			poolWhere, poolArgs = append(poolWhere, "s.class_id = ?"), append(poolArgs, id)
		} else {
			return httpErr(400, "random picking requires subject_id or class_id")
		}
		flt, err := filterFromRandom(rm)
		if err != nil {
			return err
		}
		fw, fa := flt.build()
		poolWhere, poolArgs = append(poolWhere, fw...), append(poolArgs, fa...)

		pick := func(extraWhere string, extraArgs []any, n int64, label string) error {
			where := append([]string{}, poolWhere...)
			args := append([]any{}, poolArgs...)
			if extraWhere != "" {
				where, args = append(where, extraWhere), append(args, extraArgs...)
			}
			if len(pickedIDs) > 0 {
				ids := make([]int64, 0, len(pickedIDs))
				for id := range pickedIDs {
					ids = append(ids, id)
				}
				where = append(where, "q.id NOT IN ("+placeholders(len(ids))+")")
				args = append(args, int64Args(ids)...)
			}
			rows, err := queryQuestions(a.db, true,
				" WHERE "+strings.Join(where, " AND ")+" ORDER BY RANDOM() LIMIT ?", append(args, n)...)
			if err != nil {
				return err
			}
			if int64(len(rows)) < n && !rm.Bool("allow_fewer") {
				return httpErr(422, "Only %d %s question(s) available, %d requested", len(rows), label, n)
			}
			add(rows)
			return nil
		}

		isSet := func(k string) bool { return rm.Has(k) && rm[k] != nil }
		modes := 0
		for _, k := range []string{"count", "by_type", "by_chapter"} {
			if isSet(k) {
				modes++
			}
		}
		switch {
		case modes > 1:
			return httpErr(400, "Use only one of random.count, random.by_type, random.by_chapter")
		case isSet("by_type"):
			bt := rm.Map("by_type")
			if bt == nil {
				return httpErr(400, "random.by_type must be an object")
			}
			for _, key := range sortedKeys(bt) {
				n, ok := bt.Int(key)
				if !ok || n < 0 {
					return httpErr(400, "by_type counts must be integers >= 0")
				}
				if n == 0 {
					continue
				}
				var ew string
				var ea []any
				if id, err := strconv.ParseInt(key, 10, 64); err == nil {
					ew, ea = "q.type_id = ?", []any{id}
				} else {
					ew, ea = "(t.name = ? OR t.kind = ?)", []any{key, strings.ToLower(key)}
				}
				if err := pick(ew, ea, n, `"`+key+`"`); err != nil {
					return err
				}
			}
		case isSet("by_chapter"):
			bc := rm.Map("by_chapter")
			if bc == nil {
				return httpErr(400, "random.by_chapter must be an object")
			}
			for _, key := range sortedKeys(bc) {
				n, ok := bc.Int(key)
				if !ok || n < 0 {
					return httpErr(400, "by_chapter counts must be integers >= 0")
				}
				if n == 0 {
					continue
				}
				var ew string
				var ea []any
				if strings.EqualFold(key, "none") {
					ew = "q.chapter_id IS NULL"
				} else if id, err := strconv.ParseInt(key, 10, 64); err == nil {
					ew, ea = "q.chapter_id = ?", []any{id}
				} else {
					return httpErr(400, `by_chapter keys must be chapter ids or "none"`)
				}
				if err := pick(ew, ea, n, "chapter "+key); err != nil {
					return err
				}
			}
		default:
			n, ok := rm.Int("count")
			if !ok || n < 1 {
				return httpErr(400, "random.count must be an integer >= 1 (or use by_type / by_chapter)")
			}
			if err := pick("", nil, n, "matching"); err != nil {
				return err
			}
		}
	}

	if len(picked) == 0 {
		return httpErr(400, "Provide question_ids and/or random")
	}

	if b.Bool("shuffle_questions") {
		rand.Shuffle(len(picked), func(i, j int) { picked[i], picked[j] = picked[j], picked[i] })
	}
	if b.Bool("shuffle_options") {
		type opt struct {
			t  sql.NullString
			ok bool
		}
		for idx := range picked {
			q := &picked[idx]
			if q.Kind != "mcq" {
				continue
			}
			opts := make([]opt, 4)
			for i := range opts {
				opts[i] = opt{q.Opt[i], int64(i+1) == q.Correct.Int64}
			}
			rand.Shuffle(4, func(i, j int) { opts[i], opts[j] = opts[j], opts[i] })
			for i, o := range opts {
				q.Opt[i] = o.t
				if o.ok {
					q.Correct = sql.NullInt64{Int64: int64(i + 1), Valid: true}
				}
			}
		}
	}

	answers := b.Bool("include_answers")
	inst, err := getInstitute(a.db)
	if err != nil {
		return err
	}
	title := b.StrDef("title", "Question Paper")
	if title == "" {
		title = "Question Paper"
	}
	meta := map[string]any{}
	if m := b.Map("meta"); m != nil {
		meta = m
	}
	paper := Paper{Title: title, GeneratedAt: time.Now().UTC().Format("2006-01-02T15:04:05.000Z"),
		Institute: inst, Meta: meta, TotalQuestions: len(picked), Questions: make([]PaperQuestion, 0, len(picked))}
	for i, q := range picked {
		paper.TotalMarks += q.Marks
		paper.Questions = append(paper.Questions, PaperQuestion{i + 1, serializeQuestion(q, answers)})
		if answers && (q.Kind == "mcq" || q.Kind == "true_false") {
			item := AnswerKeyItem{Number: i + 1, Type: q.TypeName, Kind: q.Kind, Answer: q.Answer}
			if q.Correct.Valid {
				c := q.Correct.Int64
				item.CorrectOption = &c
			}
			paper.AnswerKey = append(paper.AnswerKey, item)
		}
	}

	status := 200
	if b.Bool("save") {
		status = 201
		tx, err := a.db.Begin()
		if err != nil {
			return err
		}
		defer tx.Rollback()
		res, err := tx.Exec(`INSERT INTO papers (title, data) VALUES (?, '{}')`, paper.Title)
		if err != nil {
			return err
		}
		id, _ := res.LastInsertId()
		paper.ID = &id
		data, err := json.Marshal(paper)
		if err != nil {
			return err
		}
		if _, err := tx.Exec(`UPDATE papers SET data=? WHERE id=?`, string(data), id); err != nil {
			return err
		}
		if err := tx.Commit(); err != nil {
			return err
		}
	}
	writeJSON(w, status, paper)
	return nil
}

func (a *App) listPapers(w http.ResponseWriter, r *http.Request) error {
	rows, err := a.db.Query(`SELECT id, title, created_at FROM papers ORDER BY id DESC`)
	if err != nil {
		return err
	}
	defer rows.Close()
	type item struct {
		ID        int64  `json:"id"`
		Title     string `json:"title"`
		CreatedAt string `json:"created_at"`
	}
	out := []item{}
	for rows.Next() {
		var it item
		if err := rows.Scan(&it.ID, &it.Title, &it.CreatedAt); err != nil {
			return err
		}
		out = append(out, it)
	}
	writeJSON(w, 200, out)
	return rows.Err()
}

func (a *App) getPaper(w http.ResponseWriter, r *http.Request) error {
	id, err := pathID(r, "id", "id")
	if err != nil {
		return err
	}
	var data string
	err = a.db.QueryRow(`SELECT data FROM papers WHERE id=?`, id).Scan(&data)
	if errors.Is(err, sql.ErrNoRows) {
		return httpErr(404, "Paper not found")
	}
	if err != nil {
		return err
	}
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	_, _ = w.Write([]byte(data))
	return nil
}

func (a *App) deletePaper(w http.ResponseWriter, r *http.Request) error {
	id, err := pathID(r, "id", "id")
	if err != nil {
		return err
	}
	res, err := a.db.Exec(`DELETE FROM papers WHERE id=?`, id)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return httpErr(404, "Paper not found")
	}
	w.WriteHeader(http.StatusNoContent)
	return nil
}
