use std::collections::HashMap;

use rusqlite::types::Value as SqlValue;
use rusqlite::{params_from_iter, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use serde_json::{json, Map, Value};

use crate::db;
use crate::error::{http_err, ApiError, Result};
use crate::meta::{ensure_chapter, ensure_type, query_chapters, query_types, resolve_type};
use crate::models::ImportStats;
use crate::questions::{
    alias_description, insert_question, normalize_question, purge_orphan_files, query_questions,
    save_file, QUESTION_KINDS,
};
use crate::util::{
    any_list, b64_decode, b64_encode, contains, format_date_compact, id_from, now_ms,
    parse_id_list, placeholders, to_str, Fields, FieldsExt,
};

// ---- portable document ------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DocBackup {
    pub scope: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub class_name: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Doc {
    pub format: String,
    pub version: i64,
    pub exported_at: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub backup: Option<DocBackup>,
    pub institute: DocInstitute,
    pub classes: Vec<DocClass>,
    pub files: Vec<DocFile>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DocInstitute {
    pub name: String,
    pub location: String,
    pub logo: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DocClass {
    pub name: String,
    pub description: String,
    pub subjects: Vec<DocSubject>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DocSubject {
    pub name: String,
    pub code: String,
    pub chapters: Vec<DocChapter>,
    pub question_types: Vec<DocType>,
    pub questions: Vec<DocQuestion>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DocChapter {
    pub name: String,
    pub position: i64,
    pub description: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DocType {
    pub name: String,
    pub kind: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DocQuestion {
    #[serde(rename = "type")]
    pub type_name: String,
    pub chapter: Option<String>,
    pub text: String,
    pub math: String,
    pub image: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub options: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub correct_option: Option<i64>,
    pub answer: String,
    pub description: String,
    pub marks: f64,
    pub difficulty: String,
    pub lang: String,
    #[serde(default)]
    pub font_pt: f64,
    #[serde(default)]
    pub align: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DocFile {
    pub key: String,
    pub filename: String,
    pub mime: String,
    pub data_base64: String,
}

/// Which classes and which question dates a scoped backup should include.
#[derive(Debug, Clone, Default)]
pub struct BackupFilter {
    /// `None` = every class, `Some([])` = no classes.
    pub class_ids: Option<Vec<i64>>,
    pub date_from: Option<String>,
    pub date_to: Option<String>,
}

fn normalize_filter_date(f: &Fields, key: &str) -> Result<Option<String>> {
    let value = f.str(key);
    if value.is_empty() {
        return Ok(None);
    }
    let date: String = value.chars().take(10).collect();
    let bytes = date.as_bytes();
    let ok = bytes.len() == 10
        && bytes[4] == b'-'
        && bytes[7] == b'-'
        && bytes
            .iter()
            .enumerate()
            .all(|(i, b)| matches!(i, 4 | 7) || b.is_ascii_digit());
    if !ok {
        return Err(http_err(
            400,
            format!("{key} must be a date like 2026-11-26"),
        ));
    }
    Ok(Some(date))
}

/// Reads `all_classes` / `class_ids` / `class_id` and `date_from` / `date_to`.
pub fn backup_filter_from(f: &Fields) -> Result<BackupFilter> {
    let class_ids = if f.flag("all_classes") {
        None
    } else if let Some(v) = f.get("class_ids") {
        let values = any_list(Some(v));
        if values.is_empty() {
            None
        } else {
            Some(parse_id_list(&values, "class id", false)?.0)
        }
    } else if let Some(v) = f.get("class_id") {
        if v.is_null() || to_str(v).is_empty() {
            None
        } else {
            Some(vec![id_from(v, "class id")?])
        }
    } else {
        None
    };
    let date_from = normalize_filter_date(f, "date_from")?;
    let date_to = normalize_filter_date(f, "date_to")?;
    if let (Some(from), Some(to)) = (&date_from, &date_to) {
        if from > to {
            return Err(http_err(400, "date_from must be before date_to"));
        }
    }
    Ok(BackupFilter {
        class_ids,
        date_from,
        date_to,
    })
}

fn class_condition(filter: &BackupFilter, column: &str) -> (String, Vec<SqlValue>) {
    match &filter.class_ids {
        Some(ids) if ids.is_empty() => (" AND 1 = 0".to_string(), Vec::new()),
        Some(ids) => (
            format!(" AND {column} IN ({})", placeholders(ids.len())),
            ids.iter().map(|id| SqlValue::Integer(*id)).collect(),
        ),
        None => (String::new(), Vec::new()),
    }
}

fn date_condition(filter: &BackupFilter) -> (String, Vec<SqlValue>) {
    let mut parts: Vec<String> = Vec::new();
    let mut args: Vec<SqlValue> = Vec::new();
    if let Some(from) = &filter.date_from {
        parts.push("date(COALESCE(q.updated_at, q.created_at)) >= date(?)".to_string());
        args.push(SqlValue::Text(from.clone()));
    }
    if let Some(to) = &filter.date_to {
        parts.push("date(COALESCE(q.updated_at, q.created_at)) <= date(?)".to_string());
        args.push(SqlValue::Text(to.clone()));
    }
    if parts.is_empty() {
        (String::new(), args)
    } else {
        (format!(" AND {}", parts.join(" AND ")), args)
    }
}

/// Counts what a scoped backup would contain, so the UI can preview it.
pub fn preview_backup(conn: &Connection, filter: &BackupFilter) -> Result<Value> {
    let (class_sql, class_args) = class_condition(filter, "c.id");
    let (date_sql, date_args) = date_condition(filter);

    let class_count: i64 = conn.query_row(
        &format!("SELECT COUNT(*) FROM classes c WHERE 1 = 1{class_sql}"),
        params_from_iter(class_args.iter()),
        |r| r.get(0),
    )?;
    let subject_count: i64 = conn.query_row(
        &format!(
            "SELECT COUNT(*) FROM subjects s JOIN classes c ON c.id = s.class_id WHERE 1 = 1{class_sql}"
        ),
        params_from_iter(class_args.iter()),
        |r| r.get(0),
    )?;
    let mut question_args = class_args;
    question_args.extend(date_args);
    let question_count: i64 = conn.query_row(
        &format!(
            "SELECT COUNT(*) FROM questions q
             JOIN subjects s ON s.id = q.subject_id
             JOIN classes c ON c.id = s.class_id
             WHERE 1 = 1{class_sql}{date_sql}"
        ),
        params_from_iter(question_args.iter()),
        |r| r.get(0),
    )?;

    Ok(json!({
        "classes": class_count,
        "subjects": subject_count,
        "questions": question_count,
    }))
}

// ---- export -----------------------------------------------------------------

pub fn build_doc(conn: &Connection, include_files: bool) -> Result<Doc> {
    build_doc_scoped(conn, include_files, &BackupFilter::default(), false)
}

fn build_doc_scoped(
    conn: &Connection,
    include_files: bool,
    filter: &BackupFilter,
    class_backup: bool,
) -> Result<Doc> {
    let mut keys: HashMap<i64, String> = HashMap::new();
    let mut files: Vec<DocFile> = Vec::new();

    fn key_for(
        conn: &Connection,
        keys: &mut HashMap<i64, String>,
        files: &mut Vec<DocFile>,
        id: Option<i64>,
        include_files: bool,
    ) -> Result<Option<String>> {
        let Some(id) = id else {
            return Ok(None);
        };
        if !include_files {
            return Ok(None);
        }
        if let Some(k) = keys.get(&id) {
            return Ok(Some(k.clone()));
        }
        let row: Option<(String, String, Vec<u8>)> = conn
            .query_row(
                "SELECT filename, mime, data FROM files WHERE id=?",
                [id],
                |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)),
            )
            .optional()?;
        let Some((filename, mime, data)) = row else {
            return Ok(None);
        };
        let key = format!("file-{id}");
        keys.insert(id, key.clone());
        files.push(DocFile {
            key: key.clone(),
            filename,
            mime,
            data_base64: b64_encode(&data),
        });
        Ok(Some(key))
    }

    let inst: Option<(String, String, Option<i64>)> = conn
        .query_row(
            "SELECT name, location, logo_file_id FROM institute WHERE id=1",
            [],
            |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)),
        )
        .optional()
        .ok()
        .flatten();
    let (institute, logo_id) = match inst {
        Some((name, location, logo)) => (
            DocInstitute {
                name,
                location,
                logo: None,
            },
            logo,
        ),
        None => (
            DocInstitute {
                name: String::new(),
                location: String::new(),
                logo: None,
            },
            None,
        ),
    };
    let institute = if class_backup {
        DocInstitute {
            name: String::new(),
            location: String::new(),
            logo: None,
        }
    } else {
        let mut institute = institute;
        institute.logo = key_for(conn, &mut keys, &mut files, logo_id, include_files)?;
        institute
    };

    let mut doc = Doc {
        format: "question-bank".to_string(),
        version: 2,
        exported_at: crate::util::format_iso_ms(now_ms()),
        backup: Some(DocBackup {
            scope: if class_backup { "class" } else { "full" }.to_string(),
            class_name: None,
        }),
        institute,
        classes: Vec::new(),
        files: Vec::new(),
    };

    let classes: Vec<(i64, String, String)> = match &filter.class_ids {
        Some(ids) if ids.is_empty() => Vec::new(),
        Some(ids) => {
            let tail = format!(" WHERE id IN ({}) ORDER BY id", placeholders(ids.len()));
            let mut stmt =
                conn.prepare(&format!("SELECT id, name, description FROM classes{tail}"))?;
            let args: Vec<SqlValue> = ids.iter().map(|id| SqlValue::Integer(*id)).collect();
            let rows = stmt.query_map(params_from_iter(args.iter()), |r| {
                Ok((r.get(0)?, r.get(1)?, r.get(2)?))
            })?;
            rows.collect::<rusqlite::Result<Vec<_>>>()?
        }
        None => {
            let mut stmt = conn.prepare("SELECT id, name, description FROM classes ORDER BY id")?;
            let rows = stmt.query_map([], |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)))?;
            rows.collect::<rusqlite::Result<Vec<_>>>()?
        }
    };

    for (class_id, class_name, class_desc) in classes {
        let mut dc = DocClass {
            name: class_name,
            description: class_desc,
            subjects: Vec::new(),
        };
        let mut stmt =
            conn.prepare("SELECT id, name, code FROM subjects WHERE class_id=? ORDER BY id")?;
        let subjects: Vec<(i64, String, String)> = {
            let rows = stmt.query_map([class_id], |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)))?;
            rows.collect::<rusqlite::Result<Vec<_>>>()?
        };
        for (subject_id, subject_name, subject_code) in subjects {
            let mut ds = DocSubject {
                name: subject_name,
                code: subject_code,
                chapters: Vec::new(),
                question_types: Vec::new(),
                questions: Vec::new(),
            };
            for ch in query_chapters(
                conn,
                " WHERE ch.subject_id = ? ORDER BY ch.position, ch.id",
                vec![SqlValue::Integer(subject_id)],
            )? {
                ds.chapters.push(DocChapter {
                    name: ch.name,
                    position: ch.position,
                    description: ch.description,
                });
            }
            for t in query_types(
                conn,
                " WHERE t.subject_id = ? ORDER BY t.id",
                vec![SqlValue::Integer(subject_id)],
            )? {
                ds.question_types.push(DocType {
                    name: t.name,
                    kind: t.kind,
                });
            }
            let mut question_where = vec!["q.subject_id = ?".to_string()];
            let mut question_args: Vec<SqlValue> = vec![SqlValue::Integer(subject_id)];
            if let Some(from) = &filter.date_from {
                question_where
                    .push("date(COALESCE(q.updated_at, q.created_at)) >= date(?)".to_string());
                question_args.push(SqlValue::Text(from.clone()));
            }
            if let Some(to) = &filter.date_to {
                question_where
                    .push("date(COALESCE(q.updated_at, q.created_at)) <= date(?)".to_string());
                question_args.push(SqlValue::Text(to.clone()));
            }
            let question_tail = format!(" WHERE {} ORDER BY q.id", question_where.join(" AND "));
            for q in query_questions(conn, false, &question_tail, question_args)? {
                let image = key_for(conn, &mut keys, &mut files, q.image_id, include_files)?;
                let mut dq = DocQuestion {
                    type_name: q.type_name.clone(),
                    chapter: q.chapter_name.clone(),
                    text: q.text.clone(),
                    math: q.math.clone(),
                    image,
                    options: None,
                    correct_option: None,
                    answer: q.answer.clone(),
                    description: q.description.clone(),
                    marks: q.marks,
                    difficulty: q.difficulty.clone(),
                    lang: q.lang.clone(),
                    font_pt: q.font_pt,
                    align: q.align.clone(),
                };
                if q.kind == "mcq" {
                    dq.options = Some(vec![
                        q.opt[0].clone().unwrap_or_default(),
                        q.opt[1].clone().unwrap_or_default(),
                        q.opt[2].clone().unwrap_or_default(),
                        q.opt[3].clone().unwrap_or_default(),
                    ]);
                    dq.correct_option = Some(q.correct.unwrap_or(0));
                }
                ds.questions.push(dq);
            }
            dc.subjects.push(ds);
        }
        doc.classes.push(dc);
    }

    if class_backup {
        let class_name = if doc.classes.len() == 1 {
            doc.classes.first().map(|c| c.name.clone())
        } else {
            None
        };
        if let Some(backup) = doc.backup.as_mut() {
            backup.class_name = class_name;
        }
    }
    doc.files = files;
    Ok(doc)
}

