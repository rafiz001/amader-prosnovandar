use rusqlite::types::Value as SqlValue;
use rusqlite::Connection;
use serde::Serialize;
use serde_json::{json, Value};

use crate::basic::{
    assert_subject, create_class, create_subject, delete_class, delete_logo, delete_subject,
    find_class, find_subject, list_classes, list_subjects, update_class, update_institute,
    update_subject, upload_logo,
};
use crate::error::{http_err, ApiError, Result};
use crate::filters::filter_from_query;
use crate::generate;
use crate::meta::{
    find_chapter, find_type, next_chapter_position, query_types, resolve_chapter, resolve_type,
};
use crate::models::{ImportStats, Paper, QuestionOut};
use crate::questions::{
    alias_description, find_question, get_institute, insert_question, normalize_question,
    purge_orphan_files, query_questions, save_file, serialize_question, update_question,
    QUESTION_KINDS,
};
use crate::transfer;
use crate::util::{
    b64_decode, clean, id_from, number_value, required, sniff_image, to_str, Fields, FieldsExt,
};

const MAX_IMAGE: usize = 5 << 20;

fn to_json<T: Serialize>(value: &T) -> Result<Value> {
    serde_json::to_value(value)
        .map_err(|e| ApiError::new(500, format!("could not encode JSON: {e}")))
}

fn id_arg(p: &Fields, key: &str, label: &str) -> Result<i64> {
    match p.get(key) {
        Some(v) => id_from(v, label),
        None => Err(http_err(400, format!("Invalid {label}"))),
    }
}

/// An uploaded image arrives as { data_base64, filename? }; bytes are sniffed, not trusted.
fn image_item(v: Option<&Value>) -> Result<Option<(Vec<u8>, String)>> {
    let Some(v) = v else {
        return Ok(None);
    };
    if v.is_null() {
        return Ok(None);
    }
    let Some(obj) = v.as_object() else {
        return Err(http_err(400, "Invalid image upload"));
    };
    let raw = obj.get("data_base64").map(to_str).unwrap_or_default();
    if raw.trim().is_empty() {
        return Ok(None);
    }
    let data = b64_decode(&raw)?;
    if data.is_empty() {
        return Ok(None);
    }
    if data.len() > MAX_IMAGE {
        return Err(http_err(413, "Image is larger than 5 MB"));
    }
    let (mime, _) = sniff_image(&data)?;
    Ok(Some((data, mime)))
}

fn require_image(v: Option<&Value>, message: &str) -> Result<(Vec<u8>, String)> {
    image_item(v)?.ok_or_else(|| http_err(400, message))
}

fn escape_like(s: &str) -> String {
    s.replace('\\', "\\\\")
        .replace('%', "\\%")
        .replace('_', "\\_")
}

fn list_questions(conn: &Connection, p: &Fields) -> Result<Value> {
    let subject_id = id_arg(p, "subject_id", "subject id")?;
    assert_subject(conn, subject_id)?;
    let flt = filter_from_query(p)?;

    let mut where_parts = vec!["q.subject_id = ?".to_string()];
    let mut args: Vec<SqlValue> = vec![SqlValue::Integer(subject_id)];
    let (fw, fa) = flt.build();
    where_parts.extend(fw);
    args.extend(fa);

    let search = p.str("q");
    if !search.is_empty() {
        let like = format!("%{}%", escape_like(&clean(&search)));
        where_parts.push("(q.text LIKE ? ESCAPE '\\' OR q.math LIKE ? ESCAPE '\\')".to_string());
        args.push(SqlValue::Text(like.clone()));
        args.push(SqlValue::Text(like));
    }

    let mut limit = p.int("limit").unwrap_or(0);
    if limit == 0 {
        limit = 50;
    }
    let limit = limit.clamp(1, 500);
    let offset = p.int("offset").unwrap_or(0).clamp(0, i32::MAX as i64);

    let tail = format!(" WHERE {}", where_parts.join(" AND "));
    let total: i64 = conn.query_row(
        &format!(
            "SELECT COUNT(*) FROM questions q JOIN question_types t ON t.id = q.type_id{tail}"
        ),
        rusqlite::params_from_iter(args.iter()),
        |r| r.get(0),
    )?;

    let mut row_args = args.clone();
    row_args.push(SqlValue::Integer(limit));
    row_args.push(SqlValue::Integer(offset));
    let rows = query_questions(
        conn,
        false,
        &format!("{tail} ORDER BY q.id LIMIT ? OFFSET ?"),
        row_args,
    )?;
    let items: Vec<QuestionOut> = rows
        .iter()
        .map(|q| serialize_question(conn, q, true))
        .collect();
    Ok(json!({
        "total": total,
        "limit": limit,
        "offset": offset,
        "items": items
    }))
}

