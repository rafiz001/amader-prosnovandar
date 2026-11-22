use rusqlite::{params, Connection, OptionalExtension};
use serde_json::Value;

use crate::error::{http_err, Result};
use crate::models::LayoutPresetOut;
use crate::util::required;

const PRESET_SELECT: &str = "SELECT id, name, data, created_at, updated_at FROM layout_presets";

fn row_to_preset(row: &rusqlite::Row<'_>) -> rusqlite::Result<LayoutPresetOut> {
    let data: String = row.get(2)?;
    Ok(LayoutPresetOut {
        id: row.get(0)?,
        name: row.get(1)?,
        layout: serde_json::from_str(&data).unwrap_or_else(|_| Value::Object(Default::default())),
        created_at: row.get(3)?,
        updated_at: row.get(4)?,
    })
}

pub fn list(conn: &Connection) -> Result<Vec<LayoutPresetOut>> {
    let mut stmt = conn.prepare(&format!(
        "{PRESET_SELECT} ORDER BY COALESCE(updated_at, created_at) DESC, id DESC"
    ))?;
    let rows = stmt.query_map([], row_to_preset)?;
    let mut out = Vec::new();
    for row in rows {
        out.push(row?);
    }
    Ok(out)
}

pub fn find(conn: &Connection, id: i64) -> Result<LayoutPresetOut> {
    let found = conn
        .query_row(&format!("{PRESET_SELECT} WHERE id=?"), [id], row_to_preset)
        .optional()?;
    found.ok_or_else(|| http_err(404, "Preset not found"))
}

pub fn save(conn: &Connection, name: &str, layout: &Value) -> Result<LayoutPresetOut> {
    let name = required(name, "name")?;
    if !layout.is_object() {
        return Err(http_err(400, "layout must be an object"));
    }
    let data = serde_json::to_string(layout)?;

    let existing: Option<i64> = conn
        .query_row("SELECT id FROM layout_presets WHERE name=?", [&name], |r| {
            r.get(0)
        })
        .optional()?;

    let id = match existing {
        Some(id) => {
            conn.execute(
                "UPDATE layout_presets SET name=?, data=?, updated_at=CURRENT_TIMESTAMP WHERE id=?",
                params![name, data, id],
            )?;
            id
        }
        None => {
            conn.execute(
                "INSERT INTO layout_presets (name, data, updated_at)
                 VALUES (?,?,CURRENT_TIMESTAMP)",
                params![name, data],
            )?;
            conn.last_insert_rowid()
        }
    };
    find(conn, id)
}

pub fn delete(conn: &Connection, id: i64) -> Result<()> {
    let changed = conn.execute("DELETE FROM layout_presets WHERE id=?", [id])?;
    if changed == 0 {
        return Err(http_err(404, "Preset not found"));
    }
    Ok(())
}