#[derive(Debug, Clone, Serialize)]
pub struct ExportFile {
    pub filename: String,
    pub mime: String,
    pub data_base64: String,
}

pub fn export(conn: &mut Connection, format: &str, include_files: bool) -> Result<ExportFile> {
    let format = if format.is_empty() {
        "json".to_string()
    } else {
        format.to_lowercase()
    };
    let stamp = format_date_compact(now_ms());
    match format.as_str() {
        "json" => {
            let doc = build_doc(conn, include_files)?;
            let bytes = serde_json::to_vec_pretty(&doc)?;
            Ok(ExportFile {
                filename: format!("question-bank-{stamp}.json"),
                mime: "application/json; charset=utf-8".to_string(),
                data_base64: b64_encode(&bytes),
            })
        }
        "yml" | "yaml" => {
            let doc = build_doc(conn, include_files)?;
            let text = serde_yaml::to_string(&doc)
                .map_err(|e| ApiError::new(500, format!("could not build YAML: {e}")))?;
            Ok(ExportFile {
                filename: format!("question-bank-{stamp}.yml"),
                mime: "application/x-yaml; charset=utf-8".to_string(),
                data_base64: b64_encode(text.as_bytes()),
            })
        }
        "sqlite" => {
            let bytes = db::serialize(conn)?;
            Ok(ExportFile {
                filename: format!("question-bank-{stamp}.sqlite"),
                mime: "application/vnd.sqlite3".to_string(),
                data_base64: b64_encode(&bytes),
            })
        }
        _ => Err(http_err(400, "format must be json, yml or sqlite")),
    }
}

