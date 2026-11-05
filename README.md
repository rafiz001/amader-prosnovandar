# Question Bank Backend (Go + SQLite)

Go rewrite of the Express backend, with the same REST API. UTF-8 end to end (Arabic, Bengali, any
Unicode); text is NFC-normalised on write. Routing uses only the standard library (Go 1.22 `net/http`).

## Requirements
- Go 1.22+
- A C compiler (gcc/clang): `mattn/go-sqlite3` uses cgo

## Run
    go mod tidy          # first time only: downloads deps and writes go.sum
    go run .             # applies migrations automatically
    go run . -migrate    # apply migrations and exit
    make build           # -> bin/questionbank (one binary; migrations are embedded via go:embed)
Env: `PORT` (3000), `DB_PATH` (./data/questionbank.sqlite). Add migrations as `migrations/00N_name.sql`.

## Layout
    main.go                routes, middleware (CORS, logging, panic recovery), startup, graceful shutdown
    db.go                  SQLite open + embedded migration runner
    util.go                errors, JSON helpers, NFC cleaning, request parsing (JSON / multipart / form)
    questions.go           question validation per kind, storage, API shape, files, institute
    filters.go             chapter/type/kind/difficulty filters shared by listing and generation
    handlers_meta.go       chapters and question types
    handlers_basic.go      institute, files, classes, subjects
    handlers_questions.go  question CRUD + filtered list
    handlers_generate.go   paper generation + saved papers
    transfer.go            portable document build/import (JSON/YAML/SQLite share one path)
    handlers_transfer.go   export/import endpoints
    frontend.go            serves the static frontend folder
    docs.go                serves openapi.json (embedded) at /api/openapi.json
    openapi.json           OpenAPI 3.0 description of the whole API

## Static frontend
Put your built `index.html`, CSS and JS in a `frontend/` folder **next to the binary** and the server serves it at `/`
(the API stays under `/api`). Release layout:

    questionbank.exe        (or ./questionbank)
    frontend/
        index.html
        assets/...

The folder is looked up in this order: `FRONTEND_DIR` env var, `<folder of the executable>/frontend`
(so it works no matter where you launch the binary from), then `./frontend` (for `go run .`).
It is read from disk at runtime, so you can replace frontend files without rebuilding.
- Paths with no file extension that match no file return `index.html` (client-side routing);
  missing assets such as `/missing.js` return 404.
- Directory listings and dotfiles (`.env`, `.git`) are never served; `.js` is always served as JavaScript,
  even on Windows machines with a broken registry MIME entry.
- Call the API with relative URLs (`fetch('/api/classes')`); same origin, so no CORS issues.
- If no folder is found the server logs it and serves only the API.

## API documentation (OpenAPI / Swagger)
`openapi.json` describes every endpoint (38 operations), with request/response schemas and Bengali/Arabic examples.
- The running server serves it at `GET /api/openapi.json` (it is compiled into the binary, so edit the file and rebuild).
- Open it in Swagger UI / Swagger Editor, Redoc, Postman or Insomnia (import by file or URL), or generate a client from it.
- Swagger UI itself loads its assets from the internet; for fully offline use, import the file into Postman/Insomnia
  or serve a local copy of Swagger UI yourself.

## API (all under /api)
| Area | Endpoints |
|---|---|
| Institute | `GET/PUT /institute` (name, location) · `PUT /institute/logo` (multipart `logo`) · `DELETE /institute/logo` |
| Classes | `GET/POST /classes` · `GET/PUT/DELETE /classes/:id` |
| Subjects | `GET/POST /classes/:classId/subjects` · `GET/PUT/DELETE /subjects/:id` |
| Chapters | `GET/POST /subjects/:subjectId/chapters` · `GET/PUT/DELETE /chapters/:id` |
| Question types | `GET/POST /subjects/:subjectId/question-types` · `GET/PUT/DELETE /question-types/:id` |
| Questions | `GET/POST /subjects/:subjectId/questions` · `GET/PUT/DELETE /questions/:id` · `GET /files/:id` |
| Generate | `POST /generate` · `GET /papers` · `GET/DELETE /papers/:id` |
| Transfer | `GET /export?format=json\|yml\|sqlite` · `POST /import?mode=merge\|replace` (multipart `file`, or raw JSON body) |

