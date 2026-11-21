//! Browser shell: opens an in-memory SQLite database (sqlite-wasm-rs), restores
//! its serialized image from IndexedDB on boot, and saves after every mutation.

use std::cell::RefCell;

use questionbank_core::{db, service, ApiError, Connection};
use rexie::{ObjectStore, Rexie, TransactionMode};
use serde_json::Value;
use wasm_bindgen::prelude::*;
use wasm_bindgen_futures::spawn_local;

const DB_NAME: &str = "questionbank";
const STORE: &str = "kv";
const DB_KEY: &str = "db";

thread_local! {
    static APP: RefCell<Option<Connection>> = const { RefCell::new(None) };
}

fn to_js<T: serde::Serialize>(value: &T) -> Result<JsValue, JsValue> {
    let serializer = serde_wasm_bindgen::Serializer::new().serialize_maps_as_objects(true);
    value
        .serialize(&serializer)
        .map_err(|e| JsValue::from_str(&format!("could not encode the result: {e}")))
}

fn js_err(error: &ApiError) -> JsValue {
    to_js(error).unwrap_or_else(|_| JsValue::from_str(&error.message))
}

async fn open_idb() -> Option<Rexie> {
    Rexie::builder(DB_NAME)
        .version(1)
        .add_object_store(ObjectStore::new(STORE))
        .build()
        .await
        .ok()
}

async fn load_db() -> Option<Vec<u8>> {
    let rexie = open_idb().await?;
    let value = {
        let tx = rexie
            .transaction(&[STORE], TransactionMode::ReadOnly)
            .ok()?;
        let store = tx.store(STORE).ok()?;
        let value = store.get(JsValue::from_str(DB_KEY)).await.ok().flatten();
        let _ = tx.done().await;
        value
    };
    rexie.close();
    let value = value?;
    if value.is_undefined() || value.is_null() {
        return None;
    }
    Some(js_sys::Uint8Array::new(&value).to_vec())
}

fn persist(bytes: Vec<u8>) {
    spawn_local(async move {
        let Some(rexie) = open_idb().await else {
            return;
        };
        if let Ok(tx) = rexie.transaction(&[STORE], TransactionMode::ReadWrite) {
            if let Ok(store) = tx.store(STORE) {
                let bytes: JsValue = js_sys::Uint8Array::from(bytes.as_slice()).into();
                let _ = store.put(&bytes, Some(&JsValue::from_str(DB_KEY))).await;
                let _ = tx.done().await;
            }
        }
        rexie.close();
    });
}

fn is_write(op: &str) -> bool {
    !(op == "health" || op == "export" || op.ends_with(".list") || op.ends_with(".get"))
}

/// Called once by the frontend before any `call`.
#[wasm_bindgen]
pub async fn boot() -> Result<(), JsValue> {
    console_error_panic_hook::set_once();
    let bytes = load_db().await;
    let mut conn = db::open_in_memory().map_err(|e| JsValue::from_str(&e.message))?;
    if let Some(bytes) = bytes {
        db::deserialize(&mut conn, &bytes).map_err(|e| JsValue::from_str(&e.message))?;
    }
    db::run_migrations(&conn).map_err(|e| JsValue::from_str(&e.message))?;
    APP.with(|app| {
        *app.borrow_mut() = Some(conn);
    });
    Ok(())
}

#[wasm_bindgen]
pub fn call(op: &str, payload: JsValue) -> Result<JsValue, JsValue> {
    let payload: Value = if payload.is_null() || payload.is_undefined() {
        Value::Null
    } else {
        serde_wasm_bindgen::from_value(payload)
            .map_err(|e| JsValue::from_str(&format!("invalid request payload: {e}")))?
    };

    let result = APP.with(|cell| {
        let mut guard = cell.borrow_mut();
        let Some(conn) = guard.as_mut() else {
            return Err(ApiError::new(500, "database is not initialized"));
        };
        let result = service::call(conn, op, payload);
        if result.is_ok() && is_write(op) {
            if let Ok(bytes) = db::serialize(conn) {
                persist(bytes);
            }
        }
        result
    });

    match result {
        Ok(value) => to_js(&value),
        Err(error) => Err(js_err(&error)),
    }
}
