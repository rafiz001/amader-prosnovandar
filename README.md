# Question Bank (Rust + SQLite + React + Tauri)

Full-stack question bank for schools. All application logic is Rust; the React admin UI is the
app screen. There is **no HTTP server and no REST API**: the same Rust core is called through
Tauri commands on desktop/mobile and through WebAssembly in the browser.

[![CI](https://github.com/rafiz001/amader-prosnovandar/actions/workflows/ci.yml/badge.svg)](https://github.com/rafiz001/amader-prosnovandar/actions/workflows/ci.yml)

- **Core** — `crates/core`: SQLite storage, validation, filtering, paper generation and
  JSON/YAML/SQLite import-export. Compiled for every target.
- **Desktop & mobile** — `src-tauri`: Tauri 2 shell. One command, `api_call`, bridges the UI to
  the core. The database is a normal SQLite file in the OS app-data folder.
- **Web** — `crates/wasm`: `wasm-bindgen` shell. SQLite runs in the browser via
  `sqlite-wasm-rs`; the database image is snapshotted into IndexedDB after each change.
- **Frontend** — React 18 + Vite 5 + Tailwind CSS 3 admin SPA (Bengali UI, hash routing).

## Live web app and CI

The browser build is published to GitHub Pages on every push to `main`:

**https://rafiz001.github.io/amader-prosnovandar/**

`.github/workflows/ci.yml` runs on every push and pull request:

- Rust tests, `cargo fmt --check`, and clippy for the core and the WASM shell.
- The browser build; on `main` it is deployed to GitHub Pages.
- Desktop artifacts for **Windows x64** and **Linux x64**, containing both the installer (NSIS
  `.exe` / AppImage) and the raw executable. Every run keeps them under **Artifacts**
  (`desktop-windows-x64`, `desktop-linux-x64`). Windows may show a SmartScreen prompt because the
  files are unsigned. The Linux build needs WebKitGTK 4.1 and GTK 3 at runtime; Windows uses the
  system WebView2.
- **GitHub Releases** — pushing a version tag builds the Windows NSIS installer (`.exe`) and the
  Linux AppImage, then creates/updates a release with them plus the raw executables. The tag is
  also used as the bundle version.

    git tag v2.0.0
    git push origin v2.0.0

One-time setup (required): **Settings → Pages → Build and deployment → Source: GitHub Actions**.
`GITHUB_TOKEN` cannot create the Pages site — that API needs repository admin — so the owner has to
enable it once from the repository settings. After that, pushes to `main` deploy automatically;
re-run the failed workflow once. The workflow sets `VITE_BASE=/<repository>/` for Pages, so local
and desktop builds keep the normal root base.

## Requirements

- Rust 1.89+ (`rustup`, with the `wasm32-unknown-unknown` target for the web build)
- Node 18+ and npm
- Tauri system dependencies (Linux desktop): `libwebkit2gtk-4.1-dev`, `libgtk-3-dev`,
  `libayatana-appindicator3-dev`, `librsvg2-dev`, `libxdo-dev`, `libssl-dev`, plus
  `build-essential` and `pkg-config`.
- Mobile (optional): the Android SDK/NDK or Xcode, as required by Tauri 2.

If `cargo` is not on your shell's `PATH`, the Makefile and the npm scripts add
`~/.cargo/bin` automatically (rustup installs toolchains there). You can also run
`. "$HOME/.cargo/env"` once in your shell.

The SQLite driver is compiled from source (`rusqlite` bundled / `sqlite-wasm-rs` on the web),
so no separate SQLite installation is needed.

## Quick start

    make install        # Tauri CLI + frontend dependencies
    make dev            # desktop app with hot reload

Build a desktop bundle (deb/AppImage/msi/dmg depending on the host):

    make desktop        # -> src-tauri/target/release/bundle/

Build the browser app:

    make web            # -> frontend/dist (WASM module is built first)

Serve `frontend/dist` with any static file server, for example:

    cd frontend && npm run preview

## Commands

| Command | What it does |
|---|---|
| `make dev` / `npm run dev` | Run the Tauri desktop app in development |
| `make desktop` / `npm run build` | Build the desktop bundles |
| `make web` | Build the WebAssembly module and the static browser app |
| `make test` | Run the Rust core tests (SQLite CRUD, generation, transfer) |
| `make check` | `cargo check` for native and `wasm32-unknown-unknown` |
| `make desktop-check` | Type-check the Tauri shell (needs the system libraries) |
| `make wasm` | Build only the release WebAssembly package |

Tauri mobile:

    npm run tauri android init
    npm run tauri android dev
    npm run tauri ios init        # macOS only
    npm run tauri ios dev

## Where the data lives

- **Desktop/mobile**: `<app-data-dir>/questionbank.sqlite` (created on first run). Set
  `QUESTIONBANK_DB=/path/to/file.sqlite` to override it. Existing databases from the old Go
  build are compatible; migrations are compiled into the binary and applied automatically.
- **Browser**: the SQLite image is stored in IndexedDB and restored on startup. The database is
  namespaced by the first URL path segment (for GitHub Pages:
  `questionbank-amader-prosnovandar`; locally: `questionbank-root`) so several project sites on
  the same origin do not share data. Clearing site data resets the browser app; use export/import
  to move data between browser and desktop.

## Screens

- **Institute** — name, location, logo (PNG/JPEG/GIF/WebP, max 5 MB).
- **Classes** — list/create/edit/delete classes; open a class to manage its subjects.
- **Class** — subjects, each with question/chapter/type counts.
- **Subject** — tabs for **Questions** (filter, search, paginate, create/edit with an image,
  Markdown + KaTeX), **Chapters**, and **Question types** (name + kind; types in use are locked).
- **Generate** — pick questions manually, shuffle questions/options, include answers, and save.
  Saving is enabled by default, so every generated paper is stored immediately.
- **Papers** — saved papers with an editable, printable paper view and answer key. Click
  **সম্পাদনা** on the preview to edit the title, institute line, duration, question text/math,
  options, correct option, answers, descriptions, marks and figures in place. Changes are saved
  automatically. **উত্তর দেখান** shows or hides the answers, descriptions and answer key without
  deleting them from the stored paper.
- **Backup** — take a full SQLite backup (every class, question, image and saved paper) or a
  class-wise JSON backup, then restore either file. A full backup replaces the database; a class
  backup is merged by class name.

Question text, answers and solutions are Markdown (GFM). Inline `$...$` / `$$...$$` math and the
display-math field are rendered with KaTeX. Arabic-script languages render right-to-left.

## Architecture

    crates/core/          shared Rust logic (no UI, no HTTP)
      src/db.rs           SQLite open, embedded migrations, serialization
      src/questions.rs    per-kind validation, storage, JSON shape, files, institute
      src/filters.rs      chapter/type/kind/difficulty/language filters
      src/meta.rs         chapters and question types
      src/basic.rs        institute, files, classes, subjects
      src/generate.rs     paper generation and saved papers
      src/transfer.rs     portable document, import/export (JSON/YAML/SQLite)
      src/service.rs      `call(op, payload)` dispatcher (the whole API surface)
      tests/flows.rs      end-to-end core tests
    crates/wasm/          wasm-bindgen shell + IndexedDB persistence
    src-tauri/            Tauri 2 desktop/mobile shell (`api_call` command)
    frontend/             React admin UI; `src/lib/api.js` selects Tauri or WASM
    migrations/           compiled into the Rust core
    scripts/make_icons.py regenerates the Tauri icon set

### The call surface

The UI calls operations such as `classes.list`, `questions.create`, `generate`,
`papers.get`, `export`, `import`, `backup.export` and `backup.restore`. The payload is a plain
JSON object; each call returns JSON.
Errors carry `{ status, message }`, so the UI keeps the same status-based behaviour as before.
Saved papers can be updated with `papers.update` (`{ id, paper }`); this is what the editable
preview uses. A stored paper always keeps answers and descriptions so it can be edited later —
`include_answers` only controls whether they are shown and printed.

Uploads (question figures, the institute logo) are sent as base64 inside the payload. Images are
sniffed from their bytes, not the declared type. Image URLs in responses are `data:` URLs, so no
file-serving endpoint is needed.

### Import / export

`API.transfer.exportFile({ format: 'json' | 'yml' | 'sqlite', include_files })` returns
`{ filename, mime, data_base64 }`; `API.transfer.importFile({ data_base64, filename, format,
mode: 'merge' | 'replace' })` imports JSON, YAML or SQLite. The JSON/YAML document is the same
id-independent version-2 format as before (chapters, question types, answers, descriptions,
base64 images); version-1 documents are still accepted. Imports are atomic.

### Backup / restore

`API.backup.exportFull()` returns a full SQLite image; `API.backup.exportClass(classId)` returns a
portable version-2 JSON document containing one class (without the institute profile).
`API.backup.restore({ data_base64, filename })` restores either file. Full SQLite backups replace
every table, including saved papers; class backups are always merged by class name and never touch
the rest of the database. On desktop the backup is written to the Downloads folder; in the browser
it is downloaded normally.

## Differences from the Go version

- No REST API and no static file server: the UI runs inside Tauri or as a WASM app.
- The browser build keeps the database in IndexedDB instead of a file.
- `export?format=sqlite` returns a serialized SQLite image (works in both shells) rather than
  `VACUUM INTO`.
- Responses embed images as `data:` URLs instead of `/api/files/:id` links.
- Everything else (schema, validation rules, generation semantics, import/export format) is
  preserved.