fn file_slug(name: &str) -> String {
    let slug: String = name
        .chars()
        .map(|c| if c.is_alphanumeric() { c } else { '-' })
        .collect();
    let slug = slug.trim_matches('-');
    if slug.is_empty() {
        "class".to_string()
    } else {
        slug.to_string()
    }
}

fn backup_stamp(ms: i64) -> String {
    crate::util::format_iso_ms(ms)
        .chars()
        .filter(|c| c.is_ascii_digit())
        .take(14)
        .collect()
}

pub fn export_backup(
    conn: &mut Connection,
    scope: &str,
    filter: &BackupFilter,
    include_files: bool,
) -> Result<ExportFile> {
    let stamp = backup_stamp(now_ms());
    match scope {
        "full" => {
            let bytes = db::serialize(conn)?;
            Ok(ExportFile {
                filename: format!("question-bank-full-{stamp}.sqlite"),
                mime: "application/vnd.sqlite3".to_string(),
                data_base64: b64_encode(&bytes),
            })
        }
        "class" => {
            let doc = build_doc_scoped(conn, include_files, filter, true)?;
            let bytes = serde_json::to_vec_pretty(&doc)?;
            let name = if doc.classes.len() == 1 {
                doc.classes
                    .first()
                    .map(|c| c.name.as_str())
                    .unwrap_or("class")
            } else if doc.classes.is_empty() {
                "empty"
            } else {
                "all-classes"
            };
            Ok(ExportFile {
                filename: format!("question-bank-class-{}-{stamp}.json", file_slug(name)),
                mime: "application/json; charset=utf-8".to_string(),
                data_base64: b64_encode(&bytes),
            })
        }
        _ => Err(http_err(400, "scope must be \"full\" or \"class\"")),
    }
}

