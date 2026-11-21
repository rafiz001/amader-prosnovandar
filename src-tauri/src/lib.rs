use std::sync::Mutex;

use questionbank_core::{db, service, ApiError};
use serde::Serialize;
use serde_json::Value;
use tauri::Manager;

struct AppState {
    conn: Mutex<questionbank_core::Connection>,
}

#[derive(Serialize, Debug)]
struct ErrorBody {
    status: u16,
    message: String,
}

impl From<ApiError> for ErrorBody {
    fn from(error: ApiError) -> Self {
        Self {
            status: error.status,
            message: error.message,
        }
    }
}

/// The single bridge between the React UI and all application logic.
#[tauri::command]
fn api_call(
    state: tauri::State<'_, AppState>,
    op: String,
    payload: Option<Value>,
) -> Result<Value, ErrorBody> {
    let mut conn = state.conn.lock().map_err(|_| ErrorBody {
        status: 500,
        message: "The database connection is unavailable".to_string(),
    })?;
    service::call(&mut conn, &op, payload.unwrap_or(Value::Null)).map_err(ErrorBody::from)
}

fn database_path(app: &tauri::AppHandle) -> Result<std::path::PathBuf, Box<dyn std::error::Error>> {
    if let Ok(custom) = std::env::var("QUESTIONBANK_DB") {
        if !custom.trim().is_empty() {
            return Ok(std::path::PathBuf::from(custom));
        }
    }
    let dir = app.path().app_data_dir()?;
    std::fs::create_dir_all(&dir)?;
    Ok(dir.join("questionbank.sqlite"))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let path = database_path(app.handle())?;
            let conn = db::open(path.to_string_lossy().as_ref())?;
            db::run_migrations(&conn)?;
            app.manage(AppState {
                conn: Mutex::new(conn),
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![api_call])
        .run(tauri::generate_context!())
        .expect("error while running the question bank");
}
