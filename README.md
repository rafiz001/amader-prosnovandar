# Question Bank (Go + SQLite + React)

Full-stack question bank for schools: a Go REST API (SQLite, standard-library routing) and a React admin
UI in `frontend/`. UTF-8 end to end (Bengali, Arabic, any Unicode); text is NFC-normalised on write.
The API is a Go rewrite of the original Express backend, with the same routes.

- **Backend** — Go 1.22 `net/http`, `mattn/go-sqlite3`, embedded migrations; also serves the built frontend.
- **Frontend** — React 18 + Vite 5 + Tailwind CSS 3 admin SPA (no router library; in-memory navigation).

## Requirements
- Go 1.22+
- A C compiler (gcc/clang): `mattn/go-sqlite3` uses cgo
- Node 18+ and npm — only needed to develop or rebuild the frontend

## Quick start (one server, production-like)
    make build           # -> bin/questionbank (migrations and openapi.json are embedded via go:embed)
    ./bin/questionbank   # applies migrations automatically
Open <http://localhost:3000>. The server serves the SPA from `frontend/dist` and the API under `/api`.
`frontend/dist` is committed, so this works without Node; rebuild it after changing frontend source (below).

Other commands:
    go run .             # same, without building a binary
    go run . -migrate    # apply migrations and exit
    make run             # go run .
    make migrate         # go run . -migrate
    make tidy            # go mod tidy (first time only, if go.sum is missing)

Env: `PORT` (3000), `DB_PATH` (./data/questionbank.sqlite), `FRONTEND_DIR` (see below).
Add migrations as `migrations/00N_name.sql`.

## Frontend development (Vite dev server + Go API)
Run the API and Vite in two terminals:

    # terminal 1 — API
    PORT=8080 go run .

    # terminal 2 — Vite with hot reload
    cd frontend
    npm install
    npm run dev          # http://localhost:5173

Vite proxies `/api` and `/health` to `VITE_API_TARGET`, default `http://localhost:8080`, which is why the API
is started on `PORT=8080` above. If you prefer the API's default port, run `VITE_API_TARGET=http://localhost:3000 npm run dev`.

Build the static bundle that the Go server serves:
    cd frontend
    npm run build        # writes frontend/dist/
    npm run preview      # optional: serve the built bundle alone (no /api proxy)

Re-run `npm run build` after frontend changes; the Go binary does not need rebuilding.

## Configuration
| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `3000` | HTTP port for the API and the served frontend |
| `DB_PATH` | `./data/questionbank.sqlite` | SQLite database file (created if missing) |
| `FRONTEND_DIR` | auto-detected | Folder containing the built frontend (`index.html` + `assets/`) |

## Frontend

Screens (sidebar):
- **Institute** — name, location, logo (PNG/JPEG/GIF/WebP, max 5 MB) shown on generated papers.
- **Classes** — list/create/edit/delete classes; open a class to manage its subjects.
- **Class** — subjects of a class, each with question/chapter/type counts.
- **Subject** — tabs for **Questions** (filter by kind/difficulty, search, pagination, create/edit with image,
  a Markdown editor with live preview, a KaTeX math editor, and per-kind answer fields), **Chapters**, and
  **Question types** (name + kind; types in use are locked).
- **Generate** — pick questions manually from a filtered, paginated list (click a question to select it; the
  selection is kept across pages); a selection bar shows the count and total marks; shuffle questions/options;
  include answers; save the paper; duration in minutes.
- **Papers** — saved papers with a paper view and a **Print** button (browser print dialog).

Question text, answers and solutions are Markdown (GFM): headings, lists, quotes, code, links, tables and
hard line breaks. Inline math written as `$...$` / `$$...$$` and the "display math" field (raw LaTeX) are
rendered with KaTeX in the question list and on generated papers. The editors have a live preview, and the
math editor adds a symbol palette for common LaTeX. Question text can be Bengali, Arabic or any script;
Arabic-script languages render right-to-left.
Import/export have **no UI yet** — use the API endpoints below (Swagger UI, curl, or
`frontend/src/lib/api.js` as a client reference).

