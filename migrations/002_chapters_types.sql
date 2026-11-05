-- Chapters per subject, dynamic question types per subject, answer + description on questions.
-- Existing questions are converted in place.

CREATE TABLE chapters (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  subject_id  INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  position    INTEGER NOT NULL DEFAULT 0,
  description TEXT NOT NULL DEFAULT '',
  created_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TEXT,
  UNIQUE (subject_id, name)
);
CREATE INDEX idx_chapters_subject ON chapters(subject_id);

-- kind decides the behaviour/validation: mcq (4 options + correct option),
-- true_false (answer true/false), text (plain, optional free-text answer).
-- name is the subject's own label ("Short Question", "Creative", "সৃজনশীল", ...).
CREATE TABLE question_types (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  name       TEXT NOT NULL COLLATE NOCASE,
  kind       TEXT NOT NULL CHECK (kind IN ('mcq','true_false','text')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT,
  UNIQUE (subject_id, name)
);
CREATE INDEX idx_question_types_subject ON question_types(subject_id);

INSERT INTO question_types (subject_id, name, kind) SELECT id, 'MCQ', 'mcq' FROM subjects;
INSERT INTO question_types (subject_id, name, kind) SELECT id, 'True/False', 'true_false' FROM subjects;
INSERT INTO question_types (subject_id, name, kind) SELECT id, 'Plain', 'text' FROM subjects;

-- Rebuild questions: type -> type_id, explanation -> description, + chapter_id, answer.
CREATE TABLE questions_new (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  subject_id     INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  chapter_id     INTEGER REFERENCES chapters(id) ON DELETE SET NULL,
  type_id        INTEGER NOT NULL REFERENCES question_types(id),
  text           TEXT NOT NULL DEFAULT '',
  math           TEXT NOT NULL DEFAULT '',
  image_id       INTEGER REFERENCES files(id) ON DELETE SET NULL,
  option_1       TEXT, option_2 TEXT, option_3 TEXT, option_4 TEXT,
  correct_option INTEGER CHECK (correct_option BETWEEN 1 AND 4),
  answer         TEXT NOT NULL DEFAULT '',   -- mcq: text of the correct option; true_false: 'true'/'false'; text: model answer
  description    TEXT NOT NULL DEFAULT '',   -- explanation / solution / notes
  marks          REAL NOT NULL DEFAULT 1 CHECK (marks >= 0),
  difficulty     TEXT NOT NULL DEFAULT 'medium' CHECK (difficulty IN ('easy','medium','hard')),
  lang           TEXT NOT NULL DEFAULT 'en',
  created_at     TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     TEXT
);

INSERT INTO questions_new
  (id, subject_id, type_id, text, math, image_id, option_1, option_2, option_3, option_4,
   correct_option, answer, description, marks, difficulty, lang, created_at, updated_at)
SELECT q.id, q.subject_id,
  (SELECT t.id FROM question_types t
    WHERE t.subject_id = q.subject_id AND t.kind = CASE q.type WHEN 'mcq' THEN 'mcq' ELSE 'text' END),
  q.text, q.math, q.image_id, q.option_1, q.option_2, q.option_3, q.option_4, q.correct_option,
  COALESCE(CASE q.correct_option WHEN 1 THEN q.option_1 WHEN 2 THEN q.option_2
                                 WHEN 3 THEN q.option_3 WHEN 4 THEN q.option_4 END, ''),
  q.explanation, q.marks, q.difficulty, q.lang, q.created_at, q.updated_at
FROM questions q;

DROP TABLE questions;
ALTER TABLE questions_new RENAME TO questions;
CREATE INDEX idx_questions_subject ON questions(subject_id);
CREATE INDEX idx_questions_chapter ON questions(chapter_id);
CREATE INDEX idx_questions_type    ON questions(type_id);
CREATE INDEX idx_questions_filter  ON questions(subject_id, difficulty);
