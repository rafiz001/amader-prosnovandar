-- SQLite stores TEXT as UTF-8, so Arabic and Bengali are stored natively.

CREATE TABLE files (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  filename   TEXT    NOT NULL,
  mime       TEXT    NOT NULL,
  size       INTEGER NOT NULL,
  data       BLOB    NOT NULL,
  created_at TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE institute (
  id           INTEGER PRIMARY KEY CHECK (id = 1),   -- single row
  name         TEXT NOT NULL DEFAULT '',
  location     TEXT NOT NULL DEFAULT '',
  logo_file_id INTEGER REFERENCES files(id) ON DELETE SET NULL,
  updated_at   TEXT
);
INSERT INTO institute (id) VALUES (1);

CREATE TABLE classes (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  created_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TEXT
);

CREATE TABLE subjects (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  class_id   INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  code       TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT,
  UNIQUE (class_id, name)
);
CREATE INDEX idx_subjects_class ON subjects(class_id);

CREATE TABLE questions (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  subject_id     INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  type           TEXT NOT NULL CHECK (type IN ('mcq','text')),
  text           TEXT NOT NULL DEFAULT '',          -- question text (may contain inline LaTeX, e.g. $x^2$)
  math           TEXT NOT NULL DEFAULT '',          -- optional display-math block (LaTeX)
  image_id       INTEGER REFERENCES files(id) ON DELETE SET NULL,   -- figure
  option_1       TEXT, option_2 TEXT, option_3 TEXT, option_4 TEXT, -- MCQ options (may contain LaTeX)
  correct_option INTEGER CHECK (correct_option BETWEEN 1 AND 4),
  marks          REAL NOT NULL DEFAULT 1 CHECK (marks >= 0),
  difficulty     TEXT NOT NULL DEFAULT 'medium' CHECK (difficulty IN ('easy','medium','hard')),
  lang           TEXT NOT NULL DEFAULT 'en',        -- en | ar | bn | ...
  explanation    TEXT NOT NULL DEFAULT '',
  created_at     TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     TEXT
);
CREATE INDEX idx_questions_subject ON questions(subject_id);
CREATE INDEX idx_questions_filter  ON questions(subject_id, type, difficulty);

CREATE TABLE papers (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  title      TEXT NOT NULL,
  data       TEXT NOT NULL,                          -- JSON snapshot of the generated paper
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
