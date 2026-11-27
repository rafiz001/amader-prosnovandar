use serde::Serialize;
use serde_json::Value;

use crate::util::Fields;

#[derive(Debug, Clone, Serialize)]
pub struct Institute {
    pub name: String,
    pub location: String,
    pub logo_url: Option<String>,
    pub updated_at: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct Class {
    pub id: i64,
    pub name: String,
    pub description: String,
    pub created_at: String,
    pub updated_at: Option<String>,
    pub subject_count: i64,
}

#[derive(Debug, Clone, Serialize)]
pub struct Subject {
    pub id: i64,
    pub class_id: i64,
    pub name: String,
    pub code: String,
    pub created_at: String,
    pub updated_at: Option<String>,
    pub question_count: i64,
    pub chapter_count: i64,
    pub type_count: i64,
}

#[derive(Debug, Clone, Serialize)]
pub struct QType {
    pub id: i64,
    pub subject_id: i64,
    pub name: String,
    pub kind: String,
    pub created_at: String,
    pub updated_at: Option<String>,
    pub question_count: i64,
}

#[derive(Debug, Clone, Serialize)]
pub struct Chapter {
    pub id: i64,
    pub subject_id: i64,
    pub name: String,
    pub position: i64,
    pub description: String,
    pub created_at: String,
    pub updated_at: Option<String>,
    pub question_count: i64,
}

#[derive(Debug, Clone, Serialize)]
pub struct QuestionOut {
    pub id: i64,
    pub subject_id: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub subject_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub class_id: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub class_name: Option<String>,
    pub type_id: i64,
    #[serde(rename = "type")]
    pub type_name: String,
    pub kind: String,
    pub chapter_id: Option<i64>,
    pub chapter_name: Option<String>,
    pub text: String,
    pub math: String,
    pub image_url: Option<String>,
    pub options: Option<Vec<String>>,
    pub marks: f64,
    pub difficulty: String,
    pub lang: String,
    pub font_pt: f64,
    pub align: String,
    pub dir: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub correct_option: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub answer: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct PaperQuestion {
    pub number: usize,
    #[serde(flatten)]
    pub question: QuestionOut,
}

#[derive(Debug, Clone, Serialize)]
pub struct AnswerKeyItem {
    pub number: usize,
    #[serde(rename = "type")]
    pub type_name: String,
    pub kind: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub correct_option: Option<i64>,
    pub answer: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct Paper {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub id: Option<i64>,
    pub title: String,
    pub generated_at: String,
    pub institute: Institute,
    pub meta: Fields,
    pub include_answers: bool,
    pub total_questions: usize,
    pub total_marks: f64,
    pub questions: Vec<PaperQuestion>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub answer_key: Option<Vec<AnswerKeyItem>>,
}

#[derive(Debug, Clone, Serialize)]
pub struct PaperListItem {
    pub id: i64,
    pub title: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct LayoutPresetOut {
    pub id: i64,
    pub name: String,
    pub layout: Value,
    pub created_at: String,
    pub updated_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Default)]
pub struct ImportStats {
    pub classes_created: i64,
    pub subjects_created: i64,
    pub chapters_created: i64,
    pub question_types_created: i64,
    pub questions_added: i64,
    pub questions_skipped_duplicate: i64,
}