Layout:
    frontend/
      index.html            app shell (fonts: Inter, Noto Sans Bengali, Noto Naskh Arabic)
      vite.config.js        dev server on 5173, /api and /health proxy to VITE_API_TARGET
      tailwind.config.js    theme, fonts, shadows, animations
      postcss.config.js
      src/
        main.jsx            React root
        App.jsx             layout, sidebar/topbar, in-memory navigation stack
        index.css           Tailwind entry, RTL helpers, Markdown/KaTeX styles, print rules
        pages/              Institute, Classes, Class, Subject, Generate, Papers
        components/
          layout/           Sidebar, Topbar, Breadcrumbs, Brand
          ui/               Button, Card, Modal, ConfirmDialog, Form, Badge, states
          subject/          ChaptersTab, TypesTab, QuestionsTab
          questions/        QuestionEditor, QuestionRow, QuestionPicker, QuestionPickerRow
          markdown/         Markdown, MarkdownEditor, MathEditor, MathTex (KaTeX)
          paper/            PaperView (printable paper + answer key)
        lib/api.js          fetch wrapper and the whole API surface
        lib/constants.js    kinds, difficulties, nav items
        lib/utils.js        cn, num, dates, RTL detection
        hooks/useResource.js    small load/reload hook
        context/            navigation and toast providers
      dist/                 committed build output served by the Go binary

Notes:
- API calls are relative (`fetch('/api/...')`), so the app is same-origin in production and proxied in dev.
- Navigation is an in-memory stack, not URL routes, so there are no deep links; refreshing returns to the
  Institute page. The Go server still falls back to `index.html` for extensionless paths.
- `node_modules/` is gitignored; `dist/` inside `frontend/` is tracked on purpose.

## How the Go server serves the frontend
`frontend.go` looks for the folder holding `index.html` in this order:
`FRONTEND_DIR`, `<folder of the executable>/frontend/dist`, then `./frontend/dist` (so `go run .` works).
Release layout:

    questionbank.exe        (or ./questionbank)
    frontend/
        dist/
            index.html
            assets/...

- Files are read from disk at runtime, so you can replace the build without recompiling the Go binary.
- Paths with no file extension that match no file return `index.html`; missing assets such as `/missing.js` return 404.
- Directory listings and dotfiles (`.env`, `.git`) are never served; `.js` is always served as JavaScript,
  even on Windows machines with a broken registry MIME entry.
- If no folder is found the server logs it and serves only the API.

## Layout (backend)
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
    frontend.go            finds and serves the built frontend folder
    docs.go                serves openapi.json (embedded) at /api/openapi.json
    openapi.json           OpenAPI 3.0 description of the whole API
    migrations/            001_init.sql, 002_chapters_types.sql
    data/                  default SQLite location (gitignored)

## API documentation (OpenAPI / Swagger)
`openapi.json` describes every endpoint (38 operations), with request/response schemas and Bengali/Arabic examples.
- The running server serves it at `GET /api/openapi.json` (it is compiled into the binary, so edit the file and rebuild).
- Open it in Swagger UI / Swagger Editor, Redoc, Postman or Insomnia (import by file or URL), or generate a client from it.
- Swagger UI itself loads its assets from the internet; for fully offline use, import the file into Postman/Insomnia
  or serve a local copy of Swagger UI yourself.
- `GET /health` returns `{"ok":true}`.

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

    curl -OJ 'http://localhost:3000/api/export?format=json'
    curl -F file=@questions.json 'http://localhost:3000/api/import?mode=merge'

## Upgrading an existing database
Just start the new binary: migration `002_chapters_types.sql` converts the database in place. Every subject gets the
three default types, each existing question is linked to the matching one, MCQ `answer`s are filled in from the
correct option, and `explanation` becomes `description`. Back up the `.sqlite` file first if the data matters.

## Differences from the Node version
- Uploaded image types are detected from file content (PNG/JPEG/GIF/WebP), not the client-sent type.
- For non-MCQ questions, `correct_option` is omitted from the JSON instead of being `null`.
- Migrations are compiled into the binary, so no separate bundling step is needed.
- The admin UI ships in this repo (`frontend/`) and is served by the same Go process.
