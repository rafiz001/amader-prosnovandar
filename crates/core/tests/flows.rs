use questionbank_core::{db, service};
use rusqlite::Connection;
use serde_json::{json, Value};

fn app() -> Connection {
    let conn = db::open_in_memory().expect("open memory db");
    db::run_migrations(&conn).expect("migrations");
    conn
}

fn call(conn: &mut Connection, op: &str, payload: Value) -> Value {
    service::call(conn, op, payload).unwrap_or_else(|e| panic!("{op} failed: {}", e.message))
}

#[test]
fn crud_generate_and_papers() {
    let mut conn = app();

    call(
        &mut conn,
        "institute.update",
        json!({ "name": "ঢাকা আদর্শ বিদ্যালয়", "location": "ঢাকা" }),
    );

    let class = call(
        &mut conn,
        "classes.create",
        json!({ "name": "দশম শ্রেণি", "description": "SSC" }),
    );
    let class_id = class["id"].as_i64().unwrap();

    let subject = call(
        &mut conn,
        "subjects.create",
        json!({ "class_id": class_id, "name": "গণিত", "code": "MATH-10" }),
    );
    let subject_id = subject["id"].as_i64().unwrap();
    assert_eq!(subject["type_count"], 3);

    let types = call(&mut conn, "types.list", json!({ "subject_id": subject_id }));
    let mcq = types
        .as_array()
        .unwrap()
        .iter()
        .find(|t| t["kind"] == "mcq")
        .unwrap()
        .clone();

    let chapter = call(
        &mut conn,
        "chapters.create",
        json!({ "subject_id": subject_id, "name": "বীজগণিত", "position": 1 }),
    );
    let chapter_id = chapter["id"].as_i64().unwrap();

    let question = call(
        &mut conn,
        "questions.create",
        json!({
            "subject_id": subject_id,
            "type_id": mcq["id"],
            "chapter_id": chapter_id,
            "text": "$x^2-5x+6=0$ এর বীজ কত?",
            "options": ["2, 3", "1, 6", "-2, -3", "0, 5"],
            "correct_option": 1,
            "marks": 1,
            "difficulty": "easy",
            "lang": "bn"
        }),
    );
    let question_id = question["id"].as_i64().unwrap();
    assert_eq!(question["answer"], "2, 3");
    assert_eq!(question["dir"], "ltr");

    let listed = call(
        &mut conn,
        "questions.list",
        json!({ "subject_id": subject_id, "q": "বীজ", "limit": 20 }),
    );
    assert_eq!(listed["total"], 1);
    assert_eq!(listed["items"][0]["id"], question_id);

    let paper = call(
        &mut conn,
        "generate",
        json!({
            "title": "মধ্যপরীক্ষা",
            "subject_id": subject_id,
            "question_ids": [question_id],
            "include_answers": true,
            "save": true
        }),
    );
    assert_eq!(paper["total_questions"], 1);
    assert_eq!(paper["include_answers"], true);
    assert_eq!(paper["answer_key"][0]["answer"], "2, 3");
    assert!(paper["questions"][0]["answer"].is_string());
    let paper_id = paper["id"].as_i64().unwrap();

    let papers = call(&mut conn, "papers.list", json!({}));
    assert_eq!(papers.as_array().unwrap().len(), 1);
    let saved = call(&mut conn, "papers.get", json!({ "id": paper_id }));
    assert_eq!(saved["title"], "মধ্যপরীক্ষা");

    let mut edited = paper.clone();
    edited["title"] = json!("সম্পাদিত প্রশ্নপত্র");
    edited["questions"][0]["text"] = json!("সম্পাদিত প্রশ্ন");
    call(
        &mut conn,
        "papers.update",
        json!({ "id": paper_id, "paper": edited }),
    );
    let stored = call(&mut conn, "papers.get", json!({ "id": paper_id }));
    assert_eq!(stored["title"], "সম্পাদিত প্রশ্নপত্র");
    assert_eq!(stored["questions"][0]["text"], "সম্পাদিত প্রশ্ন");
    let listed = call(&mut conn, "papers.list", json!({}));
    assert_eq!(listed[0]["title"], "সম্পাদিত প্রশ্নপত্র");

    call(&mut conn, "papers.delete", json!({ "id": paper_id }));
    assert_eq!(
        call(&mut conn, "papers.list", json!({}))
            .as_array()
            .unwrap()
            .len(),
        0
    );
}

#[test]
fn filters_and_random_generation() {
    let mut conn = app();
    let class = call(&mut conn, "classes.create", json!({ "name": "নবম" }));
    let class_id = class["id"].as_i64().unwrap();
    let subject = call(
        &mut conn,
        "subjects.create",
        json!({ "class_id": class_id, "name": "পদার্থবিজ্ঞান" }),
    );
    let subject_id = subject["id"].as_i64().unwrap();
    let types = call(&mut conn, "types.list", json!({ "subject_id": subject_id }));
    let plain = types
        .as_array()
        .unwrap()
        .iter()
        .find(|t| t["kind"] == "text")
        .unwrap()
        .clone();

    for i in 0..5 {
        call(
            &mut conn,
            "questions.create",
            json!({
                "subject_id": subject_id,
                "type_id": plain["id"],
                "text": format!("প্রশ্ন {i}"),
                "answer": "উত্তর",
                "difficulty": if i % 2 == 0 { "easy" } else { "hard" }
            }),
        );
    }

    let easy = call(
        &mut conn,
        "questions.list",
        json!({ "subject_id": subject_id, "difficulty": "easy" }),
    );
    assert_eq!(easy["total"], 3);

    let paper = call(
        &mut conn,
        "generate",
        json!({
            "subject_id": subject_id,
            "random": { "difficulty": "easy", "count": 2 },
            "shuffle_questions": true,
            "include_answers": true
        }),
    );
    assert_eq!(paper["total_questions"], 2);
    assert_eq!(paper["institute"]["name"], "");

    let hidden = call(
        &mut conn,
        "generate",
        json!({
            "subject_id": subject_id,
            "random": { "difficulty": "easy", "count": 1 },
            "include_answers": false
        }),
    );
    assert_eq!(hidden["include_answers"], false);
    assert!(hidden["questions"][0]["answer"].is_string());

    let err = service::call(
        &mut conn,
        "generate",
        json!({
            "subject_id": subject_id,
            "random": { "difficulty": "hard", "count": 99 }
        }),
    )
    .unwrap_err();
    assert_eq!(err.status, 422);
    assert!(err.message.contains("Only 2"));
}

