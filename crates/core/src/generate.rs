use std::collections::{HashMap, HashSet};

use rusqlite::types::Value as SqlValue;
use rusqlite::{Connection, OptionalExtension};
use serde_json::Value;

use crate::error::{http_err, Result};
use crate::filters::filter_from_random;
use crate::models::{AnswerKeyItem, Paper, PaperListItem, PaperQuestion};
use crate::questions::{
    data_url, file_row, find_question, get_institute, query_questions, serialize_question,
    QuestionRow,
};
use crate::util::{
    format_iso_ms, id_from, now_ms, placeholders, sorted_keys, Fields, FieldsExt, Rng,
};

#[allow(clippy::too_many_arguments)]
fn pick_random(
    conn: &Connection,
    pool_where: &[String],
    pool_args: &[SqlValue],
    extra_where: Option<&str>,
    extra_args: &[SqlValue],
    n: i64,
    label: &str,
    allow_fewer: bool,
    picked: &mut Vec<QuestionRow>,
    picked_ids: &mut HashSet<i64>,
) -> Result<()> {
    let mut where_parts: Vec<String> = pool_where.to_vec();
    let mut args: Vec<SqlValue> = pool_args.to_vec();
    if let Some(extra) = extra_where {
        if !extra.is_empty() {
            where_parts.push(extra.to_string());
            args.extend(extra_args.iter().cloned());
        }
    }
    if !picked_ids.is_empty() {
        let ids: Vec<i64> = picked_ids.iter().copied().collect();
        where_parts.push(format!("q.id NOT IN ({})", placeholders(ids.len())));
        args.extend(ids.into_iter().map(SqlValue::Integer));
    }
    let tail = format!(
        " WHERE {} ORDER BY RANDOM() LIMIT ?",
        where_parts.join(" AND ")
    );
    args.push(SqlValue::Integer(n));
    let rows = query_questions(conn, true, &tail, args)?;
    if (rows.len() as i64) < n && !allow_fewer {
        let found = rows.len();
        return Err(http_err(
            422,
            format!("Only {found} {label} question(s) available, {n} requested"),
        ));
    }
    for q in rows {
        picked_ids.insert(q.id);
        picked.push(q);
    }
    Ok(())
}