### Chapters
Per subject: `name` (unique in the subject), `position` (ordering; defaults to last), `description`.
Deleting a chapter keeps its questions; they just lose the chapter.

### Question types (dynamic, per subject)
Each subject owns its list of types. A type has a `name` you choose (`"Short Question"`, `"সৃজনশীল"`, ...)
and a `kind` that decides how its questions behave:

| kind | question needs | answer |
|---|---|---|
| `mcq` | exactly 4 `options` + `correct_option` (1-4) | the correct option's text (filled in automatically) |
| `true_false` | `answer` = `true`/`false` (also accepts yes/no, সত্য/মিথ্যা, صح/خطأ) | `"true"` / `"false"` |
| `text` (plain) | nothing extra | optional free-text model `answer` |

New subjects start with `MCQ`, `True/False` and `Plain`; rename, add or delete them freely. A type that still
has questions cannot be deleted or change kind (409).

### Questions
`type_id` (or `type` = a type name, or a kind like `"mcq"` for the subject's first type of that kind),
`chapter_id` (optional, must belong to the same subject; `null` clears it), `text`, `math` (LaTeX), `image`
(multipart figure), `options`, `correct_option`, **`answer`**, **`description`** (explanation/solution; the old name
`explanation` is still accepted), `marks`, `difficulty`, `lang`.
Responses include `type_id`, `type`, `kind`, `chapter_id`, `chapter_name`, `answer`, `description`.
A question cannot be moved to another subject.

List filters (all accept comma-separated lists): `?chapter_id=1,2,none` `?type_id=3,4` `?kind=mcq,true_false`
`?type=Short` (name or kind) `?difficulty=` `?lang=` `?q=search` `?limit=&offset=`.

### Generate
    POST /api/generate
    { "title": "Mid-term", "subject_id": 1,            // or "class_id"
      "question_ids": [3, 7],                          // hand-picked, optional
      "random": {
        "chapter_ids": [1, 2, "none"],                 // pool filters, each takes one value or a list
        "type_ids": [3, 4], "kinds": ["mcq"], "types": ["Short"],
        "difficulty": ["easy","medium"], "lang": "bn",
        // how many: exactly ONE of
        "count": 10,                                   // total from the pool
        "by_type": {"MCQ": 8, "5": 2},                 // per type (key = type id, type name or kind)
        "by_chapter": {"1": 5, "2": 5},                // per chapter (key = chapter id or "none")
        "allow_fewer": false },
      "shuffle_questions": true, "shuffle_options": true, "include_answers": false, "save": false, "meta": {} }
Examples: *8 MCQ + 2 plain from chapters 1 and 2* = `chapter_ids:[1,2]` + `by_type:{"MCQ":8,"Plain":2}`;
*5 MCQ from each of three chapters* = `kinds:["mcq"]` + `by_chapter:{"1":5,"2":5,"3":5}`.
Random picks never repeat a question or a hand-picked one. Without `include_answers`, answers, correct options and
descriptions are left out of the paper; with it you also get an `answer_key` for mcq/true_false questions.

### Export / import
JSON/YAML use a nested, id-independent format (version 2: chapters, question types, answers, descriptions;
images embedded as base64). SQLite export is a full copy. Import accepts all three (format auto-detected) and
also **version 1 files** from before this update (JSON/YAML with `type: "mcq"|"text"` and `explanation`, or an
old SQLite export, which is upgraded on the fly). `merge` adds missing items and skips exact duplicates;
`replace` wipes classes/subjects/questions first. Imports are atomic. Saved papers are not imported.

## Upgrading an existing database
Just start the new binary: migration `002_chapters_types.sql` converts the database in place. Every subject gets the
three default types, each existing question is linked to the matching one, MCQ `answer`s are filled in from the
correct option, and `explanation` becomes `description`. Back up the `.sqlite` file first if the data matters.

## Differences from the Node version
- Uploaded image types are detected from file content (PNG/JPEG/GIF/WebP), not the client-sent type.
- For non-MCQ questions, `correct_option` is omitted from the JSON instead of being `null`.
- Migrations are compiled into the binary, so no separate bundling step is needed.
