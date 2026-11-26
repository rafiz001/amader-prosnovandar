-- Per-question typography: a relative font scale and a text alignment.
-- font_scale is a multiplier (1.0 = paper default); align is '' (inherit),
-- or one of left/right/center/justify.

ALTER TABLE questions ADD COLUMN font_scale REAL NOT NULL DEFAULT 1.0;
ALTER TABLE questions ADD COLUMN align TEXT NOT NULL DEFAULT '';
