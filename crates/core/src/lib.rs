//! Shared question bank logic used by the Tauri desktop/mobile shell and the
//! `questionbank-wasm` browser shell. The entire former Go HTTP layer lives here
//! as plain functions over one SQLite connection; `service::call` is the single
//! request dispatcher both shells expose.

pub mod basic;
pub mod db;
pub mod error;
pub mod filters;
pub mod generate;
pub mod meta;
pub mod models;
pub mod presets;
pub mod questions;
pub mod service;
pub mod transfer;
pub mod util;

pub use error::{ApiError, Result};
pub use rusqlite::Connection;