// ---- import -----------------------------------------------------------------

fn strip_bom(data: &[u8]) -> &[u8] {
    data.strip_prefix(&[0xEF, 0xBB, 0xBF]).unwrap_or(data)
}

fn table_set(conn: &Connection) -> Result<HashMap<String, bool>> {
    let mut stmt = conn.prepare("SELECT name FROM sqlite_master WHERE type='table'")?;
    let rows = stmt.query_map([], |r| r.get::<_, String>(0))?;
    let mut tables = HashMap::new();
    for r in rows {
        tables.insert(r?, true);
    }
    Ok(tables)
}

fn doc_from_sqlite(data: &[u8]) -> Result<Fields> {
    let mut src = db::open_in_memory()?;
    db::deserialize(&mut src, data)?;

    let mut tables = table_set(&src)?;
    for t in ["classes", "subjects", "questions"] {
        if !tables.get(t).copied().unwrap_or(false) {
            return Err(http_err(422, format!("SQLite file has no \"{t}\" table")));
        }
    }
    if tables.get("schema_migrations").copied().unwrap_or(false) {
        db::run_migrations(&src)
            .map_err(|e| http_err(422, format!("Could not upgrade the SQLite file: {e}")))?;
        tables = table_set(&src)?;
    }
    if !tables.get("question_types").copied().unwrap_or(false)
        || !tables.get("chapters").copied().unwrap_or(false)
    {
        return Err(http_err(
            422,
            "Unsupported SQLite schema (not a question-bank export)",
        ));
    }
    let doc = build_doc(&src, true)?;
    let value = serde_json::to_value(&doc)?;
    Ok(value.as_object().cloned().unwrap_or_default())
}

fn detect_format(data: &[u8], filename: &str, hint: &str) -> Result<String> {
    match hint.to_lowercase().as_str() {
        "" => {}
        "yaml" | "yml" => return Ok("yml".to_string()),
        "json" => return Ok("json".to_string()),
        "sqlite" => return Ok("sqlite".to_string()),
        _ => return Err(http_err(400, "format must be json, yml or sqlite")),
    }
    if data.starts_with(b"SQLite format 3") {
        return Ok("sqlite".to_string());
    }
    let ext = std::path::Path::new(filename)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();
    if ext == "yml" || ext == "yaml" {
        return Ok("yml".to_string());
    }
    if ext == "json" {
        return Ok("json".to_string());
    }
    if String::from_utf8_lossy(data).trim_start().starts_with('{') {
        return Ok("json".to_string());
    }
    Ok("yml".to_string())
}

