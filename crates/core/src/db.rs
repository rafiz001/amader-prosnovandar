use std::collections::HashSet;
use std::time::Duration;

use rusqlite::{Connection, MAIN_DB};

use crate::error::{ApiError, Result};

const MIGRATIONS: &[(&str, &str)] = &[
    (
        "001_init.sql",
        include_str!("../../../migrations/001_init.sql"),
    ),
    (
        "002_chapters_types.sql",
        include_str!("../../../migrations/002_chapters_types.sql"),
    ),
    (
        "003_layout_presets.sql",
        include_str!("../../../migrations/003_layout_presets.sql"),
    ),
    (
        "004_question_style.sql",
        include_str!("../../../migrations/004_question_style.sql"),
    ),
    (
        "005_question_font_pt.sql",
        include_str!("../../../migrations/005_question_font_pt.sql"),
    ),
];

fn base_pragmas(conn: &Connection) -> Result<()> {
    conn.busy_timeout(Duration::from_secs(5))?;
    conn.pragma_update(None, "foreign_keys", "ON")?;
    Ok(())
}

#[cfg(not(target_family = "wasm"))]
pub fn open(path: &str) -> Result<Connection> {
    use std::path::Path;

    if let Some(parent) = Path::new(path).parent() {
        if !parent.as_os_str().is_empty() {
            std::fs::create_dir_all(parent).map_err(|e| {
                ApiError::new(500, format!("could not create the database folder: {e}"))
            })?;
        }
    }
    let conn =
        Connection::open(path).map_err(|e| ApiError::new(500, format!("open database: {e}")))?;
    base_pragmas(&conn)?;
    conn.pragma_update(None, "journal_mode", "WAL")?;
    Ok(conn)
}

pub fn open_in_memory() -> Result<Connection> {
    let conn = Connection::open_in_memory()?;
    base_pragmas(&conn)?;
    Ok(conn)
}

pub fn run_migrations(conn: &Connection) -> Result<Vec<String>> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS schema_migrations (
            name TEXT PRIMARY KEY,
            applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )",
    )?;

    let applied: HashSet<String> = {
        let mut stmt = conn.prepare("SELECT name FROM schema_migrations")?;
        let rows = stmt.query_map([], |row| row.get::<_, String>(0))?;
        rows.filter_map(|r| r.ok()).collect()
    };

    let mut ran = Vec::new();
    for (name, sql) in MIGRATIONS {
        if applied.contains(*name) {
            continue;
        }
        let tx = conn.unchecked_transaction()?;
        tx.execute_batch(sql)
            .map_err(|e| ApiError::new(500, format!("migration {name}: {e}")))?;
        tx.execute("INSERT INTO schema_migrations (name) VALUES (?)", [name])?;
        tx.commit()?;
        ran.push((*name).to_string());
    }
    Ok(ran)
}

/// Full, consistent database image (works identically on native and wasm).
pub fn serialize(conn: &mut Connection) -> Result<Vec<u8>> {
    let data = conn
        .serialize(MAIN_DB)
        .map_err(|e| ApiError::new(500, format!("could not export the database: {e}")))?;
    Ok(data.to_vec())
}

pub fn deserialize(conn: &mut Connection, bytes: &[u8]) -> Result<()> {
    if bytes.is_empty() {
        return Ok(());
    }

    // A snapshot taken from a WAL-mode database keeps the WAL flags in the
    // header (bytes 18 and 19). Loading it into a memory connection then tries
    // to open a WAL file and fails, so normalize the image to rollback journal.
    let needs_fix = bytes.len() >= 20
        && bytes.starts_with(b"SQLite format 3\0")
        && (bytes[18] != 1 || bytes[19] != 1);
    let owned;
    let data = if needs_fix {
        let mut copy = bytes.to_vec();
        copy[18] = 1;
        copy[19] = 1;
        owned = copy;
        owned.as_slice()
    } else {
        bytes
    };

    conn.deserialize_read_exact(MAIN_DB, data, data.len(), false)
        .map_err(|e| ApiError::new(422, format!("Could not read the SQLITE file: {e}")))
}
