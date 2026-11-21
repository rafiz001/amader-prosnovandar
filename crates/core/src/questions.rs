use rusqlite::types::Value as SqlValue;
use rusqlite::{params_from_iter, Connection, OptionalExtension};
use serde_json::Value;

use crate::error::{http_err, ApiError, Result};
use crate::models::{Institute, QType, QuestionOut};
use crate::util::{b64_encode, clean, FieldsExt};

pub const QUESTION_KINDS: [&str; 3] = ["mcq", "true_false", "text"];
pub const DIFFICULTIES: [&str; 3] = ["easy", "medium", "hard"];

pub fn is_rtl(lang: &str) -> bool {
    matches!(lang, "ar" | "fa" | "ur" | "he")
}

pub fn valid_lang(lang: &str) -> bool {
    let mut parts = lang.split('-');
    let Some(first) = parts.next() else {
        return false;
    };
    if !(2..=3).contains(&first.len()) || !first.chars().all(|c| c.is_ascii_lowercase()) {
        return false;
    }
    parts.all(|p| {
        !p.is_empty()
            && p.chars()
                .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit())
    })
}

pub fn alias_description(f: &mut crate::util::Fields) {
    if !f.has("description") && f.has("explanation") {
        if let Some(v) = f.get("explanation").cloned() {
            f.insert("description".to_string(), v);
        }
    }
}

/// Accepts booleans and common words (English, Bengali, Arabic).
pub fn parse_true_false(v: Option<&Value>) -> Option<bool> {
    if let Some(Value::Bool(b)) = v {
        return Some(*b);
    }
    let s = v
        .map(crate::util::to_str)
        .unwrap_or_default()
        .to_lowercase();
    match clean(&s).as_str() {
        "true" | "t" | "yes" | "y" | "1" | "সত্য" | "ঠিক" | "صح" | "صحيح" => {
            Some(true)
        }
        "false" | "f" | "no" | "n" | "0" | "মিথ্যা" | "ভুল" | "خطأ" | "خاطئ" => {
            Some(false)
        }
        _ => None,
    }
}

#[derive(Debug, Clone)]
pub struct QInput {
    pub type_id: i64,
    pub kind: String,
    pub chapter_id: Option<i64>,
    pub text: String,
    pub math: String,
    pub answer: String,
    pub description: String,
    pub lang: String,
    pub difficulty: String,
    pub marks: f64,
    pub options: [String; 4],
    pub correct: Option<i64>,
}

pub fn normalize_question(f: &crate::util::Fields, t: &QType, has_image: bool) -> Result<QInput> {
    let difficulty = f.str_def("difficulty", "medium").to_lowercase();
    if !crate::util::contains(&DIFFICULTIES, &difficulty) {
        return Err(http_err(
            400,
            format!("difficulty must be one of: {}", DIFFICULTIES.join(", ")),
        ));
    }
    let lang = f.str_def("lang", "en").to_lowercase();
    if !valid_lang(&lang) {
        return Err(http_err(
            400,
            "lang must be a language code like en, ar, bn",
        ));
    }

    let mut marks = 1.0;
    if let Some(v) = f.get("marks") {
        if !v.is_null() && !crate::util::to_str(v).is_empty() {
            match crate::util::to_float(v) {
                Some(m) if m.is_finite() && m >= 0.0 => marks = m,
                _ => return Err(http_err(400, "marks must be a non-negative number")),
            }
        }
    }

    let text = f.str("text");
    let math = f.str("math");
    let description = f.str("description");
    if text.is_empty() && math.is_empty() && !has_image {
        return Err(http_err(
            400,
            "A question needs at least one of: text, math, image",
        ));
    }

    let mut n = QInput {
        type_id: t.id,
        kind: t.kind.clone(),
        chapter_id: None,
        text,
        math,
        answer: String::new(),
        description,
        lang,
        difficulty,
        marks,
        options: Default::default(),
        correct: None,
    };

    match t.kind.as_str() {
        "mcq" => {
            let src: Vec<Value> = match f.get("options") {
                Some(Value::Array(items)) => items.clone(),
                _ => vec![
                    f.get("option_1").cloned().unwrap_or(Value::Null),
                    f.get("option_2").cloned().unwrap_or(Value::Null),
                    f.get("option_3").cloned().unwrap_or(Value::Null),
                    f.get("option_4").cloned().unwrap_or(Value::Null),
                ],
            };
            if src.len() != 4 {
                return Err(http_err(400, "An MCQ requires exactly 4 non-empty options"));
            }
            for (i, o) in src.iter().enumerate() {
                let option = clean(&crate::util::to_str(o));
                if option.is_empty() {
                    return Err(http_err(400, "An MCQ requires exactly 4 non-empty options"));
                }
                n.options[i] = option;
            }
            let c = f.int("correct_option");
            match c {
                Some(c) if (1..=4).contains(&c) => {
                    n.correct = Some(c);
                    n.answer = n.options[(c - 1) as usize].clone();
                }
                _ => {
                    return Err(http_err(
                        400,
                        "correct_option must be an integer from 1 to 4",
                    ))
                }
            }
        }
        "true_false" => match parse_true_false(f.get("answer")) {
            Some(b) => n.answer = b.to_string(),
            None => {
                return Err(http_err(
                    400,
                    "answer must be true or false for a true/false question",
                ))
            }
        },
        _ => {
            n.answer = f.str("answer");
        }
    }
    Ok(n)
}