fn create_question(conn: &Connection, p: &Fields) -> Result<Value> {
    let subject_id = id_arg(p, "subject_id", "subject id")?;
    assert_subject(conn, subject_id)?;

    let mut f = p.clone();
    alias_description(&mut f);
    let up = image_item(f.get("image"))?;
    let t = resolve_type(conn, subject_id, &f)?;
    let chapter_id = resolve_chapter(conn, subject_id, &f)?;
    let mut n = normalize_question(&f, &t, up.is_some())?;
    n.chapter_id = chapter_id;

    let tx = conn.unchecked_transaction()?;
    let mut image_id = None;
    if let Some((data, mime)) = &up {
        image_id = Some(save_file(&tx, data, mime, "image")?);
    }
    let id = insert_question(&tx, subject_id, &n, image_id)?;
    let q = find_question(&tx, id)?;
    tx.commit()?;
    to_json(&serialize_question(conn, &q, true))
}

fn update_question_op(conn: &Connection, p: &Fields) -> Result<Value> {
    let id = id_arg(p, "id", "id")?;
    let cur = find_question(conn, id)?;

    let mut f = p.clone();
    alias_description(&mut f);
    let up = image_item(f.get("image"))?;

    if let Some(v) = f.get("subject_id") {
        let sid = id_from(v, "subject_id")?;
        if sid != cur.subject_id {
            return Err(http_err(
                400,
                "A question cannot be moved to another subject; create it there instead",
            ));
        }
    }

    let mut merged = Fields::new();
    merged.insert("type_id".to_string(), Value::from(cur.type_id));
    merged.insert("text".to_string(), Value::String(cur.text.clone()));
    merged.insert("math".to_string(), Value::String(cur.math.clone()));
    merged.insert("marks".to_string(), number_value(cur.marks));
    merged.insert(
        "difficulty".to_string(),
        Value::String(cur.difficulty.clone()),
    );
    merged.insert("lang".to_string(), Value::String(cur.lang.clone()));
    merged.insert(
        "description".to_string(),
        Value::String(cur.description.clone()),
    );
    merged.insert("answer".to_string(), Value::String(cur.answer.clone()));
    for (i, option) in cur.opt.iter().enumerate() {
        if let Some(option) = option {
            merged.insert(format!("option_{}", i + 1), Value::String(option.clone()));
        }
    }
    if let Some(c) = cur.correct {
        merged.insert("correct_option".to_string(), Value::from(c));
    }
    if let Some(c) = cur.chapter_id {
        merged.insert("chapter_id".to_string(), Value::from(c));
    }
    for (k, v) in &f {
        merged.insert(k.clone(), v.clone());
    }
    if f.has("type") && !f.has("type_id") {
        merged.remove("type_id");
    }

    let t = resolve_type(conn, cur.subject_id, &merged)?;
    let chapter_id = resolve_chapter(conn, cur.subject_id, &merged)?;
    let mut image_id = cur.image_id;
    if up.is_none() && f.flag("remove_image") {
        image_id = None;
    }
    let mut n = normalize_question(&merged, &t, image_id.is_some() || up.is_some())?;
    n.chapter_id = chapter_id;

    let tx = conn.unchecked_transaction()?;
    if let Some((data, mime)) = &up {
        image_id = Some(save_file(&tx, data, mime, "image")?);
    }
    update_question(&tx, id, &n, image_id)?;
    purge_orphan_files(&tx)?;
    let q = find_question(&tx, id)?;
    tx.commit()?;
    to_json(&serialize_question(conn, &q, true))
}

fn create_type(conn: &Connection, p: &Fields) -> Result<Value> {
    let subject_id = id_arg(p, "subject_id", "subject id")?;
    assert_subject(conn, subject_id)?;
    let name = required(&p.str("name"), "name")?;
    let kind = p.str("kind").to_lowercase();
    if !QUESTION_KINDS.contains(&kind.as_str()) {
        return Err(http_err(
            400,
            format!("kind must be one of: {}", QUESTION_KINDS.join(", ")),
        ));
    }
    conn.execute(
        "INSERT INTO question_types (subject_id, name, kind) VALUES (?,?,?)",
        rusqlite::params![subject_id, name, kind],
    )?;
    let t = find_type(conn, conn.last_insert_rowid())?;
    to_json(&t)
}