#[test]
fn export_import_roundtrip_json_and_sqlite() {
    let mut conn = app();
    let class = call(&mut conn, "classes.create", json!({ "name": "একাদশ" }));
    let class_id = class["id"].as_i64().unwrap();
    let subject = call(
        &mut conn,
        "subjects.create",
        json!({ "class_id": class_id, "name": "রসায়ন" }),
    );
    let subject_id = subject["id"].as_i64().unwrap();
    let types = call(&mut conn, "types.list", json!({ "subject_id": subject_id }));
    let mcq = types
        .as_array()
        .unwrap()
        .iter()
        .find(|t| t["kind"] == "mcq")
        .unwrap()
        .clone();
    call(
        &mut conn,
        "questions.create",
        json!({
            "subject_id": subject_id,
            "type_id": mcq["id"],
            "text": "পানির সংকেত কী?",
            "options": ["H2O", "CO2", "O2", "NaCl"],
            "correct_option": 1,
            "lang": "bn"
        }),
    );

    let exported = call(&mut conn, "export", json!({ "format": "json" }));
    let json_bytes = base64_decode(exported["data_base64"].as_str().unwrap());
    assert!(String::from_utf8_lossy(&json_bytes).contains("question-bank"));

    call(&mut conn, "classes.delete", json!({ "id": class_id }));
    assert_eq!(
        call(&mut conn, "classes.list", json!({}))
            .as_array()
            .unwrap()
            .len(),
        0
    );

    let imported = call(
        &mut conn,
        "import",
        json!({
            "data_base64": exported["data_base64"],
            "filename": "questions.json",
            "mode": "merge"
        }),
    );
    assert_eq!(imported["classes_created"], 1);
    assert_eq!(imported["questions_added"], 1);

    let classes = call(&mut conn, "classes.list", json!({}));
    assert_eq!(classes.as_array().unwrap().len(), 1);

    let sqlite = call(&mut conn, "export", json!({ "format": "sqlite" }));
    let bytes = base64_decode(sqlite["data_base64"].as_str().unwrap());
    assert!(bytes.starts_with(b"SQLite format 3"));

    let mut restored = db::open_in_memory().unwrap();
    db::deserialize(&mut restored, &bytes).unwrap();
    db::run_migrations(&restored).unwrap();
    let classes = questionbank_core::basic::list_classes(&restored).unwrap();
    assert_eq!(classes.len(), 1);

    // Import the SQLite snapshot into a fresh database too.
    let mut fresh = db::open_in_memory().unwrap();
    db::run_migrations(&fresh).unwrap();
    let imported = call(
        &mut fresh,
        "import",
        json!({
            "data_base64": sqlite["data_base64"],
            "filename": "backup.sqlite",
            "mode": "merge"
        }),
    );
    assert_eq!(imported["questions_added"], 1);
}

#[test]
fn validation_and_conflicts() {
    let mut conn = app();
    call(&mut conn, "classes.create", json!({ "name": "দ্বাদশ" }));

    let err = service::call(&mut conn, "classes.create", json!({ "name": "দ্বাদশ" })).unwrap_err();
    assert_eq!(err.status, 409);

    let err = service::call(&mut conn, "classes.create", json!({ "name": "  " })).unwrap_err();
    assert_eq!(err.status, 400);
    assert_eq!(err.message, "name is required");

    let err = service::call(&mut conn, "nope", json!({})).unwrap_err();
    assert_eq!(err.status, 404);
}

#[test]
fn legacy_paper_file_urls_are_resolved() {
    let mut conn = app();
    conn.execute(
        "INSERT INTO files (filename, mime, size, data) VALUES ('x.png','image/png',3,X'000102')",
        [],
    )
    .unwrap();
    let file_id = conn.last_insert_rowid();
    let data = format!(
        r#"{{"title":"পুরোনো","institute":{{"logo_url":"/api/files/{file_id}"}},"questions":[{{"image_url":"/api/files/{file_id}"}}]}}"#
    )
    .replace('\'', "''");
    conn.execute(
        &format!("INSERT INTO papers (title, data) VALUES ('পুরোনো', '{data}')"),
        [],
    )
    .unwrap();
    let paper_id = conn.last_insert_rowid();

    let paper = call(&mut conn, "papers.get", json!({ "id": paper_id }));
    let logo = paper["institute"]["logo_url"].as_str().unwrap();
    assert!(logo.starts_with("data:image/png;base64,"));
    assert_eq!(paper["questions"][0]["image_url"], logo);
    assert_eq!(paper["include_answers"], false);
}

fn base64_decode(text: &str) -> Vec<u8> {
    use base64::Engine;
    base64::engine::general_purpose::STANDARD
        .decode(text)
        .expect("valid base64")
}