// ---- storage ------------------------------------------------------------------

#[derive(Debug, Clone)]
pub struct QuestionRow {
    pub id: i64,
    pub subject_id: i64,
    pub type_id: i64,
    pub type_name: String,
    pub kind: String,
    pub chapter_id: Option<i64>,
    pub chapter_name: Option<String>,
    pub text: String,
    pub math: String,
    pub image_id: Option<i64>,
    pub opt: [Option<String>; 4],
    pub correct: Option<i64>,
    pub answer: String,
    pub description: String,
    pub marks: f64,
    pub difficulty: String,
    pub lang: String,
    pub joined: bool,
    pub subject_name: String,
    pub class_id: i64,
    pub class_name: String,
}

const Q_SELECT: &str =
    "SELECT q.id, q.subject_id, q.type_id, t.name, t.kind, q.chapter_id, ch.name,
    q.text, q.math, q.image_id, q.option_1, q.option_2, q.option_3, q.option_4, q.correct_option,
    q.answer, q.description, q.marks, q.difficulty, q.lang";
const Q_FROM: &str = " FROM questions q JOIN question_types t ON t.id = q.type_id LEFT JOIN chapters ch ON ch.id = q.chapter_id";
const Q_SCOPE_SELECT: &str = ", s.name, c.id, c.name";
const Q_SCOPE_FROM: &str =
    " JOIN subjects s ON s.id = q.subject_id JOIN classes c ON c.id = s.class_id";

pub fn query_questions(
    conn: &Connection,
    scope: bool,
    tail: &str,
    args: Vec<SqlValue>,
) -> Result<Vec<QuestionRow>> {
    let mut sql = String::from(Q_SELECT);
    if scope {
        sql.push_str(Q_SCOPE_SELECT);
    }
    sql.push_str(Q_FROM);
    if scope {
        sql.push_str(Q_SCOPE_FROM);
    }
    sql.push_str(tail);

    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map(params_from_iter(args.iter()), |row| {
        let mut opt: [Option<String>; 4] = Default::default();
        for (i, slot) in opt.iter_mut().enumerate() {
            *slot = row.get::<_, Option<String>>(10 + i)?;
        }
        Ok(QuestionRow {
            id: row.get(0)?,
            subject_id: row.get(1)?,
            type_id: row.get(2)?,
            type_name: row.get(3)?,
            kind: row.get(4)?,
            chapter_id: row.get(5)?,
            chapter_name: row.get(6)?,
            text: row.get(7)?,
            math: row.get(8)?,
            image_id: row.get(9)?,
            opt,
            correct: row.get(14)?,
            answer: row.get(15)?,
            description: row.get(16)?,
            marks: row.get(17)?,
            difficulty: row.get(18)?,
            lang: row.get(19)?,
            joined: scope,
            subject_name: if scope { row.get(20)? } else { String::new() },
            class_id: if scope { row.get(21)? } else { 0 },
            class_name: if scope { row.get(22)? } else { String::new() },
        })
    })?;

    let mut out = Vec::new();
    for r in rows {
        out.push(r?);
    }
    Ok(out)
}

