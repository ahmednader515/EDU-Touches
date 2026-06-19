"use client";

import { useT } from "@/components/LocaleProvider";
import {
  type LessonVideoQuestionType,
} from "@/lib/lesson-video-question-utils";
import { getLessonVideoProvider } from "@/lib/lesson-video";

export type LessonVideoQuestionOptionRow = { text: string; isCorrect: boolean };
export type LessonVideoQuestionRow = {
  type: LessonVideoQuestionType;
  questionText: string;
  showAtMmSs: string;
  durationSeconds: string;
  options: LessonVideoQuestionOptionRow[];
};

type Props = {
  lessonIndex: number;
  videoUrl: string;
  questions: LessonVideoQuestionRow[];
  onAddQuestion: () => void;
  onRemoveQuestion: (qti: number) => void;
  onUpdateQuestion: (qti: number, field: keyof LessonVideoQuestionRow, value: string) => void;
  onSetType: (qti: number, type: LessonVideoQuestionType) => void;
  onAddOption: (qti: number) => void;
  onRemoveOption: (qti: number, oi: number) => void;
  onUpdateOption: (qti: number, oi: number, field: "text" | "isCorrect", value: string | boolean) => void;
  onSetCorrectOption: (qti: number, oi: number) => void;
};

export function LessonVideoQuestionsEditor({
  lessonIndex,
  videoUrl,
  questions,
  onAddQuestion,
  onRemoveQuestion,
  onUpdateQuestion,
  onSetType,
  onAddOption,
  onRemoveOption,
  onUpdateOption,
  onSetCorrectOption,
}: Props) {
  const t = useT();
  const Cf = "dashboard.courseForm";
  const provider = getLessonVideoProvider(videoUrl);

  if (!videoUrl.trim()) return null;

  return (
    <div className="mt-3 rounded border border-dashed border-[var(--color-border)] bg-[var(--color-surface)]/50 p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-medium text-[var(--color-foreground)]">
          {t(`${Cf}.videoQuestionsHeading`)}
        </span>
        <button
          type="button"
          onClick={onAddQuestion}
          className="text-sm text-[var(--color-primary)] hover:underline"
        >
          {t(`${Cf}.addVideoQuestionBtn`)}
        </button>
      </div>
      <p className="mb-2 text-xs text-[var(--color-muted)]">{t(`${Cf}.videoQuestionsIntro`)}</p>
      {provider === "google_drive" && (
        <p className="mb-2 rounded border border-amber-500/40 bg-amber-500/10 px-2 py-1.5 text-xs text-amber-800 dark:text-amber-200">
          {t(`${Cf}.videoQuestionsDriveHint`)}
        </p>
      )}
      {questions.length === 0 ? (
        <p className="text-xs text-[var(--color-muted)]">{t(`${Cf}.videoQuestionsEmpty`)}</p>
      ) : null}
      {questions.map((q, qti) => (
        <div key={qti} className="mb-3 rounded border border-[var(--color-border)] bg-[var(--color-background)] p-3">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-medium">
              {t(`${Cf}.videoQuestionNPrefix`)}
              {qti + 1}
            </span>
            <select
              value={q.type}
              onChange={(e) => onSetType(qti, e.target.value as LessonVideoQuestionType)}
              className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-xs"
            >
              <option value="MULTIPLE_CHOICE">{t(`${Cf}.mcqShort`)}</option>
              <option value="TRUE_FALSE">{t(`${Cf}.tfShort`)}</option>
            </select>
            <button
              type="button"
              onClick={() => onRemoveQuestion(qti)}
              className="text-xs text-red-600 hover:underline"
            >
              {t(`${Cf}.deleteQuestionBtn`)}
            </button>
          </div>
          <textarea
            value={q.questionText}
            onChange={(e) => onUpdateQuestion(qti, "questionText", e.target.value)}
            placeholder={t(`${Cf}.questionTextPlaceholder`)}
            rows={2}
            className="mb-2 w-full rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-sm"
          />
          <div className="mb-2 flex flex-wrap gap-3">
            <label className="text-xs text-[var(--color-muted)]">
              {t(`${Cf}.videoQuestionShowAt`)}
              <input
                type="text"
                value={q.showAtMmSs}
                onChange={(e) => onUpdateQuestion(qti, "showAtMmSs", e.target.value)}
                placeholder="0:00"
                className="mt-0.5 block w-24 rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-sm"
              />
            </label>
            <label className="text-xs text-[var(--color-muted)]">
              {t(`${Cf}.videoQuestionDuration`)}
              <input
                type="number"
                min="1"
                value={q.durationSeconds}
                onChange={(e) => onUpdateQuestion(qti, "durationSeconds", e.target.value)}
                className="mt-0.5 block w-20 rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-sm"
              />
            </label>
          </div>
          <p className="mb-1 text-xs text-[var(--color-muted)]">{t(`${Cf}.videoQuestionShowAtHint`)}</p>
          <div className="space-y-1">
            {q.options.map((opt, oi) => (
              <div key={oi} className="flex items-center gap-2">
                <input
                  type="text"
                  value={opt.text}
                  onChange={(e) => onUpdateOption(qti, oi, "text", e.target.value)}
                  placeholder={
                    q.type === "TRUE_FALSE"
                      ? oi === 0
                        ? t(`${Cf}.tfExampleTrue`)
                        : t(`${Cf}.tfExampleFalse`)
                      : `${t(`${Cf}.optionPlaceholderMcqPrefix`)}${oi + 1}`
                  }
                  className="flex-1 rounded border border-[var(--color-border)] px-2 py-1 text-sm"
                />
                <label className="flex items-center gap-1 text-xs whitespace-nowrap">
                  <input
                    type="radio"
                    name={`lvq-${lessonIndex}-${qti}-correct`}
                    checked={opt.isCorrect}
                    onChange={() => onSetCorrectOption(qti, oi)}
                  />
                  {t(`${Cf}.correctBadge`)}
                </label>
                {q.type === "MULTIPLE_CHOICE" && q.options.length > 1 && (
                  <button type="button" onClick={() => onRemoveOption(qti, oi)} className="text-red-600 text-sm">
                    ×
                  </button>
                )}
              </div>
            ))}
            {q.type === "MULTIPLE_CHOICE" && (
              <button
                type="button"
                onClick={() => onAddOption(qti)}
                className="text-xs text-[var(--color-primary)] hover:underline"
              >
                {t(`${Cf}.addOptionBtn`)}
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export function defaultLessonVideoQuestionRow(
  tfLabels: { trueLabel: string; falseLabel: string }
): LessonVideoQuestionRow {
  return {
    type: "MULTIPLE_CHOICE",
    questionText: "",
    showAtMmSs: "0:00",
    durationSeconds: "10",
    options: [{ text: "", isCorrect: false }],
  };
}

export function defaultLessonVideoQuestionRowTf(
  tfLabels: { trueLabel: string; falseLabel: string }
): LessonVideoQuestionRow {
  return {
    type: "TRUE_FALSE",
    questionText: "",
    showAtMmSs: "0:00",
    durationSeconds: "10",
    options: [
      { text: tfLabels.trueLabel, isCorrect: true },
      { text: tfLabels.falseLabel, isCorrect: false },
    ],
  };
}
