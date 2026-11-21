use std::fmt;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ApiError {
    pub status: u16,
    pub message: String,
}

impl ApiError {
    pub fn new(status: u16, message: impl Into<String>) -> Self {
        Self {
            status,
            message: message.into(),
        }
    }
}

impl fmt::Display for ApiError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(&self.message)
    }
}

impl std::error::Error for ApiError {}

pub type Result<T> = std::result::Result<T, ApiError>;

pub fn http_err(status: u16, message: impl Into<String>) -> ApiError {
    ApiError::new(status, message)
}

impl From<rusqlite::Error> for ApiError {
    fn from(err: rusqlite::Error) -> Self {
        if let rusqlite::Error::SqliteFailure(code, _) = &err {
            if code.extended_code == 2067 {
                return ApiError::new(409, "A record with the same name already exists");
            }
            if code.code == rusqlite::ErrorCode::ConstraintViolation {
                return ApiError::new(400, format!("Constraint failed: {err}"));
            }
        }
        ApiError::new(500, format!("Database error: {err}"))
    }
}

impl From<serde_json::Error> for ApiError {
    fn from(err: serde_json::Error) -> Self {
        ApiError::new(400, format!("Malformed JSON body: {err}"))
    }
}

impl From<serde_yaml::Error> for ApiError {
    fn from(err: serde_yaml::Error) -> Self {
        ApiError::new(422, format!("Could not read the YML file: {err}"))
    }
}
