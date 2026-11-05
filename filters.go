package main

import (
	"net/url"
	"sort"
	"strconv"
	"strings"
)

// qFilter selects questions by chapter, type, kind, difficulty and language.
// Every field accepts several values (OR within a field, AND between fields).
// SQL aliases: q = questions, t = question_types.
type qFilter struct {
	ChapterIDs   []int64
	NoChapter    bool // also match questions without a chapter
	TypeIDs      []int64
	Kinds        []string // mcq | true_false | text
	TypeNames    []string // matches a type name OR a kind
	Difficulties []string
	Langs        []string
}

func int64Args(ids []int64) []any {
	out := make([]any, len(ids))
	for i, v := range ids {
		out[i] = v
	}
	return out
}

func strArgs(ss []string) []any {
	out := make([]any, len(ss))
	for i, v := range ss {
		out[i] = v
	}
	return out
}

func (f qFilter) build() (where []string, args []any) {
	if len(f.ChapterIDs) > 0 || f.NoChapter {
		var parts []string
		if len(f.ChapterIDs) > 0 {
			parts = append(parts, "q.chapter_id IN ("+placeholders(len(f.ChapterIDs))+")")
			args = append(args, int64Args(f.ChapterIDs)...)
		}
		if f.NoChapter {
			parts = append(parts, "q.chapter_id IS NULL")
		}
		where = append(where, "("+strings.Join(parts, " OR ")+")")
	}
	if len(f.TypeIDs) > 0 {
		where = append(where, "q.type_id IN ("+placeholders(len(f.TypeIDs))+")")
		args = append(args, int64Args(f.TypeIDs)...)
	}
	if len(f.Kinds) > 0 {
		where = append(where, "t.kind IN ("+placeholders(len(f.Kinds))+")")
		args = append(args, strArgs(f.Kinds)...)
	}
	if len(f.TypeNames) > 0 {
		var parts []string
		for _, n := range f.TypeNames {
			parts = append(parts, "(t.name = ? OR t.kind = ?)")
			args = append(args, n, strings.ToLower(n))
		}
		where = append(where, "("+strings.Join(parts, " OR ")+")")
	}
	if len(f.Difficulties) > 0 {
		where = append(where, "q.difficulty IN ("+placeholders(len(f.Difficulties))+")")
		args = append(args, strArgs(f.Difficulties)...)
	}
	if len(f.Langs) > 0 {
		where = append(where, "q.lang IN ("+placeholders(len(f.Langs))+")")
		args = append(args, strArgs(f.Langs)...)
	}
	return
}

// anyList turns a JSON array or a scalar into a list ("" and null give nothing).
func anyList(v any) []any {
	switch t := v.(type) {
	case nil:
		return nil
	case []any:
		return t
	case string:
		if strings.TrimSpace(t) == "" {
			return nil
		}
	}
	return []any{v}
}

func queryList(qs url.Values, key string) []any {
	var out []any
	for _, raw := range qs[key] {
		for _, p := range strings.Split(raw, ",") {
			if p = strings.TrimSpace(p); p != "" {
				out = append(out, p)
			}
		}
	}
	return out
}

func parseIDList(vals []any, label string, allowNone bool) (ids []int64, none bool, err error) {
	for _, v := range vals {
		if allowNone && strings.EqualFold(toStr(v), "none") {
			none = true
			continue
		}
		id, e := idFrom(v, label)
		if e != nil {
			return nil, false, e
		}
		ids = append(ids, id)
	}
	return
}

func parseStrList(vals []any, lower bool) []string {
	var out []string
	for _, v := range vals {
		s := clean(toStr(v))
		if s == "" {
			continue
		}
		if lower {
			s = strings.ToLower(s)
		}
		out = append(out, s)
	}
	return out
}

func checkKinds(kinds []string) error {
	for _, k := range kinds {
		if !contains(questionKinds, k) {
			return httpErr(400, "kind must be one of: %s", strings.Join(questionKinds, ", "))
		}
	}
	return nil
}

// filterFromList reads ?chapter_id=1,2,none &type_id=3,4 &kind=mcq &type=Short &difficulty=easy &lang=bn
func filterFromQuery(qs url.Values) (f qFilter, err error) {
	if f.ChapterIDs, f.NoChapter, err = parseIDList(queryList(qs, "chapter_id"), "chapter_id", true); err != nil {
		return
	}
	if f.TypeIDs, _, err = parseIDList(queryList(qs, "type_id"), "type_id", false); err != nil {
		return
	}
	f.Kinds = parseStrList(queryList(qs, "kind"), true)
	f.TypeNames = parseStrList(queryList(qs, "type"), false)
	f.Difficulties = parseStrList(queryList(qs, "difficulty"), true)
	f.Langs = parseStrList(queryList(qs, "lang"), true)
	err = checkKinds(f.Kinds)
	return
}

// filterFromRandom reads the "random" object of POST /generate:
// chapter_ids (ids or "none"), type_ids, kinds, types (names), difficulty, lang. Each takes one value or a list.
func filterFromRandom(rm Fields) (f qFilter, err error) {
	if f.ChapterIDs, f.NoChapter, err = parseIDList(anyList(rm["chapter_ids"]), "chapter id", true); err != nil {
		return
	}
	if f.TypeIDs, _, err = parseIDList(anyList(rm["type_ids"]), "type id", false); err != nil {
		return
	}
	f.Kinds = parseStrList(anyList(rm["kinds"]), true)
	f.TypeNames = parseStrList(append(anyList(rm["types"]), anyList(rm["type"])...), false)
	f.Difficulties = parseStrList(anyList(rm["difficulty"]), true)
	f.Langs = parseStrList(anyList(rm["lang"]), true)
	err = checkKinds(f.Kinds)
	return
}

// sortedKeys orders numeric keys numerically (before names) so picking is deterministic.
func sortedKeys(m Fields) []string {
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	sort.Slice(keys, func(i, j int) bool {
		a, ea := strconv.ParseInt(keys[i], 10, 64)
		b, eb := strconv.ParseInt(keys[j], 10, 64)
		switch {
		case ea == nil && eb == nil:
			return a < b
		case ea == nil:
			return true
		case eb == nil:
			return false
		}
		return keys[i] < keys[j]
	})
	return keys
}