fn wrap_path(path: &str, err: ApiError) -> ApiError {
    ApiError::new(422, format!("{path}: {}", err.message))
}

fn file_for(
    tx: &Connection,
    file_defs: &HashMap<String, Fields>,
    file_ids: &mut HashMap<String, i64>,
    key: &str,
    where_: &str,
    kind: &str,
) -> Result<Option<i64>> {
    if key.is_empty() {
        return Ok(None);
    }
    if let Some(id) = file_ids.get(key) {
        return Ok(Some(*id));
    }
    let Some(def) = file_defs.get(key) else {
        return Err(http_err(
            422,
            format!("{where_}: unknown file key \"{key}\""),
        ));
    };
    let raw = to_str(def.get("data_base64").unwrap_or(&Value::Null));
    let data = b64_decode(&raw)
        .map_err(|_| http_err(422, format!("{where_}: invalid or empty image data")))?;
    if data.is_empty() {
        return Err(http_err(
            422,
            format!("{where_}: invalid or empty image data"),
        ));
    }
    let mime = infer::get(&data)
        .map(|t| t.mime_type().to_string())
        .unwrap_or_default();
    if crate::util::allowed_image(&mime).is_none() {
        return Err(http_err(422, format!("{where_}: unsupported image type")));
    }
    let id = save_file(tx, &data, &mime, kind)?;
    file_ids.insert(key.to_string(), id);
    Ok(Some(id))
}

fn type_for_import(
    tx: &Connection,
    subject_id: i64,
    name: &str,
    stats: &mut ImportStats,
) -> Result<crate::models::QType> {
    let probe = {
        let mut f = Fields::new();
        f.insert("type".to_string(), Value::String(name.to_string()));
        f
    };
    if let Ok(t) = resolve_type(tx, subject_id, &probe) {
        return Ok(t);
    }
    let kind = name.to_lowercase();
    if contains(&QUESTION_KINDS, &kind) {
        let (t, created) =
            ensure_type(tx, subject_id, crate::meta::default_type_name(&kind), &kind)?;
        if created {
            stats.question_types_created += 1;
        }
        return Ok(t);
    }
    Err(http_err(
        422,
        format!("unknown question type \"{name}\" (declare it in the subject's question_types)"),
    ))
}

