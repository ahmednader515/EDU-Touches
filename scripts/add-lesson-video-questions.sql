-- Lesson video overlay questions (run once on existing Neon DB)
CREATE TABLE IF NOT EXISTS "LessonVideoQuestion" (
  id                TEXT PRIMARY KEY,
  lesson_id         TEXT NOT NULL REFERENCES "Lesson"(id) ON DELETE CASCADE,
  type              TEXT NOT NULL CHECK (type IN ('MULTIPLE_CHOICE', 'TRUE_FALSE')),
  question_text     TEXT NOT NULL,
  show_at_seconds   INT NOT NULL DEFAULT 0,
  duration_seconds  INT NOT NULL DEFAULT 10,
  "order"           INT NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "LessonVideoQuestion_lesson_id_idx" ON "LessonVideoQuestion"(lesson_id);

CREATE TABLE IF NOT EXISTS "LessonVideoQuestionOption" (
  id          TEXT PRIMARY KEY,
  question_id TEXT NOT NULL REFERENCES "LessonVideoQuestion"(id) ON DELETE CASCADE,
  text        TEXT NOT NULL,
  is_correct  BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "LessonVideoQuestionOption_question_id_idx" ON "LessonVideoQuestionOption"(question_id);
