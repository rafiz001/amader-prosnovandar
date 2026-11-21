use rusqlite::types::Value as SqlValue;
use rusqlite::{params_from_iter, Connection, OptionalExtension};

use crate::error::{http_err, Result};
use crate::models::{Chapter, QType};
use crate::questions::QUESTION_KINDS;
use crate::util::{contains, id_from, to_str, Fields, FieldsExt};

pub const DEFAULT_TYPES: [(&str, &str); 3] = [
    ("MCQ", "mcq"),
    ("True/False", "true_false"),
    ("Plain", "text"),
];

pub fn default_type_name(kind: &str) -> &'static str {
    match kind {
        "mcq" => "MCQ",
        "true_false" => "True/False",
        _ => "Plain",
    }
}

// ======================= question types (per subject) =======================

const TYPE_SELECT: &str = "SELECT t.id, t.subject_id, t.name, t.kind, t.created_at, t.updated_at,
    (SELECT COUNT(*) FROM questions q WHERE q.type_id = t.id) FROM question_types t";

pub fn query_types(conn: &Connection, where_sql: &str, args: Vec<SqlValue>) -> Result<Vec<QType>> {
    let mut stmt = conn.prepare(&format!("{TYPE_SELECT}{where_sql}"))?;
    let rows = stmt.query_map(params_from_iter(args.iter()), |row| {
        Ok(QType {
            id: row.get(0)?,
            subject_id: row.get(1)?,
            name: row.get(2)?,
            kind: row.get(3)?,
            created_at: row.get(4)?,
            updated_at: row.get(5)?,
            question_count: row.get(6)?,
        })
    })?;
    let mut out = Vec::new();
    for r in rows {
        out.push(r?);
    }
    Ok(out)
}

pub fn find_type(conn: &Connection, id: i64) -> Result<QType> {
    let mut ts = query_types(conn, " WHERE t.id = ?", vec![SqlValue::Integer(id)])?;
    if ts.is_empty() {
        return Err(http_err(404, "Question type not found"));
    }
    Ok(ts.remove(0))
}

pub fn seed_default_types(conn: &Connection, subject_id: i64) -> Result<()> {
    for (name, kind) in DEFAULT_TYPES {
        conn.execute(
            "INSERT INTO question_types (subject_id, name, kind) VALUES (?,?,?)",
            rusqlite::params![subject_id, name, kind],
        )?;
    }
    Ok(())
}

/// Finds a type by name (case-insensitive) or creates it.
pub fn ensure_type(
    conn: &Connection,
    subject_id: i64,
    name: &str,
    kind: &str,
) -> Result<(QType, bool)> {
    let ts = query_types(
        conn,
        " WHERE t.subject_id = ? AND t.name = ?",
        vec![
            SqlValue::Integer(subject_id),
            SqlValue::Text(name.to_string()),
        ],
    )?;
    if let Some(t) = ts.first() {
        if t.kind != kind {
            return Err(http_err(
                422,
                format!(
                    "question type \"{name}\" already exists with kind \"{}\" (not \"{kind}\")",
                    t.kind
                ),
            ));
        }
        return Ok((t.clone(), false));
    }
    conn.execute(
        "INSERT INTO question_types (subject_id, name, kind) VALUES (?,?,?)",
        rusqlite::params![subject_id, name, kind],
    )?;
    let id = conn.last_insert_rowid();
    Ok((find_type(conn, id)?, true))
}

/// Picks the question type from type_id, type name/kind, or the subject's first mcq type.
pub fn resolve_type(conn: &Connection, subject_id: i64, f: &Fields) -> Result<QType> {
    if let Some(v) = f.get("type_id") {
        if !v.is_null() && !to_str(v).is_empty() {
            let id = id_from(v, "type_id")?;
            let ts = query_types(
                conn,
                " WHERE t.id = ? AND t.subject_id = ?",
                vec![SqlValue::Integer(id), SqlValue::Integer(subject_id)],
            )?;
            return match ts.into_iter().next() {
                Some(t) => Ok(t),
                None => Err(http_err(
                    400,
                    format!("type_id {id} does not belong to this subject"),
                )),
            };
        }
    }
    let name = f.str("type");
    if !name.is_empty() {
        let ts = query_types(
            conn,
            " WHERE t.subject_id = ? AND t.name = ?",
            vec![SqlValue::Integer(subject_id), SqlValue::Text(name.clone())],
        )?;
        if let Some(t) = ts.into_iter().next() {
            return Ok(t);
        }
        let kind = name.to_lowercase();
        if contains(&QUESTION_KINDS, &kind) {
            let ts = query_types(
                conn,
                " WHERE t.subject_id = ? AND t.kind = ? ORDER BY t.id LIMIT 1",
                vec![SqlValue::Integer(subject_id), SqlValue::Text(kind)],
            )?;
            if let Some(t) = ts.into_iter().next() {
                return Ok(t);
            }
        }
        return Err(http_err(
            400,
            format!("Unknown question type \"{name}\" for this subject"),
        ));
    }
    let ts = query_types(
        conn,
        " WHERE t.subject_id = ? AND t.kind = 'mcq' ORDER BY t.id LIMIT 1",
        vec![SqlValue::Integer(subject_id)],
    )?;
    match ts.into_iter().next() {
        Some(t) => Ok(t),
        None => Err(http_err(400, "type_id is required")),
    }
}

