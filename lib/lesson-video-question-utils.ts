export type LessonVideoQuestionType = "MULTIPLE_CHOICE" | "TRUE_FALSE";

export type LessonVideoQuestionOptionInput = { text: string; isCorrect: boolean };

export type LessonVideoQuestionInput = {
  type: string;
  questionText: string;
  showAtSeconds: number;
  durationSeconds: number;
  options?: LessonVideoQuestionOptionInput[];
};

/** Parse "m:ss" or "mm:ss" or plain seconds string to integer seconds. */
export function parseTimeToSeconds(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^\d+$/.test(trimmed)) {
    const n = parseInt(trimmed, 10);
    return Number.isFinite(n) && n >= 0 ? n : null;
  }
  const match = trimmed.match(/^(\d+):(\d{1,2})$/);
  if (!match) return null;
  const mins = parseInt(match[1], 10);
  const secs = parseInt(match[2], 10);
  if (!Number.isFinite(mins) || !Number.isFinite(secs) || secs >= 60) return null;
  return mins * 60 + secs;
}

export function formatSecondsToMmSs(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const mm = Math.floor(s / 60);
  const ss = s % 60;
  return `${mm}:${ss.toString().padStart(2, "0")}`;
}

export function normalizeLessonVideoQuestionType(type: string): LessonVideoQuestionType {
  return type === "TRUE_FALSE" ? "TRUE_FALSE" : "MULTIPLE_CHOICE";
}

export function serializeLessonVideoQuestionsForApi(
  questions: LessonVideoQuestionInput[]
): LessonVideoQuestionInput[] {
  return questions
    .filter((q) => q.questionText.trim())
    .map((q) => {
      const qType = normalizeLessonVideoQuestionType(q.type);
      const showAt = Math.max(0, Math.floor(Number(q.showAtSeconds) || 0));
      const duration = Math.max(1, Math.floor(Number(q.durationSeconds) || 1));
      const options = q.options ?? [];
      if (qType === "TRUE_FALSE") {
        return {
          type: qType,
          questionText: q.questionText.trim(),
          showAtSeconds: showAt,
          durationSeconds: duration,
          options: options.length
            ? options.map((o) => ({ text: o.text, isCorrect: o.isCorrect }))
            : undefined,
        };
      }
      return {
        type: qType,
        questionText: q.questionText.trim(),
        showAtSeconds: showAt,
        durationSeconds: duration,
        options: options
          .filter((o) => o.text.trim())
          .map((o) => ({ text: o.text.trim(), isCorrect: o.isCorrect })),
      };
    })
    .filter((q) => {
      if (q.type === "TRUE_FALSE") return (q.options?.length ?? 0) >= 2;
      return (q.options?.length ?? 0) >= 2;
    });
}

export type LessonVideoQuestionPayload = {
  id: string;
  type: LessonVideoQuestionType;
  questionText: string;
  showAtSeconds: number;
  durationSeconds: number;
  order: number;
  options: Array<{ id: string; text: string; isCorrect: boolean }>;
};

export function mapDbVideoQuestionsToPayload(
  rows: Array<Record<string, unknown> & { options?: Record<string, unknown>[] }>
): LessonVideoQuestionPayload[] {
  return rows.map((q, i) => ({
    id: String(q.id),
    type: q.type === "TRUE_FALSE" ? "TRUE_FALSE" : "MULTIPLE_CHOICE",
    questionText: String(q.questionText ?? q.question_text ?? ""),
    showAtSeconds: Number(q.showAtSeconds ?? q.show_at_seconds ?? 0),
    durationSeconds: Number(q.durationSeconds ?? q.duration_seconds ?? 10),
    order: Number(q.order ?? i),
    options: ((q.options ?? []) as Record<string, unknown>[]).map((o) => ({
      id: String(o.id),
      text: String(o.text ?? ""),
      isCorrect: Boolean(o.isCorrect ?? o.is_correct),
    })),
  }));
}