fn update_type_op(conn: &Connection, p: &Fields) -> Result<Value> {
    let id = id_arg(p, "id", "id")?;
    let cur = find_type(conn, id)?;
    let name = if p.has("name") {
        required(&p.str("name"), "name")?
    } else {
        cur.name.clone()
    };
    let mut kind = cur.kind.clone();
    if p.has("kind") {
        kind = p.str("kind").to_lowercase();
        if !QUESTION_KINDS.contains(&kind.as_str()) {
            return Err(http_err(
                400,
                format!("kind must be one of: {}", QUESTION_KINDS.join(", ")),
            ));
        }
        if kind != cur.kind && cur.question_count > 0 {
            return Err(http_err(
                409,
                format!(
                    "Cannot change the kind of a type that has {} question(s)",
                    cur.question_count
                ),
            ));
        }
    }
    conn.execute(
        "UPDATE question_types SET name=?, kind=?, updated_at=CURRENT_TIMESTAMP WHERE id=?",
        rusqlite::params![name, kind, id],
    )?;
    to_json(&find_type(conn, id)?)
}

fn create_chapter(conn: &Connection, p: &Fields) -> Result<Value> {
    let subject_id = id_arg(p, "subject_id", "subject id")?;
    assert_subject(conn, subject_id)?;
    let name = required(&p.str("name"), "name")?;
    let position = match p.get("position") {
        Some(v) if !v.is_null() && !to_str(v).is_empty() => match p.int("position") {
            Some(pos) => pos,
            None => return Err(http_err(400, "position must be an integer")),
        },
        _ => next_chapter_position(conn, subject_id)?,
    };
    conn.execute(
        "INSERT INTO chapters (subject_id, name, position, description) VALUES (?,?,?,?)",
        rusqlite::params![subject_id, name, position, p.str("description")],
    )?;
    to_json(&find_chapter(conn, conn.last_insert_rowid())?)
}

fn update_chapter_op(conn: &Connection, p: &Fields) -> Result<Value> {
    let id = id_arg(p, "id", "id")?;
    let cur = find_chapter(conn, id)?;
    let name = if p.has("name") {
        required(&p.str("name"), "name")?
    } else {
        cur.name.clone()
    };
    let position = if p.has("position") {
        p.int("position")
            .ok_or_else(|| http_err(400, "position must be an integer"))?
    } else {
        cur.position
    };
    let description = if p.has("description") {
        p.str("description")
    } else {
        cur.description.clone()
    };
    conn.execute(
        "UPDATE chapters SET name=?, position=?, description=?, updated_at=CURRENT_TIMESTAMP WHERE id=?",
        rusqlite::params![name, position, description, id],
    )?;
    to_json(&find_chapter(conn, id)?)
}

fn import_op(conn: &mut Connection, p: &Fields) -> Result<Value> {
    let raw = p.str("data_base64");
    if raw.is_empty() {
        return Err(http_err(400, "Send the file as base64 in data_base64"));
    }
    let data = b64_decode(&raw)?;
    let filename = p.str("filename");
    let format = p.str("format");
    let mode = p.str("mode");
    let (mode, stats): (String, ImportStats) =
        transfer::import_data(conn, &data, &filename, &format, &mode)?;
    Ok(transfer::stats_value(&mode, &stats))
}