/// Hand-picked and random questions can be combined; random picks never repeat one.
pub fn generate(conn: &Connection, b: &Fields) -> Result<Paper> {
    let mut fixed_ids: Vec<i64> = Vec::new();
    let mut seen: HashSet<i64> = HashSet::new();
    for v in b.list("question_ids") {
        let id = id_from(&v, "question id")?;
        if !seen.insert(id) {
            return Err(http_err(400, "question_ids contains duplicates"));
        }
        fixed_ids.push(id);
    }

    let mut picked: Vec<QuestionRow> = Vec::new();
    let mut picked_ids: HashSet<i64> = HashSet::new();

    if !fixed_ids.is_empty() {
        let args: Vec<SqlValue> = fixed_ids.iter().map(|v| SqlValue::Integer(*v)).collect();
        let tail = format!(" WHERE q.id IN ({})", placeholders(fixed_ids.len()));
        let rows = query_questions(conn, true, &tail, args)?;
        let mut by_id: HashMap<i64, QuestionRow> = HashMap::new();
        for q in rows {
            by_id.insert(q.id, q);
        }
        let mut missing: Vec<String> = Vec::new();
        for id in &fixed_ids {
            match by_id.remove(id) {
                Some(q) => {
                    picked_ids.insert(q.id);
                    picked.push(q);
                }
                None => missing.push(id.to_string()),
            }
        }
        if !missing.is_empty() {
            return Err(http_err(
                404,
                format!("Questions not found: {}", missing.join(", ")),
            ));
        }
    }

    if let Some(v) = b.get("random") {
        if !v.is_null() && *v != Value::Bool(false) {
            let Some(rm) = b.map("random") else {
                return Err(http_err(400, "random must be an object"));
            };
            let mut pool_where: Vec<String> = Vec::new();
            let mut pool_args: Vec<SqlValue> = Vec::new();
            if let Some(sv) = b.get("subject_id").filter(|v| !v.is_null()) {
                let id = id_from(sv, "subject_id")?;
                pool_where.push("q.subject_id = ?".to_string());
                pool_args.push(SqlValue::Integer(id));
            } else if let Some(cv) = b.get("class_id").filter(|v| !v.is_null()) {
                let id = id_from(cv, "class_id")?;
                pool_where.push("s.class_id = ?".to_string());
                pool_args.push(SqlValue::Integer(id));
            } else {
                return Err(http_err(
                    400,
                    "random picking requires subject_id or class_id",
                ));
            }

            let flt = filter_from_random(rm)?;
            let (fw, fa) = flt.build();
            pool_where.extend(fw);
            pool_args.extend(fa);

            let allow_fewer = rm.flag("allow_fewer");
            let is_set = |k: &str| rm.has(k) && !matches!(rm.get(k), None | Some(Value::Null));
            let modes = ["count", "by_type", "by_chapter"]
                .iter()
                .filter(|k| is_set(k))
                .count();
            if modes > 1 {
                return Err(http_err(
                    400,
                    "Use only one of random.count, random.by_type, random.by_chapter",
                ));
            }

            if is_set("by_type") {
                let Some(bt) = rm.map("by_type") else {
                    return Err(http_err(400, "random.by_type must be an object"));
                };
                for key in sorted_keys(bt) {
                    let Some(n) = bt.int(&key) else {
                        return Err(http_err(400, "by_type counts must be integers >= 0"));
                    };
                    if n < 0 {
                        return Err(http_err(400, "by_type counts must be integers >= 0"));
                    }
                    if n == 0 {
                        continue;
                    }
                    let (extra, extra_args, label): (String, Vec<SqlValue>, String) =
                        match key.parse::<i64>() {
                            Ok(id) => (
                                "q.type_id = ?".to_string(),
                                vec![SqlValue::Integer(id)],
                                format!("\"{key}\""),
                            ),
                            Err(_) => (
                                "(t.name = ? OR t.kind = ?)".to_string(),
                                vec![
                                    SqlValue::Text(key.clone()),
                                    SqlValue::Text(key.to_lowercase()),
                                ],
                                format!("\"{key}\""),
                            ),
                        };
                    pick_random(
                        conn,
                        &pool_where,
                        &pool_args,
                        Some(&extra),
                        &extra_args,
                        n,
                        &label,
                        allow_fewer,
                        &mut picked,
                        &mut picked_ids,
                    )?;
                }
            } else if is_set("by_chapter") {
                let Some(bc) = rm.map("by_chapter") else {
                    return Err(http_err(400, "random.by_chapter must be an object"));
                };
                for key in sorted_keys(bc) {
                    let Some(n) = bc.int(&key) else {
                        return Err(http_err(400, "by_chapter counts must be integers >= 0"));
                    };
                    if n < 0 {
                        return Err(http_err(400, "by_chapter counts must be integers >= 0"));
                    }
                    if n == 0 {
                        continue;
                    }
                    let (extra, extra_args): (String, Vec<SqlValue>) = if key
                        .eq_ignore_ascii_case("none")
                    {
                        ("q.chapter_id IS NULL".to_string(), vec![])
                    } else {
                        match key.parse::<i64>() {
                            Ok(id) => ("q.chapter_id = ?".to_string(), vec![SqlValue::Integer(id)]),
                            Err(_) => {
                                return Err(http_err(
                                    400,
                                    "by_chapter keys must be chapter ids or \"none\"",
                                ))
                            }
                        }
                    };
                    pick_random(
                        conn,
                        &pool_where,
                        &pool_args,
                        Some(&extra),
                        &extra_args,
                        n,
                        &format!("chapter {key}"),
                        allow_fewer,
                        &mut picked,
                        &mut picked_ids,
                    )?;
                }
            } else {
                let n = rm.int("count").unwrap_or(0);
                if n < 1 {
                    return Err(http_err(
                        400,
                        "random.count must be an integer >= 1 (or use by_type / by_chapter)",
                    ));
                }
                pick_random(
                    conn,
                    &pool_where,
                    &pool_args,
                    None,
                    &[],
                    n,
                    "matching",
                    allow_fewer,
                    &mut picked,
                    &mut picked_ids,
                )?;
            }
        }
    }

    if picked.is_empty() {
        return Err(http_err(400, "Provide question_ids and/or random"));
    }

    if b.flag("shuffle_questions") {
        Rng::new().shuffle(&mut picked);
    }
    if b.flag("shuffle_options") {
        let mut rng = Rng::new();
        for q in picked.iter_mut() {
            if q.kind != "mcq" {
                continue;
            }
            let mut opts: Vec<(Option<String>, bool)> = (0..4)
                .map(|i| (q.opt[i].clone(), q.correct == Some(i as i64 + 1)))
                .collect();
            rng.shuffle(&mut opts);
            for (i, (text, was_correct)) in opts.into_iter().enumerate() {
                q.opt[i] = text;
                if was_correct {
                    q.correct = Some(i as i64 + 1);
                }
            }
        }
    }

    let answers = b.flag("include_answers");
    let institute = get_institute(conn)?;
    let mut title = b.str_def("title", "Question Paper");
    if title.is_empty() {
        title = "Question Paper".to_string();
    }
    let meta = b.map("meta").cloned().unwrap_or_default();

    let mut paper = Paper {
        id: None,
        title,
        generated_at: format_iso_ms(now_ms()),
        institute,
        meta,
        include_answers: answers,
        total_questions: picked.len(),
        total_marks: 0.0,
        questions: Vec::with_capacity(picked.len()),
        answer_key: None,
    };

    let mut key_items: Vec<AnswerKeyItem> = Vec::new();
    for (i, q) in picked.iter().enumerate() {
        paper.total_marks += q.marks;
        let number = i + 1;
        if q.kind == "mcq" || q.kind == "true_false" {
            key_items.push(AnswerKeyItem {
                number,
                type_name: q.type_name.clone(),
                kind: q.kind.clone(),
                correct_option: q.correct,
                answer: q.answer.clone(),
            });
        }
        paper.questions.push(PaperQuestion {
            number,
            question: serialize_question(conn, q, true),
        });
    }
    if !key_items.is_empty() {
        paper.answer_key = Some(key_items);
    }

    if b.flag("save") {
        let tx = conn.unchecked_transaction()?;
        tx.execute(
            "INSERT INTO papers (title, data) VALUES (?, '{}')",
            [&paper.title],
        )?;
        let id = tx.last_insert_rowid();
        paper.id = Some(id);
        let data = serde_json::to_string(&paper)?;
        tx.execute(
            "UPDATE papers SET data=? WHERE id=?",
            rusqlite::params![data, id],
        )?;
        tx.commit()?;
    }

    Ok(paper)
}