pub fn import_document(conn: &Connection, doc: &Fields, mode: &str) -> Result<ImportStats> {
    let mut stats = ImportStats::default();
    if mode != "merge" && mode != "replace" {
        return Err(http_err(400, "mode must be \"merge\" or \"replace\""));
    }
    let Some(classes) = doc.get("classes").and_then(|v| v.as_array()) else {
        return Err(http_err(
            422,
            "Invalid document: a \"classes\" array is required",
        ));
    };

    let mut file_defs: HashMap<String, Fields> = HashMap::new();
    for fv in doc
        .get("files")
        .and_then(|v| v.as_array())
        .cloned()
        .unwrap_or_default()
    {
        if let Some(fm) = fv.as_object() {
            file_defs.insert(fm.str("key"), fm.clone());
        }
    }
    let mut file_ids: HashMap<String, i64> = HashMap::new();

    let tx = conn.unchecked_transaction()?;

    if mode == "replace" {
        tx.execute("DELETE FROM classes", [])?;
        tx.execute(
            "UPDATE institute SET name='', location='', logo_file_id=NULL WHERE id=1",
            [],
        )?;
    }

    if let Some(inst) = doc.map("institute") {
        let logo = file_for(
            &tx,
            &file_defs,
            &mut file_ids,
            &inst.str("logo"),
            "institute.logo",
            "logo",
        )?;
        tx.execute(
            "UPDATE institute SET name=COALESCE(NULLIF(?,''),name), location=COALESCE(NULLIF(?,''),location),
            logo_file_id=COALESCE(?,logo_file_id), updated_at=CURRENT_TIMESTAMP WHERE id=1",
            rusqlite::params![inst.str("name"), inst.str("location"), logo],
        )?;
    }

    for (ci, cv) in classes.iter().enumerate() {
        let c_path = format!("classes[{ci}]");
        let c = cv.as_object().cloned().unwrap_or_default();
        let c_name = c.str("name");
        if c_name.is_empty() {
            return Err(http_err(422, format!("{c_path}: name is required")));
        }
        let class_id: i64 = {
            let found: Option<i64> = tx
                .query_row("SELECT id FROM classes WHERE name=?", [&c_name], |r| {
                    r.get(0)
                })
                .optional()?;
            match found {
                Some(id) => id,
                None => {
                    tx.execute(
                        "INSERT INTO classes (name, description) VALUES (?,?)",
                        rusqlite::params![c_name, c.str("description")],
                    )?;
                    stats.classes_created += 1;
                    tx.last_insert_rowid()
                }
            }
        };

        for (si, sv) in c.list("subjects").iter().enumerate() {
            let s_path = format!("{c_path}.subjects[{si}]");
            let s = sv.as_object().cloned().unwrap_or_default();
            let s_name = s.str("name");
            if s_name.is_empty() {
                return Err(http_err(422, format!("{s_path}: name is required")));
            }
            let subject_id: i64 = {
                let found: Option<i64> = tx
                    .query_row(
                        "SELECT id FROM subjects WHERE class_id=? AND name=?",
                        rusqlite::params![class_id, s_name],
                        |r| r.get(0),
                    )
                    .optional()?;
                match found {
                    Some(id) => id,
                    None => {
                        tx.execute(
                            "INSERT INTO subjects (class_id, name, code) VALUES (?,?,?)",
                            rusqlite::params![class_id, s_name, s.str("code")],
                        )?;
                        stats.subjects_created += 1;
                        tx.last_insert_rowid()
                    }
                }
            };

            for (ti, tv) in s.list("question_types").iter().enumerate() {
                let t_path = format!("{s_path}.question_types[{ti}]");
                let t = tv.as_object().cloned().unwrap_or_default();
                let name = t.str("name");
                let kind = t.str("kind").to_lowercase();
                if name.is_empty() || !contains(&QUESTION_KINDS, &kind) {
                    return Err(http_err(
                        422,
                        format!(
                            "{t_path}: name and a kind ({}) are required",
                            QUESTION_KINDS.join(", ")
                        ),
                    ));
                }
                match ensure_type(&tx, subject_id, &name, &kind) {
                    Ok((_, created)) => {
                        if created {
                            stats.question_types_created += 1;
                        }
                    }
                    Err(e) => {
                        return Err(http_err(422, format!("{t_path}: {}", e.message)));
                    }
                }
            }

            for (hi, hv) in s.list("chapters").iter().enumerate() {
                let h_path = format!("{s_path}.chapters[{hi}]");
                let h = hv.as_object().cloned().unwrap_or_default();
                let name = h.str("name");
                if name.is_empty() {
                    return Err(http_err(422, format!("{h_path}: name is required")));
                }
                let pos = h.int("position").unwrap_or(0);
                let (_, created) =
                    ensure_chapter(&tx, subject_id, &name, pos, &h.str("description"))?;
                if created {
                    stats.chapters_created += 1;
                }
            }

            for (qi, qv) in s.list("questions").iter().enumerate() {
                let q_path = format!("{s_path}.questions[{qi}]");
                let mut q = qv.as_object().cloned().unwrap_or_default();
                alias_description(&mut q);

                let mut type_name = q.str("type");
                if type_name.is_empty() {
                    type_name = "mcq".to_string();
                }
                let t = type_for_import(&tx, subject_id, &type_name, &mut stats)
                    .map_err(|e| wrap_path(&q_path, e))?;

                let mut chapter_id = None;
                let chapter_name = q.str("chapter");
                if !chapter_name.is_empty() {
                    let (id, created) = ensure_chapter(&tx, subject_id, &chapter_name, 0, "")?;
                    if created {
                        stats.chapters_created += 1;
                    }
                    chapter_id = Some(id);
                }

                let image_id = file_for(
                    &tx,
                    &file_defs,
                    &mut file_ids,
                    &q.str("image"),
                    &q_path,
                    "image",
                )?;

                let mut n = normalize_question(&q, &t, image_id.is_some())
                    .map_err(|e| wrap_path(&q_path, e))?;
                n.chapter_id = chapter_id;

                let option = |i: usize| -> SqlValue {
                    if n.kind == "mcq" {
                        SqlValue::Text(n.options[i].clone())
                    } else {
                        SqlValue::Null
                    }
                };
                let correct = match (n.kind.as_str(), n.correct) {
                    ("mcq", Some(c)) => SqlValue::Integer(c),
                    _ => SqlValue::Null,
                };
                let dup_args = [
                    SqlValue::Integer(subject_id),
                    SqlValue::Integer(n.type_id),
                    SqlValue::Text(n.text.clone()),
                    SqlValue::Text(n.math.clone()),
                    option(0),
                    option(1),
                    option(2),
                    option(3),
                    correct,
                    SqlValue::Text(n.answer.clone()),
                ];
                let dup: Option<i64> = tx
                    .query_row(
                        "SELECT 1 FROM questions WHERE subject_id=? AND type_id=? AND text=? AND math=?
                        AND option_1 IS ? AND option_2 IS ? AND option_3 IS ? AND option_4 IS ? AND correct_option IS ? AND answer=?",
                        params_from_iter(dup_args.iter()),
                        |r| r.get(0),
                    )
                    .optional()?;
                if dup.is_some() {
                    stats.questions_skipped_duplicate += 1;
                    continue;
                }
                insert_question(&tx, subject_id, &n, image_id)?;
                stats.questions_added += 1;
            }
        }
    }

    purge_orphan_files(&tx)?;
    tx.commit()?;
    Ok(stats)
}