pub fn find_question(conn: &Connection, id: i64) -> Result<QuestionRow> {
    let mut qs = query_questions(conn, false, " WHERE q.id = ?", vec![SqlValue::Integer(id)])?;
    if qs.is_empty() {
        return Err(http_err(404, "Question not found"));
    }
    Ok(qs.remove(0))
}

fn opt_sql(n: &QInput, i: usize) -> SqlValue {
    if n.kind == "mcq" {
        SqlValue::Text(n.options[i].clone())
    } else {
        SqlValue::Null
    }
}

fn correct_sql(n: &QInput) -> SqlValue {
    match (n.kind.as_str(), n.correct) {
        ("mcq", Some(c)) => SqlValue::Integer(c),
        _ => SqlValue::Null,
    }
}

pub fn insert_question(
    conn: &Connection,
    subject_id: i64,
    n: &QInput,
    image_id: Option<i64>,
) -> Result<i64> {
    let args = [
        SqlValue::Integer(subject_id),
        n.chapter_id
            .map(SqlValue::Integer)
            .unwrap_or(SqlValue::Null),
        SqlValue::Integer(n.type_id),
        SqlValue::Text(n.text.clone()),
        SqlValue::Text(n.math.clone()),
        image_id.map(SqlValue::Integer).unwrap_or(SqlValue::Null),
        opt_sql(n, 0),
        opt_sql(n, 1),
        opt_sql(n, 2),
        opt_sql(n, 3),
        correct_sql(n),
        SqlValue::Text(n.answer.clone()),
        SqlValue::Text(n.description.clone()),
        SqlValue::Real(n.marks),
        SqlValue::Text(n.difficulty.clone()),
        SqlValue::Text(n.lang.clone()),
    ];
    conn.execute(
        "INSERT INTO questions
        (subject_id, chapter_id, type_id, text, math, image_id, option_1, option_2, option_3, option_4,
         correct_option, answer, description, marks, difficulty, lang)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        params_from_iter(args.iter()),
    )?;
    Ok(conn.last_insert_rowid())
}

pub fn update_question(
    conn: &Connection,
    id: i64,
    n: &QInput,
    image_id: Option<i64>,
) -> Result<()> {
    let args = [
        n.chapter_id
            .map(SqlValue::Integer)
            .unwrap_or(SqlValue::Null),
        SqlValue::Integer(n.type_id),
        SqlValue::Text(n.text.clone()),
        SqlValue::Text(n.math.clone()),
        image_id.map(SqlValue::Integer).unwrap_or(SqlValue::Null),
        opt_sql(n, 0),
        opt_sql(n, 1),
        opt_sql(n, 2),
        opt_sql(n, 3),
        correct_sql(n),
        SqlValue::Text(n.answer.clone()),
        SqlValue::Text(n.description.clone()),
        SqlValue::Real(n.marks),
        SqlValue::Text(n.difficulty.clone()),
        SqlValue::Text(n.lang.clone()),
        SqlValue::Integer(id),
    ];
    conn.execute(
        "UPDATE questions SET chapter_id=?, type_id=?, text=?, math=?, image_id=?,
        option_1=?, option_2=?, option_3=?, option_4=?, correct_option=?, answer=?, description=?,
        marks=?, difficulty=?, lang=?, updated_at=CURRENT_TIMESTAMP WHERE id=?",
        params_from_iter(args.iter()),
    )?;
    Ok(())
}

// ---- API shape ----------------------------------------------------------------