pub fn list_papers(conn: &Connection) -> Result<Vec<PaperListItem>> {
    let mut stmt = conn.prepare("SELECT id, title, created_at FROM papers ORDER BY id DESC")?;
    let rows = stmt.query_map([], |row| {
        Ok(PaperListItem {
            id: row.get(0)?,
            title: row.get(1)?,
            created_at: row.get(2)?,
        })
    })?;
    let mut out = Vec::new();
    for r in rows {
        out.push(r?);
    }
    Ok(out)
}

/// Saved papers from the old Go build embed "/api/files/:id" URLs. Rewrite them to
/// data URLs so old papers keep their figures and logo without an HTTP server.
fn resolve_legacy_file_urls(conn: &Connection, value: &mut Value) {
    match value {
        Value::String(text) => {
            if let Some(rest) = text.strip_prefix("/api/files/") {
                if let Ok(file_id) = rest.parse::<i64>() {
                    if let Some((mime, data)) = file_row(conn, file_id) {
                        *text = data_url(&mime, &data);
                    }
                }
            }
        }
        Value::Array(items) => {
            for item in items {
                resolve_legacy_file_urls(conn, item);
            }
        }
        Value::Object(map) => {
            for item in map.values_mut() {
                resolve_legacy_file_urls(conn, item);
            }
        }
        _ => {}
    }
}