fn parse_doc(data: &[u8], format: &str) -> Result<Fields> {
    match format {
        "json" => {
            let value: Value = serde_json::from_slice(strip_bom(data))
                .map_err(|e| http_err(422, format!("Could not read the JSON file: {e}")))?;
            value
                .as_object()
                .cloned()
                .ok_or_else(|| http_err(422, "Invalid document: expected a JSON object"))
        }
        "yml" => {
            let value: serde_yaml::Value = serde_yaml::from_slice(strip_bom(data))
                .map_err(|e| http_err(422, format!("Could not read the YML file: {e}")))?;
            let json = serde_json::to_value(value)
                .map_err(|e| http_err(422, format!("Could not read the YML file: {e}")))?;
            json.as_object().cloned().ok_or_else(|| {
                http_err(
                    422,
                    "Could not read the YML file: the document root must be a mapping",
                )
            })
        }
        _ => Err(http_err(400, "document format must be json or yml")),
    }
}

pub fn import_data(
    conn: &mut Connection,
    data: &[u8],
    filename: &str,
    hint: &str,
    mode: &str,
) -> Result<(String, ImportStats)> {
    let mode = if mode.is_empty() {
        "merge".to_string()
    } else {
        mode.to_lowercase()
    };
    let format = detect_format(data, filename, hint)?;
    let doc = if format == "sqlite" {
        doc_from_sqlite(data)?
    } else {
        parse_doc(data, &format)?
    };

    let stats = import_document(conn, &doc, &mode)?;
    Ok((mode, stats))
}

pub fn stats_value(mode: &str, stats: &ImportStats) -> Value {
    let mut map = Map::new();
    map.insert("mode".to_string(), Value::String(mode.to_string()));
    map.insert(
        "classes_created".to_string(),
        Value::from(stats.classes_created),
    );
    map.insert(
        "subjects_created".to_string(),
        Value::from(stats.subjects_created),
    );
    map.insert(
        "chapters_created".to_string(),
        Value::from(stats.chapters_created),
    );
    map.insert(
        "question_types_created".to_string(),
        Value::from(stats.question_types_created),
    );
    map.insert(
        "questions_added".to_string(),
        Value::from(stats.questions_added),
    );
    map.insert(
        "questions_skipped_duplicate".to_string(),
        Value::from(stats.questions_skipped_duplicate),
    );
    Value::Object(map)
}

// ---- backup & restore -------------------------------------------------------

const RESTORE_DELETE_ORDER: [&str; 9] = [
    "questions",
    "chapters",
    "question_types",
    "subjects",
    "classes",
    "papers",
    "layout_presets",
    "institute",
    "files",
];

const RESTORE_INSERT_ORDER: [&str; 9] = [
    "files",
    "institute",
    "classes",
    "subjects",
    "chapters",
    "question_types",
    "questions",
    "papers",
    "layout_presets",
];

fn table_columns(conn: &Connection, table: &str) -> Result<Vec<String>> {
    let mut stmt = conn.prepare(&format!("PRAGMA table_info(\"{table}\")"))?;
    let rows = stmt.query_map([], |r| r.get::<_, String>(1))?;
    let mut columns = Vec::new();
    for row in rows {
        columns.push(row?);
    }
    Ok(columns)
}

fn copy_table(dst: &Connection, src: &Connection, table: &str) -> Result<()> {
    let dst_columns = table_columns(dst, table)?;
    let src_columns = table_columns(src, table)?;
    let columns: Vec<String> = dst_columns
        .into_iter()
        .filter(|c| src_columns.contains(c))
        .collect();
    if columns.is_empty() {
        return Err(http_err(
            422,
            format!("Not a question-bank backup: SQLite file has no usable \"{table}\" columns"),
        ));
    }
    let column_list = columns.join(", ");
    let mut insert = dst.prepare(&format!(
        "INSERT INTO \"{table}\" ({column_list}) VALUES ({})",
        placeholders(columns.len())
    ))?;
    let mut stmt = src.prepare(&format!("SELECT {column_list} FROM \"{table}\""))?;
    let mut rows = stmt.query([])?;
    while let Some(row) = rows.next()? {
        let values = (0..columns.len())
            .map(|i| row.get::<_, SqlValue>(i))
            .collect::<rusqlite::Result<Vec<_>>>()?;
        insert.execute(params_from_iter(values.iter()))?;
    }
    Ok(())
}

