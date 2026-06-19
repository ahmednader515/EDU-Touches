"use client";

import { useEffect, useState } from "react";
import { useT } from "@/components/LocaleProvider";
import { fillMessage } from "@/lib/i18n/interpolate";
import { formatSecondsToMmSs } from "@/lib/lesson-video-question-utils";
import type { LessonVideoQuestionPayload } from "@/lib/lesson-video-question-utils";

type Props = {
  question: LessonVideoQuestionPayload;
  onDismiss: () => void;
};

export function VideoQuestionOverlay({ question, onDismiss }: Props) {
  const t = useT();
  const totalSeconds = Math.max(1, question.durationSeconds);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(totalSeconds);
  const selectedOpt = question.options.find((o) => o.id === selectedId);

  useEffect(() => {
    setSecondsLeft(totalSeconds);
    const id = window.setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          window.clearInterval(id);
          onDismiss();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [question.id, totalSeconds, onDismiss]);

  const timeLabel = formatSecondsToMmSs(secondsLeft);
  const progressPct = Math.max(0, Math.min(100, (secondsLeft / totalSeconds) * 100));

  return (
    <div
      className="lesson-video-question-overlay absolute inset-0 z-[100] flex items-center justify-center bg-black/80 p-4"
      role="dialog"
      aria-modal="true"
      aria-live="polite"
    >
      <div className="pointer-events-auto max-h-[90%] w-full max-w-lg overflow-y-auto rounded-[var(--radius-card)] border border-white/10 bg-[var(--color-surface)] p-5 shadow-2xl">
        <div
          className="mb-3 h-1 overflow-hidden rounded-full bg-[var(--color-border)]"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={totalSeconds}
          aria-valuenow={secondsLeft}
          aria-label={fillMessage(t("lesson.videoQuestions.closesIn", "Closes in {time}"), { time: timeLabel })}
        >
          <div
            className="h-full rounded-full bg-[var(--color-primary)] transition-[width] duration-1000 ease-linear"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-medium text-[var(--color-muted)]">
            {question.type === "TRUE_FALSE"
              ? t("lesson.videoQuestions.trueFalse", "True/False")
              : t("lesson.videoQuestions.multipleChoice", "Multiple choice")}
          </p>
          <p className="text-xs font-semibold tabular-nums text-[var(--color-primary)]">
            {fillMessage(t("lesson.videoQuestions.closesIn", "Closes in {time}"), { time: timeLabel })}
          </p>
        </div>
        <p className="mb-4 text-base font-semibold text-[var(--color-foreground)]">{question.questionText}</p>
        <ul className="space-y-2">
          {question.options.map((opt) => {
            const isSelected = selectedId === opt.id;
            return (
              <li key={opt.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(opt.id)}
                  className={`w-full rounded-lg border px-4 py-3 text-start text-sm transition-colors ${
                    isSelected
                      ? opt.isCorrect
                        ? "border-[var(--color-success)] bg-[var(--color-success)]/15"
                        : "border-red-500 bg-red-500/15"
                      : "border-[var(--color-border)] bg-[var(--color-background)] hover:border-[var(--color-primary)]/50"
                  }`}
                >
                  <span>{opt.text}</span>
                  {isSelected && opt.isCorrect && (
                    <span className="ms-2 text-xs text-[var(--color-success)]">
                      ✓ {t("quiz.correctAnswer", "Correct answer")}
                    </span>
                  )}
                  {isSelected && !opt.isCorrect && <span className="ms-2 text-xs text-red-500">✗</span>}
                </button>
              </li>
            );
          })}
        </ul>
        {selectedOpt && !selectedOpt.isCorrect && (
          <p className="mt-3 text-xs text-[var(--color-muted)]">
            {t("lesson.videoQuestions.tryAgain", "You can try another option while the question is visible.")}
          </p>
        )}
        <button
          type="button"
          onClick={onDismiss}
          className="mt-5 w-full rounded-[var(--radius-btn)] bg-[var(--color-primary)] px-4 py-2.5 text-sm font-medium text-white hover:bg-[var(--color-primary-hover)]"
        >
          {t("lesson.videoQuestions.continue", "Continue watching")}
        </button>
      </div>
    </div>
  );
}