/// Older saved papers may not carry answers when they were generated without them.
/// Fill the missing answer/description/correct option from the live question bank so
/// the preview can edit them. Existing values are never overwritten.
fn enrich_paper(conn: &Connection, value: &mut Value) {
    let Some(obj) = value.as_object_mut() else {
        return;
    };
    if !obj.contains_key("include_answers") {
        let inferred = obj
            .get("answer_key")
            .and_then(|v| v.as_array())
            .map(|items| !items.is_empty())
            .unwrap_or(false);
        obj.insert("include_answers".to_string(), Value::Bool(inferred));
    }
    let Some(questions) = obj.get_mut("questions").and_then(|v| v.as_array_mut()) else {
        return;
    };
    for item in questions {
        let Some(q) = item.as_object_mut() else {
            continue;
        };
        let Some(id) = q.get("id").and_then(Value::as_i64) else {
            continue;
        };
        let needs_answer = q.get("answer").map(|v| v.is_null()).unwrap_or(true);
        let needs_description = q.get("description").map(|v| v.is_null()).unwrap_or(true);
        let needs_correct = q.get("kind").and_then(Value::as_str) == Some("mcq")
            && q.get("correct_option").map(|v| v.is_null()).unwrap_or(true);
        if !(needs_answer || needs_description || needs_correct) {
            continue;
        }
        let Ok(row) = find_question(conn, id) else {
            continue;
        };
        if needs_answer {
            q.insert("answer".to_string(), Value::String(row.answer));
        }
        if needs_description {
            q.insert("description".to_string(), Value::String(row.description));
        }
        if needs_correct {
            if let Some(correct) = row.correct {
                q.insert("correct_option".to_string(), Value::from(correct));
            }
        }
    }
}

pub fn get_paper(conn: &Connection, id: i64) -> Result<Value> {
    let data: Option<String> = conn
        .query_row("SELECT data FROM papers WHERE id=?", [id], |r| r.get(0))
        .optional()?;
    match data {
        None => Err(http_err(404, "Paper not found")),
        Some(text) => {
            let mut value: Value = serde_json::from_str(&text).map_err(|e| {
                crate::error::ApiError::new(500, format!("Stored paper is invalid JSON: {e}"))
            })?;
            resolve_legacy_file_urls(conn, &mut value);
            enrich_paper(conn, &mut value);
            Ok(value)
        }
    }
}

pub fn update_paper(conn: &Connection, id: i64, paper: &Value) -> Result<()> {
    let Some(obj) = paper.as_object() else {
        return Err(http_err(400, "paper must be an object"));
    };
    let mut value = paper.clone();
    let mut title = obj.str("title");
    if title.is_empty() {
        title = "Question Paper".to_string();
        if let Some(map) = value.as_object_mut() {
            map.insert("title".to_string(), Value::String(title.clone()));
        }
    }
    let data = serde_json::to_string(&value)?;
    let changed = conn.execute(
        "UPDATE papers SET title=?, data=? WHERE id=?",
        rusqlite::params![title, data, id],
    )?;
    if changed == 0 {
        return Err(http_err(404, "Paper not found"));
    }
    Ok(())
}

pub fn delete_paper(conn: &Connection, id: i64) -> Result<()> {
    let changed = conn.execute("DELETE FROM papers WHERE id=?", [id])?;
    if changed == 0 {
        return Err(http_err(404, "Paper not found"));
    }
    Ok(())
}
