"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import type { QuizApiPayload } from "./QuizPageClient";
import { useT } from "@/components/LocaleProvider";
import {
  decodeMatchPair,
  isAutoGradedType,
  scoreFillInAnswer,
  scoreMatchAnswer,
} from "@/lib/quiz-question-utils";

type QuizQuestion = QuizApiPayload["questions"][number];

function shuffleArray<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function isQuestionAnswered(q: QuizQuestion, answers: Record<string, string>): boolean {
  const a = answers[q.id];
  if (q.type === "ESSAY") return a !== undefined && a.trim() !== "";
  if (q.type === "FILL_IN") return a !== undefined && a.trim() !== "";
  if (q.type === "MATCH") {
    if (!a) return false;
    try {
      const mapping = JSON.parse(a) as Record<string, string>;
      return q.options.every((opt) => !!mapping[opt.id]);
    } catch {
      return false;
    }
  }
  if (q.type === "MULTIPLE_CHOICE" || q.type === "TRUE_FALSE") {
    return a !== undefined && a !== "";
  }
  return true;
}

function scoreQuestion(q: QuizQuestion, answers: Record<string, string>): number {
  const a = answers[q.id];
  if (!isAutoGradedType(q.type)) return 0;
  if (q.type === "MULTIPLE_CHOICE" || q.type === "TRUE_FALSE") {
    const opt = q.options.find((o) => o.id === a);
    return opt?.isCorrect ? 1 : 0;
  }
  if (q.type === "FILL_IN") {
    return scoreFillInAnswer(a ?? "", q.options) ? 1 : 0;
  }
  if (q.type === "MATCH") {
    return scoreMatchAnswer(a ?? "{}", q.options) ? 1 : 0;
  }
  return 0;
}

function questionTypeLabel(q: QuizQuestion, t: (key: string, fallback?: string) => string): string {
  switch (q.type) {
    case "MULTIPLE_CHOICE":
      return t("quiz.multipleChoice", "Multiple choice");
    case "TRUE_FALSE":
      return t("quiz.trueFalse", "True/False");
    case "ESSAY":
      return t("quiz.shortParagraph", "Short paragraph");
    case "FILL_IN":
      return t("quiz.fillIn", "Fill in the blank");
    case "MATCH":
      return t("quiz.match", "Match");
    default:
      return t("quiz.essay", "Essay");
  }
}

