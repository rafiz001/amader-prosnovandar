use std::sync::atomic::{AtomicU64, Ordering};

use base64::Engine;
use serde_json::{Map, Number, Value};
use unicode_normalization::UnicodeNormalization;

use crate::error::{http_err, Result};

pub type Fields = Map<String, Value>;

pub trait FieldsExt {
    fn has(&self, key: &str) -> bool;
    fn val(&self, key: &str) -> Option<&Value>;
    fn str(&self, key: &str) -> String;
    fn str_def(&self, key: &str, def: &str) -> String;
    fn int(&self, key: &str) -> Option<i64>;
    fn flag(&self, key: &str) -> bool;
    fn map(&self, key: &str) -> Option<&Fields>;
    fn list(&self, key: &str) -> Vec<Value>;
}

impl FieldsExt for Fields {
    fn has(&self, key: &str) -> bool {
        self.contains_key(key)
    }

    fn val(&self, key: &str) -> Option<&Value> {
        self.get(key)
    }

    fn str(&self, key: &str) -> String {
        self.get(key).map(|v| clean(&to_str(v))).unwrap_or_default()
    }

    fn str_def(&self, key: &str, def: &str) -> String {
        match self.get(key) {
            None | Some(Value::Null) => def.to_string(),
            Some(v) => clean(&to_str(v)),
        }
    }

    fn int(&self, key: &str) -> Option<i64> {
        self.get(key).and_then(to_int)
    }

    fn flag(&self, key: &str) -> bool {
        match self.get(key) {
            Some(Value::Bool(b)) => *b,
            Some(Value::String(s)) => s == "true" || s == "1",
            Some(v) => to_int(v).map(|n| n == 1).unwrap_or(false),
            None => false,
        }
    }

    fn map(&self, key: &str) -> Option<&Fields> {
        self.get(key).and_then(|v| v.as_object())
    }

    fn list(&self, key: &str) -> Vec<Value> {
        self.get(key)
            .and_then(|v| v.as_array())
            .cloned()
            .unwrap_or_default()
    }
}

pub fn clean(s: &str) -> String {
    s.nfc().collect::<String>().trim().to_string()
}

pub fn required(v: &str, label: &str) -> Result<String> {
    let s = clean(v);
    if s.is_empty() {
        return Err(http_err(400, format!("{label} is required")));
    }
    Ok(s)
}

pub fn to_str(v: &Value) -> String {
    match v {
        Value::Null => String::new(),
        Value::String(s) => s.clone(),
        Value::Bool(b) => b.to_string(),
        Value::Number(n) => n.to_string(),
        Value::Array(_) | Value::Object(_) => String::new(),
    }
}

pub fn to_float(v: &Value) -> Option<f64> {
    match v {
        Value::Number(n) => n.as_f64(),
        Value::String(s) => s.trim().parse::<f64>().ok(),
        _ => None,
    }
}

pub fn to_int(v: &Value) -> Option<i64> {
    let f = to_float(v)?;
    if !f.is_finite() || f.fract() != 0.0 {
        return None;
    }
    Some(f as i64)
}

pub fn id_from(v: &Value, label: &str) -> Result<i64> {
    match to_int(v) {
        Some(n) if n >= 1 => Ok(n),
        _ => Err(http_err(400, format!("Invalid {label}"))),
    }
}

fn push_list_item(v: &Value, out: &mut Vec<Value>) {
    match v {
        Value::Array(items) => {
            for item in items {
                push_list_item(item, out);
            }
        }
        Value::String(s) => {
            for part in s.split(',') {
                let part = part.trim();
                if !part.is_empty() {
                    out.push(Value::String(part.to_string()));
                }
            }
        }
        _ => out.push(v.clone()),
    }
}

/// Reads a query-like field that may hold a scalar, an array or comma separated values.
pub fn query_list(obj: &Fields, key: &str) -> Vec<Value> {
    let mut out = Vec::new();
    if let Some(v) = obj.get(key) {
        push_list_item(v, &mut out);
    }
    out
}

pub fn any_list(v: Option<&Value>) -> Vec<Value> {
    let mut out = Vec::new();
    match v {
        None | Some(Value::Null) => {}
        Some(value) => push_list_item(value, &mut out),
    }
    out
}

pub fn parse_id_list(vals: &[Value], label: &str, allow_none: bool) -> Result<(Vec<i64>, bool)> {
    let mut ids = Vec::new();
    let mut none = false;
    for v in vals {
        if allow_none && to_str(v).eq_ignore_ascii_case("none") {
            none = true;
            continue;
        }
        ids.push(id_from(v, label)?);
    }
    Ok((ids, none))
}

pub fn parse_str_list(vals: &[Value], lower: bool) -> Vec<String> {
    let mut out = Vec::new();
    for v in vals {
        let mut s = clean(&to_str(v));
        if s.is_empty() {
            continue;
        }
        if lower {
            s = s.to_lowercase();
        }
        out.push(s);
    }
    out
}

pub fn placeholders(n: usize) -> String {
    let mut out = String::new();
    for i in 0..n {
        if i > 0 {
            out.push(',');
        }
        out.push('?');
    }
    out
}

pub fn contains(list: &[&str], s: &str) -> bool {
    list.contains(&s)
}

