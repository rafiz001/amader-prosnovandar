-- Named page-layout presets for the printable paper view. The whole layout
-- object (page size, columns, header toggles, watermark settings) is JSON.

CREATE TABLE layout_presets (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL COLLATE NOCASE UNIQUE,
  data       TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT
);