pub fn call(conn: &mut Connection, op: &str, payload: Value) -> Result<Value> {
    let p: Fields = match payload {
        Value::Null => Fields::new(),
        Value::Object(map) => map,
        _ => return Err(http_err(400, "Request payload must be an object")),
    };

    match op {
        "health" => Ok(json!({ "ok": true })),

        // ---- institute
        "institute.get" => to_json(&get_institute(conn)?),
        "institute.update" => to_json(&update_institute(conn, &p)?),
        "institute.upload_logo" => {
            let (data, mime) =
                require_image(p.get("logo"), "Upload the image in the \"logo\" form field")?;
            to_json(&upload_logo(conn, &data, &mime)?)
        }
        "institute.delete_logo" => to_json(&delete_logo(conn)?),

        // ---- classes
        "classes.list" => to_json(&list_classes(conn)?),
        "classes.get" => to_json(&find_class(conn, id_arg(&p, "id", "id")?)?),
        "classes.create" => to_json(&create_class(conn, &p)?),
        "classes.update" => to_json(&update_class(conn, id_arg(&p, "id", "id")?, &p)?),
        "classes.delete" => {
            delete_class(conn, id_arg(&p, "id", "id")?)?;
            Ok(Value::Null)
        }

        // ---- subjects
        "subjects.list" => {
            let class_id = id_arg(&p, "class_id", "class id")?;
            to_json(&list_subjects(conn, class_id)?)
        }
        "subjects.get" => to_json(&find_subject(conn, id_arg(&p, "id", "id")?)?),
        "subjects.create" => {
            let class_id = id_arg(&p, "class_id", "class id")?;
            to_json(&create_subject(conn, class_id, &p)?)
        }
        "subjects.update" => to_json(&update_subject(conn, id_arg(&p, "id", "id")?, &p)?),
        "subjects.delete" => {
            delete_subject(conn, id_arg(&p, "id", "id")?)?;
            Ok(Value::Null)
        }

        // ---- chapters
        "chapters.list" => {
            let subject_id = id_arg(&p, "subject_id", "subject id")?;
            assert_subject(conn, subject_id)?;
            let rows = crate::meta::query_chapters(
                conn,
                " WHERE ch.subject_id = ? ORDER BY ch.position, ch.id",
                vec![SqlValue::Integer(subject_id)],
            )?;
            to_json(&rows)
        }
        "chapters.get" => to_json(&find_chapter(conn, id_arg(&p, "id", "id")?)?),
        "chapters.create" => create_chapter(conn, &p),
        "chapters.update" => update_chapter_op(conn, &p),
        "chapters.delete" => {
            let id = id_arg(&p, "id", "id")?;
            find_chapter(conn, id)?;
            conn.execute("DELETE FROM chapters WHERE id=?", [id])?;
            Ok(Value::Null)
        }

        // ---- question types
        "types.list" => {
            let subject_id = id_arg(&p, "subject_id", "subject id")?;
            assert_subject(conn, subject_id)?;
            let rows = query_types(
                conn,
                " WHERE t.subject_id = ? ORDER BY t.id",
                vec![SqlValue::Integer(subject_id)],
            )?;
            to_json(&rows)
        }
        "types.create" => create_type(conn, &p),
        "types.update" => update_type_op(conn, &p),
        "types.delete" => {
            let id = id_arg(&p, "id", "id")?;
            let cur = find_type(conn, id)?;
            if cur.question_count > 0 {
                return Err(http_err(
                    409,
                    format!(
                        "{} question(s) use this type; delete them or change their type first",
                        cur.question_count
                    ),
                ));
            }
            conn.execute("DELETE FROM question_types WHERE id=?", [id])?;
            Ok(Value::Null)
        }

        // ---- questions
        "questions.list" => list_questions(conn, &p),
        "questions.get" => {
            let q = find_question(conn, id_arg(&p, "id", "id")?)?;
            to_json(&serialize_question(conn, &q, true))
        }
        "questions.create" => create_question(conn, &p),
        "questions.update" => update_question_op(conn, &p),
        "questions.delete" => {
            let id = id_arg(&p, "id", "id")?;
            find_question(conn, id)?;
            conn.execute("DELETE FROM questions WHERE id=?", [id])?;
            purge_orphan_files(conn)?;
            Ok(Value::Null)
        }

        // ---- generate & papers
        "generate" => {
            let paper: Paper = generate::generate(conn, &p)?;
            to_json(&paper)
        }
        "papers.list" => to_json(&generate::list_papers(conn)?),
        "papers.get" => generate::get_paper(conn, id_arg(&p, "id", "id")?),
        "papers.delete" => {
            generate::delete_paper(conn, id_arg(&p, "id", "id")?)?;
            Ok(Value::Null)
        }

        // ---- transfer
        "export" => {
            let include_files = !p
                .get("include_files")
                .map(|v| to_str(v) == "false")
                .unwrap_or(false);
            let file = transfer::export(conn, &p.str("format"), include_files)?;
            to_json(&file)
        }
        "import" => import_op(conn, &p),

        _ => Err(http_err(404, "Route not found")),
    }
}