pub fn file_row(conn: &Connection, id: i64) -> Option<(String, Vec<u8>)> {
    conn.query_row("SELECT mime, data FROM files WHERE id=?", [id], |r| {
        Ok((r.get::<_, String>(0)?, r.get::<_, Vec<u8>>(1)?))
    })
    .optional()
    .ok()
    .flatten()
}

pub fn data_url(mime: &str, data: &[u8]) -> String {
    format!("data:{mime};base64,{}", b64_encode(data))
}

pub fn serialize_question(conn: &Connection, q: &QuestionRow, answers: bool) -> QuestionOut {
    let mut out = QuestionOut {
        id: q.id,
        subject_id: q.subject_id,
        subject_name: if q.joined && !q.subject_name.is_empty() {
            Some(q.subject_name.clone())
        } else {
            None
        },
        class_id: if q.joined && q.class_id != 0 {
            Some(q.class_id)
        } else {
            None
        },
        class_name: if q.joined && !q.class_name.is_empty() {
            Some(q.class_name.clone())
        } else {
            None
        },
        type_id: q.type_id,
        type_name: q.type_name.clone(),
        kind: q.kind.clone(),
        chapter_id: q.chapter_id,
        chapter_name: q.chapter_name.clone(),
        text: q.text.clone(),
        math: q.math.clone(),
        image_url: None,
        options: None,
        marks: q.marks,
        difficulty: q.difficulty.clone(),
        lang: q.lang.clone(),
        dir: if is_rtl(&q.lang) { "rtl" } else { "ltr" }.to_string(),
        correct_option: None,
        answer: None,
        description: None,
    };

    if let Some(id) = q.image_id {
        if let Some((mime, data)) = file_row(conn, id) {
            out.image_url = Some(data_url(&mime, &data));
        }
    }
    if q.kind == "mcq" {
        out.options = Some(vec![
            q.opt[0].clone().unwrap_or_default(),
            q.opt[1].clone().unwrap_or_default(),
            q.opt[2].clone().unwrap_or_default(),
            q.opt[3].clone().unwrap_or_default(),
        ]);
    }
    if answers {
        out.correct_option = q.correct;
        out.answer = Some(q.answer.clone());
        out.description = Some(q.description.clone());
    }
    out
}

// ---- files & institute ----------------------------------------------------------

pub fn save_file(conn: &Connection, data: &[u8], mime: &str, kind: &str) -> Result<i64> {
    let ext = crate::util::allowed_image(mime).unwrap_or("bin");
    let name = format!("{}-{}.{}", kind, crate::util::now_ms(), ext);
    conn.execute(
        "INSERT INTO files (filename, mime, size, data) VALUES (?,?,?,?)",
        rusqlite::params![name, mime, data.len() as i64, data],
    )?;
    Ok(conn.last_insert_rowid())
}

pub fn purge_orphan_files(conn: &Connection) -> Result<()> {
    conn.execute(
        "DELETE FROM files
        WHERE id NOT IN (SELECT image_id FROM questions WHERE image_id IS NOT NULL)
          AND id NOT IN (SELECT logo_file_id FROM institute WHERE logo_file_id IS NOT NULL)",
        [],
    )?;
    Ok(())
}

pub fn get_institute(conn: &Connection) -> Result<Institute> {
    let row = conn
        .query_row(
            "SELECT name, location, logo_file_id, updated_at FROM institute WHERE id = 1",
            [],
            |r| {
                Ok((
                    r.get::<_, String>(0)?,
                    r.get::<_, String>(1)?,
                    r.get::<_, Option<i64>>(2)?,
                    r.get::<_, Option<String>>(3)?,
                ))
            },
        )
        .optional()?;
    let Some((name, location, logo, updated_at)) = row else {
        return Err(ApiError::new(500, "institute row is missing"));
    };
    let logo_url = logo
        .and_then(|id| file_row(conn, id))
        .map(|(mime, data)| data_url(&mime, &data));
    Ok(Institute {
        name,
        location,
        logo_url,
        updated_at,
    })
}