function MatchQuestion({
  q,
  answers,
  submitted,
  setAnswer,
}: {
  q: QuizQuestion;
  answers: Record<string, string>;
  submitted: boolean;
  setAnswer: (questionId: string, value: string) => void;
}) {
  const t = useT();
  const rightChoices = useMemo(
    () =>
      shuffleArray(
        q.options
          .map((opt) => {
            const pair = decodeMatchPair(opt.text);
            return pair ? { id: opt.id, label: pair.right } : null;
          })
          .filter((x): x is { id: string; label: string } => x !== null)
      ),
    [q.id, q.options]
  );

  let mapping: Record<string, string> = {};
  try {
    mapping = answers[q.id] ? (JSON.parse(answers[q.id]) as Record<string, string>) : {};
  } catch {
    mapping = {};
  }

  function setMatch(leftId: string, rightOptionId: string) {
    const next = { ...mapping, [leftId]: rightOptionId };
    setAnswer(q.id, JSON.stringify(next));
  }

  return (
    <ul className="mt-4 space-y-3">
      {q.options.map((opt) => {
        const pair = decodeMatchPair(opt.text);
        if (!pair) return null;
        const selectedId = mapping[opt.id] ?? "";
        const isCorrect =
          submitted &&
          selectedId &&
          scoreMatchAnswer(JSON.stringify({ [opt.id]: selectedId }), [opt]);
        return (
          <li key={opt.id} className="flex flex-wrap items-center gap-2">
            <span className="min-w-[8rem] font-medium text-[var(--color-foreground)]">{pair.left}</span>
            <select
              value={selectedId}
              onChange={(e) => setMatch(opt.id, e.target.value)}
              disabled={submitted}
              className="min-w-[10rem] flex-1 rounded border border-[var(--color-border)] bg-[var(--color-background)] px-2 py-2 text-sm"
            >
              <option value="">{t("quiz.matchSelectPlaceholder", "Select a match")}</option>
              {rightChoices.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
            {submitted && isCorrect && (
              <span className="text-sm text-[var(--color-success)]">✓ {t("quiz.correctAnswer", "Correct answer")}</span>
            )}
            {submitted && selectedId && !isCorrect && (
              <span className="text-sm text-red-600">✗</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function QuizTake({ quiz }: { quiz: QuizApiPayload }) {
  const t = useT();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [started, setStarted] = useState(false);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const timeLimitMinutes = quiz.timeLimitMinutes ?? null;
  const totalSeconds =
    timeLimitMinutes != null && Number(timeLimitMinutes) > 0
      ? Math.floor(Number(timeLimitMinutes)) * 60
      : 0;
  const [remainingSeconds, setRemainingSeconds] = useState(totalSeconds);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeUpSubmitStartedRef = useRef(false);
  const answersRef = useRef(answers);
  answersRef.current = answers;

  const canAttempt = quiz.canAttempt !== false;
  const attemptsUsed = typeof quiz.attemptsUsed === "number" ? quiz.attemptsUsed : null;
  const maxQuizAttempts = typeof quiz.maxQuizAttempts === "number" ? quiz.maxQuizAttempts : null;

  function setAnswer(questionId: string, value: string) {
    setAnswers((a) => ({ ...a, [questionId]: value }));
  }

  const allAnswered = quiz.questions.every((q) => isQuestionAnswered(q, answers));

  const totalScored = quiz.questions.filter((q) => isAutoGradedType(q.type)).length;

  function calculateScore(ans: Record<string, string> = answers) {
    return quiz.questions.reduce((sum, q) => sum + scoreQuestion(q, ans), 0);
  }

  const submitAnswers = useCallback(
    async (reason?: "timeup") => {
      const s = reason === "timeup" ? calculateScore(answersRef.current) : calculateScore();
      setSubmitting(true);
      try {
        const res = await fetch(`/api/quizzes/${encodeURIComponent(quiz.id)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ score: s, totalQuestions: totalScored, attemptId }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          alert(data.error ?? t("quiz.saveResultFailed", "Failed to save result"));
          if (reason === "timeup") timeUpSubmitStartedRef.current = false;
          setSubmitting(false);
          return;
        }
        setSubmitted(true);
        if (reason === "timeup") {
          setToastMessage(t("quiz.examTimeEnded", "Time is up"));
        }
      } catch {
        alert(t("quiz.serverConnectionFailed", "Failed to connect to server"));
        if (reason === "timeup") timeUpSubmitStartedRef.current = false;
      } finally {
        setSubmitting(false);
      }
    },
    [attemptId, quiz.id, t, totalScored]
  );

  async function handleStart() {
    if (!canAttempt || starting || started) return;
    setStarting(true);
    try {
      const res = await fetch(`/api/quizzes/${encodeURIComponent(quiz.id)}/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.error ?? t("quiz.cannotStartQuiz", "Unable to start quiz"));
        return;
      }
      const id = typeof data.attemptId === "string" ? data.attemptId : null;
      setAttemptId(id);
      setStarted(true);
    } catch {
      alert(t("quiz.serverConnectionFailed", "Failed to connect to server"));
    } finally {
      setStarting(false);
    }
  }

  async function handleSubmit() {
    if (!allAnswered && remainingSeconds > 0) return;
    await submitAnswers();
  }

  useEffect(() => {
    timeUpSubmitStartedRef.current = false;
    if (!started || submitted || totalSeconds <= 0) return;
    setRemainingSeconds(totalSeconds);
    const id = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(id);
          if (intervalRef.current === id) intervalRef.current = null;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    intervalRef.current = id;
    return () => {
      clearInterval(id);
      if (intervalRef.current === id) intervalRef.current = null;
    };
  }, [started, submitted, totalSeconds]);

  useEffect(() => {
    if (!started || submitted || totalSeconds <= 0 || remainingSeconds > 0) return;
    if (timeUpSubmitStartedRef.current) return;
    timeUpSubmitStartedRef.current = true;
    void submitAnswers("timeup");
  }, [remainingSeconds, started, submitted, submitAnswers, totalSeconds]);

  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => setToastMessage(null), 4000);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  const score = submitted ? calculateScore() : 0;

  const mm = Math.floor(remainingSeconds / 60);
  const ss = remainingSeconds % 60;
  const timeDisplay = `${mm}:${ss.toString().padStart(2, "0")}`;

  const hasEssay = quiz.questions.some((q) => q.type === "ESSAY");

  return (
    <div className="mt-8 space-y-8">
      {toastMessage && (
        <div
          className="fixed left-1/2 top-4 z-50 -translate-x-1/2 rounded-[var(--radius-btn)] border border-amber-500/50 bg-amber-500/15 px-4 py-2 text-sm font-medium text-amber-800 dark:text-amber-200 shadow-lg"
          role="alert"
        >
          {toastMessage}
        </div>
      )}

      {!submitted && started && totalSeconds > 0 && (
        <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3">
          <p className="text-sm font-medium text-[var(--color-foreground)]">
            {t("quiz.remainingTime", "Time left:")}{" "}
            <span className="font-mono text-[var(--color-primary)]">{timeDisplay}</span>
          </p>
        </div>
      )}

      {!started && !submitted ? (
        <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
          <h3 className="text-lg font-semibold text-[var(--color-foreground)]">{t("quiz.readyTitle", "Ready to start the quiz?")}</h3>
          <p className="mt-2 text-sm text-[var(--color-muted)]">
            {t("quiz.readySubtitle", 'When you click "Start quiz", one attempt will be counted.')}
            {maxQuizAttempts != null && attemptsUsed != null ? (
              <span className="mr-1">
                {" "}
                ({t("quiz.usedAttempts", "Used")}: {attemptsUsed} {t("quiz.fromAttempts", "of")} {maxQuizAttempts})
              </span>
            ) : null}
          </p>
          {!canAttempt ? (
            <p className="mt-4 rounded-[var(--radius-btn)] border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-400">
              {t("quiz.cannotAttempt", "You cannot start a new attempt for this quiz due to attempt limits.")}
            </p>
          ) : null}
          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleStart}
              disabled={!canAttempt || starting}
              className="rounded-[var(--radius-btn)] bg-[var(--color-primary)] px-6 py-3 font-medium text-white hover:bg-[var(--color-primary-hover)] disabled:opacity-50"
            >
              {starting ? t("quiz.starting", "Starting...") : t("quiz.start", "Start quiz")}
            </button>
          </div>
        </div>
      ) : null}

      {started
        ? quiz.questions.map((q, i) => (
            <div
              key={q.id}
              className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6"
            >
              <p className="font-medium text-[var(--color-foreground)]">
                {i + 1}. {q.questionText}
              </p>
              <span className="mt-1 block text-xs text-[var(--color-muted)]">{questionTypeLabel(q, t)}</span>
              {q.type === "MULTIPLE_CHOICE" || q.type === "TRUE_FALSE" ? (
                <ul className="mt-4 space-y-2">
                  {q.options.map((opt) => (
                    <li key={opt.id}>
                      <label className="flex cursor-pointer items-center gap-2 rounded border border-[var(--color-border)] p-3 hover:bg-[var(--color-background)]">
                        <input
                          type="radio"
                          name={q.id}
                          value={opt.id}
                          checked={answers[q.id] === opt.id}
                          onChange={() => setAnswer(q.id, opt.id)}
                          disabled={submitted}
                        />
                        <span>{opt.text}</span>
                        {submitted && opt.isCorrect && (
                          <span className="text-sm text-[var(--color-success)]">
                            ✓ {t("quiz.correctAnswer", "Correct answer")}
                          </span>
                        )}
                        {submitted && answers[q.id] === opt.id && !opt.isCorrect && (
                          <span className="text-sm text-red-600">✗</span>
                        )}
                      </label>
                    </li>
                  ))}
                </ul>
              ) : q.type === "FILL_IN" ? (
                <div className="mt-4">
                  <input
                    type="text"
                    value={answers[q.id] ?? ""}
                    onChange={(e) => setAnswer(q.id, e.target.value)}
                    placeholder={t("quiz.fillInPlaceholder", "Type your answer...")}
                    disabled={submitted}
                    className="w-full rounded-[var(--radius-btn)] border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2"
                  />
                  {submitted && (
                    <p className="mt-2 text-sm">
                      {scoreFillInAnswer(answers[q.id] ?? "", q.options) ? (
                        <span className="text-[var(--color-success)]">
                          ✓ {t("quiz.correctAnswer", "Correct answer")}
                        </span>
                      ) : (
                        <span className="text-red-600">✗</span>
                      )}
                    </p>
                  )}
                </div>
              ) : q.type === "MATCH" ? (
                <MatchQuestion q={q} answers={answers} submitted={submitted} setAnswer={setAnswer} />
              ) : (
                <textarea
                  value={answers[q.id] ?? ""}
                  onChange={(e) => setAnswer(q.id, e.target.value)}
                  placeholder={t("quiz.essayPlaceholder", "Write your answer here...")}
                  rows={4}
                  disabled={submitted}
                  className="mt-4 w-full rounded-[var(--radius-btn)] border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2"
                />
              )}
            </div>
          ))
        : null}

      {!submitted && started ? (
        <button
          type="button"
          onClick={handleSubmit}
          disabled={(!allAnswered && remainingSeconds > 0) || submitting}
          className="rounded-[var(--radius-btn)] bg-[var(--color-primary)] px-6 py-3 font-medium text-white hover:bg-[var(--color-primary-hover)] disabled:opacity-50"
        >
          {submitting ? t("quiz.submitting", "Submitting...") : t("quiz.finishAndShowResult", "Finish and show result")}
        </button>
      ) : (
        <div className="rounded-[var(--radius-card)] border border-[var(--color-primary)] bg-[var(--color-primary-light)]/30 p-6">
          <p className="text-lg font-semibold text-[var(--color-foreground)]">
            {t("quiz.resultPrefix", "Your score in auto-graded questions:")} {score} {t("quiz.from", "out of")}{" "}
            {totalScored}
          </p>
          {hasEssay && (
            <p className="mt-2 text-sm text-[var(--color-muted)]">
              {t(
                "quiz.essayNotAutoCorrected",
                "Short paragraph questions are not auto-graded; the teacher can review them later."
              )}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
