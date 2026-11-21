use rusqlite::types::Value as SqlValue;
use rusqlite::{params_from_iter, Connection, OptionalExtension};

use crate::error::{http_err, Result};
use crate::meta::seed_default_types;
use crate::models::{Class, Institute, Subject};
use crate::questions::{get_institute, purge_orphan_files, save_file};
use crate::util::{id_from, required, Fields, FieldsExt};

// ---- institute ------------------------------------------------------------------

pub fn update_institute(conn: &Connection, f: &Fields) -> Result<Institute> {
    let current = get_institute(conn)?;
    let name = if f.has("name") {
        f.str("name")
    } else {
        current.name
    };
    let location = if f.has("location") {
        f.str("location")
    } else {
        current.location
    };
    conn.execute(
        "UPDATE institute SET name=?, location=?, updated_at=CURRENT_TIMESTAMP WHERE id=1",
        rusqlite::params![name, location],
    )?;
    get_institute(conn)
}

pub fn upload_logo(conn: &Connection, data: &[u8], mime: &str) -> Result<Institute> {
    let tx = conn.unchecked_transaction()?;
    let id = save_file(&tx, data, mime, "logo")?;
    tx.execute(
        "UPDATE institute SET logo_file_id=?, updated_at=CURRENT_TIMESTAMP WHERE id=1",
        [id],
    )?;
    purge_orphan_files(&tx)?;
    tx.commit()?;
    get_institute(conn)
}

pub fn delete_logo(conn: &Connection) -> Result<Institute> {
    conn.execute(
        "UPDATE institute SET logo_file_id=NULL, updated_at=CURRENT_TIMESTAMP WHERE id=1",
        [],
    )?;
    purge_orphan_files(conn)?;
    get_institute(conn)
}

// ---- classes ----------------------------------------------------------------------

const CLASS_SELECT: &str = "SELECT c.id, c.name, c.description, c.created_at, c.updated_at,
    (SELECT COUNT(*) FROM subjects s WHERE s.class_id = c.id) FROM classes c";

pub fn query_classes(conn: &Connection, where_sql: &str) -> Result<Vec<Class>> {
    let mut stmt = conn.prepare(&format!("{CLASS_SELECT}{where_sql}"))?;
    let rows = stmt.query_map([], class_from_row)?;
    let mut out = Vec::new();
    for r in rows {
        out.push(r?);
    }
    Ok(out)
}

fn class_from_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<Class> {
    Ok(Class {
        id: row.get(0)?,
        name: row.get(1)?,
        description: row.get(2)?,
        created_at: row.get(3)?,
        updated_at: row.get(4)?,
        subject_count: row.get(5)?,
    })
}

pub fn find_class(conn: &Connection, id: i64) -> Result<Class> {
    let mut stmt = conn.prepare(&format!("{CLASS_SELECT} WHERE c.id = ?"))?;
    let found = stmt.query_row([id], class_from_row).optional()?;
    found.ok_or_else(|| http_err(404, "Class not found"))
}

pub fn list_classes(conn: &Connection) -> Result<Vec<Class>> {
    let mut cs = query_classes(conn, "")?;
    cs.sort_by_key(|c| c.id);
    Ok(cs)
}

pub fn create_class(conn: &Connection, f: &Fields) -> Result<Class> {
    let name = required(&f.str("name"), "name")?;
    conn.execute(
        "INSERT INTO classes (name, description) VALUES (?,?)",
        rusqlite::params![name, f.str("description")],
    )?;
    find_class(conn, conn.last_insert_rowid())
}

pub fn update_class(conn: &Connection, id: i64, f: &Fields) -> Result<Class> {
    let cur = find_class(conn, id)?;
    let name = if f.has("name") {
        required(&f.str("name"), "name")?
    } else {
        cur.name
    };
    let description = if f.has("description") {
        f.str("description")
    } else {
        cur.description
    };
    conn.execute(
        "UPDATE classes SET name=?, description=?, updated_at=CURRENT_TIMESTAMP WHERE id=?",
        rusqlite::params![name, description, id],
    )?;
    find_class(conn, id)
}

pub fn delete_class(conn: &Connection, id: i64) -> Result<()> {
    find_class(conn, id)?;
    conn.execute("DELETE FROM classes WHERE id=?", [id])?;
    purge_orphan_files(conn)?;
    Ok(())
}

