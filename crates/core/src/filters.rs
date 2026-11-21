use rusqlite::types::Value as SqlValue;

use crate::error::Result;
use crate::util::{
    any_list, check_kinds, parse_id_list, parse_str_list, placeholders, query_list, Fields,
};

#[derive(Debug, Default, Clone)]
pub struct QFilter {
    pub chapter_ids: Vec<i64>,
    pub no_chapter: bool,
    pub type_ids: Vec<i64>,
    pub kinds: Vec<String>,
    pub type_names: Vec<String>,
    pub difficulties: Vec<String>,
    pub langs: Vec<String>,
}

impl QFilter {
    pub fn build(&self) -> (Vec<String>, Vec<SqlValue>) {
        let mut where_parts: Vec<String> = Vec::new();
        let mut args: Vec<SqlValue> = Vec::new();

        if !self.chapter_ids.is_empty() || self.no_chapter {
            let mut parts: Vec<String> = Vec::new();
            if !self.chapter_ids.is_empty() {
                parts.push(format!(
                    "q.chapter_id IN ({})",
                    placeholders(self.chapter_ids.len())
                ));
                args.extend(self.chapter_ids.iter().map(|v| SqlValue::Integer(*v)));
            }
            if self.no_chapter {
                parts.push("q.chapter_id IS NULL".to_string());
            }
            where_parts.push(format!("({})", parts.join(" OR ")));
        }
        if !self.type_ids.is_empty() {
            where_parts.push(format!(
                "q.type_id IN ({})",
                placeholders(self.type_ids.len())
            ));
            args.extend(self.type_ids.iter().map(|v| SqlValue::Integer(*v)));
        }
        if !self.kinds.is_empty() {
            where_parts.push(format!("t.kind IN ({})", placeholders(self.kinds.len())));
            args.extend(self.kinds.iter().map(|v| SqlValue::Text(v.clone())));
        }
        if !self.type_names.is_empty() {
            let mut parts: Vec<String> = Vec::new();
            for name in &self.type_names {
                parts.push("(t.name = ? OR t.kind = ?)".to_string());
                args.push(SqlValue::Text(name.clone()));
                args.push(SqlValue::Text(name.to_lowercase()));
            }
            where_parts.push(format!("({})", parts.join(" OR ")));
        }
        if !self.difficulties.is_empty() {
            where_parts.push(format!(
                "q.difficulty IN ({})",
                placeholders(self.difficulties.len())
            ));
            args.extend(self.difficulties.iter().map(|v| SqlValue::Text(v.clone())));
        }
        if !self.langs.is_empty() {
            where_parts.push(format!("q.lang IN ({})", placeholders(self.langs.len())));
            args.extend(self.langs.iter().map(|v| SqlValue::Text(v.clone())));
        }
        (where_parts, args)
    }
}

/// Reads ?chapter_id=1,2,none &type_id=3,4 &kind=mcq &type=Short &difficulty=easy &lang=bn
pub fn filter_from_query(obj: &Fields) -> Result<QFilter> {
    let (chapter_ids, no_chapter) =
        parse_id_list(&query_list(obj, "chapter_id"), "chapter_id", true)?;
    let (type_ids, _) = parse_id_list(&query_list(obj, "type_id"), "type_id", false)?;
    let kinds = parse_str_list(&query_list(obj, "kind"), true);
    let type_names = parse_str_list(&query_list(obj, "type"), false);
    let difficulties = parse_str_list(&query_list(obj, "difficulty"), true);
    let langs = parse_str_list(&query_list(obj, "lang"), true);
    check_kinds(&kinds)?;
    Ok(QFilter {
        chapter_ids,
        no_chapter,
        type_ids,
        kinds,
        type_names,
        difficulties,
        langs,
    })
}

/// Reads the "random" object of a generate request. Each field takes one value or a list.
pub fn filter_from_random(rm: &Fields) -> Result<QFilter> {
    let (chapter_ids, no_chapter) =
        parse_id_list(&any_list(rm.get("chapter_ids")), "chapter id", true)?;
    let (type_ids, _) = parse_id_list(&any_list(rm.get("type_ids")), "type id", false)?;
    let kinds = parse_str_list(&any_list(rm.get("kinds")), true);
    let mut type_values = any_list(rm.get("types"));
    type_values.extend(any_list(rm.get("type")));
    let type_names = parse_str_list(&type_values, false);
    let difficulties = parse_str_list(&any_list(rm.get("difficulty")), true);
    let langs = parse_str_list(&any_list(rm.get("lang")), true);
    check_kinds(&kinds)?;
    Ok(QFilter {
        chapter_ids,
        no_chapter,
        type_ids,
        kinds,
        type_names,
        difficulties,
        langs,
    })
}