// ============================ chapters (per subject) ============================

const CHAPTER_SELECT: &str = "SELECT ch.id, ch.subject_id, ch.name, ch.position, ch.description, ch.created_at, ch.updated_at,
    (SELECT COUNT(*) FROM questions q WHERE q.chapter_id = ch.id) FROM chapters ch";

pub fn query_chapters(
    conn: &Connection,
    where_sql: &str,
    args: Vec<SqlValue>,
) -> Result<Vec<Chapter>> {
    let mut stmt = conn.prepare(&format!("{CHAPTER_SELECT}{where_sql}"))?;
    let rows = stmt.query_map(params_from_iter(args.iter()), |row| {
        Ok(Chapter {
            id: row.get(0)?,
            subject_id: row.get(1)?,
            name: row.get(2)?,
            position: row.get(3)?,
            description: row.get(4)?,
            created_at: row.get(5)?,
            updated_at: row.get(6)?,
            question_count: row.get(7)?,
        })
    })?;
    let mut out = Vec::new();
    for r in rows {
        out.push(r?);
    }
    Ok(out)
}

pub fn find_chapter(conn: &Connection, id: i64) -> Result<Chapter> {
    let mut cs = query_chapters(conn, " WHERE ch.id = ?", vec![SqlValue::Integer(id)])?;
    if cs.is_empty() {
        return Err(http_err(404, "Chapter not found"));
    }
    Ok(cs.remove(0))
}

pub fn next_chapter_position(conn: &Connection, subject_id: i64) -> Result<i64> {
    let n: i64 = conn.query_row(
        "SELECT COALESCE(MAX(position), 0) + 1 FROM chapters WHERE subject_id = ?",
        [subject_id],
        |r| r.get(0),
    )?;
    Ok(n)
}

/// Finds a chapter by name or creates it (position 0 = append at the end).
pub fn ensure_chapter(
    conn: &Connection,
    subject_id: i64,
    name: &str,
    position: i64,
    description: &str,
) -> Result<(i64, bool)> {
    let found: Option<i64> = conn
        .query_row(
            "SELECT id FROM chapters WHERE subject_id=? AND name=?",
            rusqlite::params![subject_id, name],
            |r| r.get(0),
        )
        .optional()?;
    if let Some(id) = found {
        return Ok((id, false));
    }
    let position = if position == 0 {
        next_chapter_position(conn, subject_id)?
    } else {
        position
    };
    conn.execute(
        "INSERT INTO chapters (subject_id, name, position, description) VALUES (?,?,?,?)",
        rusqlite::params![subject_id, name, position, description],
    )?;
    Ok((conn.last_insert_rowid(), true))
}

/// Validates an optional chapter_id (null / "" = no chapter).
pub fn resolve_chapter(conn: &Connection, subject_id: i64, f: &Fields) -> Result<Option<i64>> {
    let Some(v) = f.get("chapter_id") else {
        return Ok(None);
    };
    if v.is_null() || to_str(v).is_empty() {
        return Ok(None);
    }
    let id = id_from(v, "chapter_id")?;
    let found: Option<i64> = conn
        .query_row(
            "SELECT 1 FROM chapters WHERE id=? AND subject_id=?",
            rusqlite::params![id, subject_id],
            |r| r.get(0),
        )
        .optional()?;
    if found.is_none() {
        return Err(http_err(
            400,
            format!("chapter_id {id} does not belong to this subject"),
        ));
    }
    Ok(Some(id))
}
