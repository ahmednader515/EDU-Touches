-- Add FILL_IN and MATCH question types (run once on existing Neon DB)
ALTER TABLE "Question" DROP CONSTRAINT IF EXISTS "Question_type_check";
ALTER TABLE "Question" ADD CONSTRAINT "Question_type_check"
  CHECK (type IN ('MULTIPLE_CHOICE', 'ESSAY', 'TRUE_FALSE', 'FILL_IN', 'MATCH'));
