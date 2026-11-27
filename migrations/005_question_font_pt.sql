-- Per-question absolute font size in points. 0 means "inherit the paper's
-- question font size". The old relative font_scale column is kept for
-- compatibility but no longer used; existing non-default values are converted.

ALTER TABLE questions ADD COLUMN font_pt REAL NOT NULL DEFAULT 0;

UPDATE questions
SET font_pt = ROUND(13.0 * font_scale * 0.75, 1)
WHERE font_scale IS NOT NULL
  AND font_scale > 0
  AND ABS(font_scale - 1.0) > 0.001;
