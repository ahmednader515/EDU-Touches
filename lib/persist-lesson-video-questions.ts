import {
  createLessonVideoQuestion,
  createLessonVideoQuestionOption,
} from "@/lib/db";
import {
  normalizeLessonVideoQuestionType,
  type LessonVideoQuestionInput,
} from "@/lib/lesson-video-question-utils";

export async function persistLessonVideoQuestions(
  lessonId: string,
  questions: LessonVideoQuestionInput[]
): Promise<void> {
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    if (!q.questionText?.trim()) continue;
    const qType = normalizeLessonVideoQuestionType(q.type);
    const showAt = Math.max(0, Math.floor(Number(q.showAtSeconds) || 0));
    const duration = Math.max(1, Math.floor(Number(q.durationSeconds) || 1));
    const options = q.options ?? [];
    if (qType === "MULTIPLE_CHOICE" && options.filter((o) => o.text?.trim()).length < 2) continue;
    if (qType === "TRUE_FALSE" && options.length < 2) continue;

    const created = await createLessonVideoQuestion({
      lesson_id: lessonId,
      type: qType,
      question_text: q.questionText.trim(),
      show_at_seconds: showAt,
      duration_seconds: duration,
      order: i + 1,
    });

    for (const opt of options) {
      const text = opt.text?.trim() ?? "";
      if (qType === "MULTIPLE_CHOICE" && !text) continue;
      await createLessonVideoQuestionOption({
        question_id: created.id,
        text: qType === "TRUE_FALSE" ? opt.text : text,
        is_correct: !!opt.isCorrect,
      });
    }
  }
}