/// Replaces the live database with a full SQLite backup image. Rows are copied
/// table by table so the connection keeps using the real database file.
pub fn restore_full(conn: &mut Connection, data: &[u8]) -> Result<()> {
    let mut src = db::open_in_memory()
        .map_err(|e| ApiError::new(500, format!("restore: scratch database: {}", e.message)))?;
    db::deserialize(&mut src, data)
        .map_err(|e| ApiError::new(422, format!("restore: read backup: {}", e.message)))?;

    let mut tables = table_set(&src)
        .map_err(|e| ApiError::new(500, format!("restore: inspect backup: {}", e.message)))?;
    for table in ["classes", "subjects", "questions"] {
        if !tables.get(table).copied().unwrap_or(false) {
            return Err(http_err(
                422,
                format!("Not a question-bank backup: SQLite file has no \"{table}\" table"),
            ));
        }
    }
    if tables.get("schema_migrations").copied().unwrap_or(false) {
        db::run_migrations(&src)
            .map_err(|e| http_err(422, format!("Could not upgrade the SQLite backup: {e}")))?;
        tables = table_set(&src)
            .map_err(|e| ApiError::new(500, format!("restore: inspect backup: {}", e.message)))?;
    }
    for table in RESTORE_INSERT_ORDER {
        if !tables.get(table).copied().unwrap_or(false) {
            return Err(http_err(
                422,
                format!("Not a question-bank backup: SQLite file has no \"{table}\" table"),
            ));
        }
    }
    let institute_rows: i64 = src.query_row("SELECT COUNT(*) FROM institute", [], |r| r.get(0))?;
    if institute_rows != 1 {
        return Err(http_err(
            422,
            "Not a question-bank backup: invalid institute row",
        ));
    }

    let tx = conn
        .unchecked_transaction()
        .map_err(|e| ApiError::new(500, format!("restore: begin transaction: {e}")))?;
    for table in RESTORE_DELETE_ORDER {
        tx.execute(&format!("DELETE FROM \"{table}\""), [])
            .map_err(|e| ApiError::new(500, format!("restore: clear {table}: {e}")))?;
    }
    for table in RESTORE_INSERT_ORDER {
        copy_table(&tx, &src, table)
            .map_err(|e| ApiError::new(500, format!("restore: copy {table}: {}", e.message)))?;
    }
    tx.commit()
        .map_err(|e| ApiError::new(500, format!("restore: commit: {e}")))?;
    Ok(())
}

fn count_table(conn: &Connection, table: &str) -> Result<i64> {
    conn.query_row(&format!("SELECT COUNT(*) FROM \"{table}\""), [], |r| {
        r.get(0)
    })
    .map_err(ApiError::from)
}

fn restore_value(conn: &Connection, scope: &str, mode: &str, stats: &ImportStats) -> Result<Value> {
    let mut map = Map::new();
    map.insert("scope".to_string(), Value::String(scope.to_string()));
    map.insert("mode".to_string(), Value::String(mode.to_string()));
    map.insert(
        "classes".to_string(),
        Value::from(count_table(conn, "classes")?),
    );
    map.insert(
        "subjects".to_string(),
        Value::from(count_table(conn, "subjects")?),
    );
    map.insert(
        "questions".to_string(),
        Value::from(count_table(conn, "questions")?),
    );
    map.insert(
        "papers".to_string(),
        Value::from(count_table(conn, "papers")?),
    );
    map.insert(
        "classes_created".to_string(),
        Value::from(stats.classes_created),
    );
    map.insert(
        "subjects_created".to_string(),
        Value::from(stats.subjects_created),
    );
    map.insert(
        "questions_added".to_string(),
        Value::from(stats.questions_added),
    );
    map.insert(
        "questions_skipped_duplicate".to_string(),
        Value::from(stats.questions_skipped_duplicate),
    );
    Ok(Value::Object(map))
}

pub fn restore(
    conn: &mut Connection,
    data: &[u8],
    filename: &str,
    hint: &str,
    mode: &str,
) -> Result<Value> {
    let format = detect_format(data, filename, hint)?;
    if format == "sqlite" {
        restore_full(conn, data)?;
        return restore_value(conn, "full", "replace", &ImportStats::default());
    }

    let mut doc = parse_doc(data, &format)?;
    let scope = doc
        .get("backup")
        .and_then(|v| v.as_object())
        .map(|backup| backup.str("scope"))
        .filter(|scope| scope == "class" || scope == "full")
        .unwrap_or_else(|| "full".to_string());
    // A class backup must not replace the local institution profile.
    if scope == "class" {
        doc.remove("institute");
    }
    // Portable documents are merged unless the caller explicitly asks otherwise.
    let requested = if mode.is_empty() { "merge" } else { mode };
    let requested = requested.to_lowercase();
    if requested != "merge" && requested != "replace" {
        return Err(http_err(400, "mode must be \"merge\" or \"replace\""));
    }
    // A class backup is always merged so it cannot wipe the rest of the database.
    let mode = if scope == "class" {
        "merge"
    } else {
        requested.as_str()
    };
    let stats = import_document(conn, &doc, mode)?;
    restore_value(conn, &scope, mode, &stats)
}