pub fn check_kinds(kinds: &[String]) -> Result<()> {
    for k in kinds {
        if !contains(&crate::questions::QUESTION_KINDS, k) {
            return Err(http_err(
                400,
                format!(
                    "kind must be one of: {}",
                    crate::questions::QUESTION_KINDS.join(", ")
                ),
            ));
        }
    }
    Ok(())
}

/// Orders object keys so numeric keys (ids) come before names, numerically.
pub fn sorted_keys(map: &Fields) -> Vec<String> {
    let mut keys: Vec<String> = map.keys().cloned().collect();
    keys.sort_by(|a, b| match (a.parse::<i64>(), b.parse::<i64>()) {
        (Ok(x), Ok(y)) => x.cmp(&y),
        (Ok(_), Err(_)) => std::cmp::Ordering::Less,
        (Err(_), Ok(_)) => std::cmp::Ordering::Greater,
        (Err(_), Err(_)) => a.cmp(b),
    });
    keys
}

// ---- time -----------------------------------------------------------------

#[cfg(target_family = "wasm")]
pub fn now_ms() -> i64 {
    js_sys::Date::now() as i64
}

#[cfg(not(target_family = "wasm"))]
pub fn now_ms() -> i64 {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

fn civil_from_days(z: i64) -> (i64, u32, u32) {
    let z = z + 719_468;
    let era = if z >= 0 { z } else { z - 146_096 } / 146_097;
    let doe = z - era * 146_097;
    let yoe = (doe - doe / 1_460 + doe / 36_524 - doe / 146_096) / 365;
    let y = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = mp + if mp < 10 { 3 } else { -9 };
    (y + if m <= 2 { 1 } else { 0 }, m as u32, d as u32)
}

pub fn format_iso_ms(ms: i64) -> String {
    let secs = ms.div_euclid(1000);
    let millis = ms.rem_euclid(1000);
    let (year, month, day) = civil_from_days(secs.div_euclid(86_400));
    let sod = secs.rem_euclid(86_400);
    format!(
        "{year:04}-{month:02}-{day:02}T{:02}:{:02}:{:02}.{millis:03}Z",
        sod / 3600,
        (sod % 3600) / 60,
        sod % 60
    )
}

pub fn format_date_compact(ms: i64) -> String {
    let secs = ms.div_euclid(1000);
    let (year, month, day) = civil_from_days(secs.div_euclid(86_400));
    format!("{year:04}{month:02}{day:02}")
}

// ---- base64 & images --------------------------------------------------------

pub fn b64_encode(bytes: &[u8]) -> String {
    base64::engine::general_purpose::STANDARD.encode(bytes)
}

pub fn b64_decode(text: &str) -> Result<Vec<u8>> {
    let raw: String = text
        .chars()
        .filter(|c| !matches!(c, '\n' | '\r' | ' ' | '\t'))
        .collect();
    base64::engine::general_purpose::STANDARD
        .decode(raw.as_bytes())
        .map_err(|_| http_err(422, "Invalid base64 data"))
}

pub fn allowed_image(mime: &str) -> Option<&'static str> {
    match mime {
        "image/png" => Some("png"),
        "image/jpeg" => Some("jpg"),
        "image/gif" => Some("gif"),
        "image/webp" => Some("webp"),
        _ => None,
    }
}

/// Trusts the bytes, not the client's declared type (mirrors http.DetectContentType).
pub fn sniff_image(data: &[u8]) -> Result<(String, &'static str)> {
    let mime = infer::get(data)
        .map(|t| t.mime_type().to_string())
        .unwrap_or_else(|| "application/octet-stream".to_string());
    match allowed_image(&mime) {
        Some(ext) => Ok((mime, ext)),
        None => Err(http_err(
            415,
            "Only PNG, JPEG, GIF or WebP images are allowed",
        )),
    }
}

// ---- small deterministic rng -----------------------------------------------

static RNG_COUNTER: AtomicU64 = AtomicU64::new(0x9E37_79B9_7F4A_7C15);

pub struct Rng(u64);

impl Default for Rng {
    fn default() -> Self {
        Self::new()
    }
}

impl Rng {
    pub fn new() -> Self {
        let n = RNG_COUNTER.fetch_add(0x9E37_79B9_7F4A_7C15, Ordering::Relaxed);
        Rng((now_ms() as u64) ^ n.rotate_left(17) ^ 0xD1B5_4A32_D192_ED03)
    }

    fn next(&mut self) -> u64 {
        let mut x = self.0;
        x ^= x << 13;
        x ^= x >> 7;
        x ^= x << 17;
        self.0 = x;
        x
    }

    pub fn below(&mut self, n: usize) -> usize {
        if n == 0 {
            0
        } else {
            (self.next() % n as u64) as usize
        }
    }

    pub fn shuffle<T>(&mut self, items: &mut [T]) {
        if items.len() < 2 {
            return;
        }
        for i in (1..items.len()).rev() {
            let j = self.below(i + 1);
            items.swap(i, j);
        }
    }
}

pub fn number_value(f: f64) -> Value {
    Number::from_f64(f)
        .map(Value::Number)
        .unwrap_or(Value::Null)
}