// ---- subjects ---------------------------------------------------------------------

const SUBJECT_SELECT: &str = "SELECT s.id, s.class_id, s.name, s.code, s.created_at, s.updated_at,
    (SELECT COUNT(*) FROM questions q WHERE q.subject_id = s.id),
    (SELECT COUNT(*) FROM chapters ch WHERE ch.subject_id = s.id),
    (SELECT COUNT(*) FROM question_types t WHERE t.subject_id = s.id) FROM subjects s";

fn subject_from_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<Subject> {
    Ok(Subject {
        id: row.get(0)?,
        class_id: row.get(1)?,
        name: row.get(2)?,
        code: row.get(3)?,
        created_at: row.get(4)?,
        updated_at: row.get(5)?,
        question_count: row.get(6)?,
        chapter_count: row.get(7)?,
        type_count: row.get(8)?,
    })
}

pub fn query_subjects(
    conn: &Connection,
    where_sql: &str,
    args: Vec<SqlValue>,
) -> Result<Vec<Subject>> {
    let mut stmt = conn.prepare(&format!("{SUBJECT_SELECT}{where_sql}"))?;
    let rows = stmt.query_map(params_from_iter(args.iter()), subject_from_row)?;
    let mut out = Vec::new();
    for r in rows {
        out.push(r?);
    }
    Ok(out)
}

pub fn find_subject(conn: &Connection, id: i64) -> Result<Subject> {
    let mut ss = query_subjects(conn, " WHERE s.id = ?", vec![SqlValue::Integer(id)])?;
    if ss.is_empty() {
        return Err(http_err(404, "Subject not found"));
    }
    Ok(ss.remove(0))
}

pub fn assert_class(conn: &Connection, id: i64) -> Result<()> {
    let found: Option<i64> = conn
        .query_row("SELECT 1 FROM classes WHERE id=?", [id], |r| r.get(0))
        .optional()?;
    if found.is_none() {
        return Err(http_err(404, "Class not found"));
    }
    Ok(())
}

pub fn assert_subject(conn: &Connection, id: i64) -> Result<()> {
    let found: Option<i64> = conn
        .query_row("SELECT 1 FROM subjects WHERE id=?", [id], |r| r.get(0))
        .optional()?;
    if found.is_none() {
        return Err(http_err(404, "Subject not found"));
    }
    Ok(())
}

pub fn list_subjects(conn: &Connection, class_id: i64) -> Result<Vec<Subject>> {
    assert_class(conn, class_id)?;
    query_subjects(
        conn,
        " WHERE s.class_id = ? ORDER BY s.id",
        vec![SqlValue::Integer(class_id)],
    )
}

pub fn create_subject(conn: &Connection, class_id: i64, f: &Fields) -> Result<Subject> {
    assert_class(conn, class_id)?;
    let name = required(&f.str("name"), "name")?;
    let tx = conn.unchecked_transaction()?;
    tx.execute(
        "INSERT INTO subjects (class_id, name, code) VALUES (?,?,?)",
        rusqlite::params![class_id, name, f.str("code")],
    )?;
    let id = tx.last_insert_rowid();
    seed_default_types(&tx, id)?;
    tx.commit()?;
    find_subject(conn, id)
}

pub fn update_subject(conn: &Connection, id: i64, f: &Fields) -> Result<Subject> {
    let cur = find_subject(conn, id)?;
    let name = if f.has("name") {
        required(&f.str("name"), "name")?
    } else {
        cur.name
    };
    let code = if f.has("code") {
        f.str("code")
    } else {
        cur.code
    };
    let class_id = if let Some(v) = f.get("class_id") {
        id_from(v, "class_id")?
    } else {
        cur.class_id
    };
    assert_class(conn, class_id)?;
    conn.execute(
        "UPDATE subjects SET class_id=?, name=?, code=?, updated_at=CURRENT_TIMESTAMP WHERE id=?",
        rusqlite::params![class_id, name, code, id],
    )?;
    find_subject(conn, id)
}

pub fn delete_subject(conn: &Connection, id: i64) -> Result<()> {
    find_subject(conn, id)?;
    conn.execute("DELETE FROM subjects WHERE id=?", [id])?;
    purge_orphan_files(conn)?;
    Ok(())
}
