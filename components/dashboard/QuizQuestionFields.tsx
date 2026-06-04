"use client";

import { useT } from "@/components/LocaleProvider";
import {
  decodeMatchPair,
  updateMatchPairText,
  type QuizQuestionType,
} from "@/lib/quiz-question-utils";

export type QuestionOptionRow = { text: string; isCorrect: boolean };
export type QuestionRow = {
  type: QuizQuestionType;
  questionText: string;
  options: QuestionOptionRow[];
};

type Props = {
  qi: number;
  qti: number;
  q: QuestionRow;
  quizQuestionCount: number;
  onSetType: (type: QuizQuestionType) => void;
  onUpdateQuestionText: (text: string) => void;
  onRemoveQuestion: () => void;
  onAddOption: () => void;
  onRemoveOption: (oi: number) => void;
  onUpdateOption: (oi: number, field: "text" | "isCorrect", value: string | boolean) => void;
  onSetCorrectOption: (oi: number) => void;
  onAddMatchPair: () => void;
};

export function QuizQuestionFields({
  qi,
  qti,
  q,
  quizQuestionCount,
  onSetType,
  onUpdateQuestionText,
  onRemoveQuestion,
  onAddOption,
  onRemoveOption,
  onUpdateOption,
  onSetCorrectOption,
  onAddMatchPair,
}: Props) {
  const t = useT();
  const Cf = "dashboard.courseForm";

  return (
    <div className="mb-4 rounded border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-medium">
          {t(`${Cf}.questionNPrefix`)}
          {qti + 1}
        </span>
        <select
          value={q.type}
          onChange={(e) => onSetType(e.target.value as QuizQuestionType)}
          className="rounded border border-[var(--color-border)] bg-[var(--color-background)] px-2 py-1 text-sm"
        >
          <option value="MULTIPLE_CHOICE">{t(`${Cf}.mcqShort`)}</option>
          <option value="TRUE_FALSE">{t(`${Cf}.tfShort`)}</option>
          <option value="ESSAY">{t(`${Cf}.essayShort`)}</option>
          <option value="FILL_IN">{t(`${Cf}.fillInShort`)}</option>
          <option value="MATCH">{t(`${Cf}.matchShort`)}</option>
        </select>
        {quizQuestionCount > 1 && (
          <button type="button" onClick={onRemoveQuestion} className="text-sm text-red-600 hover:underline">
            {t(`${Cf}.deleteQuestionBtn`)}
          </button>
        )}
      </div>
      <textarea
        value={q.questionText}
        onChange={(e) => onUpdateQuestionText(e.target.value)}
        placeholder={t(`${Cf}.questionTextPlaceholder`)}
        rows={2}
        className="mb-2 w-full rounded border border-[var(--color-border)] bg-[var(--color-background)] px-2 py-1 text-sm"
      />
      {(q.type === "MULTIPLE_CHOICE" || q.type === "TRUE_FALSE") && (
        <div className="space-y-1">
          <p className="text-xs text-[var(--color-muted)]">
            {q.type === "TRUE_FALSE" ? t(`${Cf}.tfAnswerHintLine`) : t(`${Cf}.mcqOptionsHint`)}
          </p>
          {q.options.map((opt, oi) => (
            <div key={oi} className="flex items-center gap-2">
              <input
                type="text"
                value={opt.text}
                onChange={(e) => onUpdateOption(oi, "text", e.target.value)}
                placeholder={
                  q.type === "TRUE_FALSE"
                    ? oi === 0
                      ? t(`${Cf}.tfExampleTrue`)
                      : t(`${Cf}.tfExampleFalse`)
                    : `${t(`${Cf}.optionPlaceholderMcqPrefix`)}${oi + 1}`
                }
                className="flex-1 rounded border border-[var(--color-border)] px-2 py-1 text-sm"
              />
              <label className="flex items-center gap-1 text-sm whitespace-nowrap">
                <input
                  type="radio"
                  name={`q-${qi}-${qti}-correct`}
                  checked={opt.isCorrect}
                  onChange={() => onSetCorrectOption(oi)}
                />
                {t(`${Cf}.correctBadge`)}
              </label>
              {q.type === "MULTIPLE_CHOICE" && q.options.length > 1 && (
                <button type="button" onClick={() => onRemoveOption(oi)} className="text-red-600 text-sm">
                  ×
                </button>
              )}
            </div>
          ))}
          {q.type === "MULTIPLE_CHOICE" && (
            <button type="button" onClick={onAddOption} className="text-sm text-[var(--color-primary)] hover:underline">
              {t(`${Cf}.addOptionBtn`)}
            </button>
          )}
        </div>
      )}
      {q.type === "FILL_IN" && (
        <div className="space-y-1">
          <p className="text-xs text-[var(--color-muted)]">{t(`${Cf}.fillInHint`)}</p>
          <input
            type="text"
            value={q.options[0]?.text ?? ""}
            onChange={(e) => onUpdateOption(0, "text", e.target.value)}
            placeholder={t(`${Cf}.fillInAnswerPlaceholder`)}
            className="w-full rounded border border-[var(--color-border)] px-2 py-1 text-sm"
          />
        </div>
      )}
      {q.type === "MATCH" && (
        <div className="space-y-1">
          <p className="text-xs text-[var(--color-muted)]">{t(`${Cf}.matchHint`)}</p>
          {q.options.map((opt, oi) => {
            const pair = decodeMatchPair(opt.text) ?? { left: "", right: "" };
            return (
              <div key={oi} className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  value={pair.left}
                  onChange={(e) =>
                    onUpdateOption(oi, "text", updateMatchPairText(opt.text, "left", e.target.value))
                  }
                  placeholder={t(`${Cf}.matchLeftPlaceholder`)}
                  className="min-w-0 flex-1 rounded border border-[var(--color-border)] px-2 py-1 text-sm"
                />
                <span className="text-[var(--color-muted)]">→</span>
                <input
                  type="text"
                  value={pair.right}
                  onChange={(e) =>
                    onUpdateOption(oi, "text", updateMatchPairText(opt.text, "right", e.target.value))
                  }
                  placeholder={t(`${Cf}.matchRightPlaceholder`)}
                  className="min-w-0 flex-1 rounded border border-[var(--color-border)] px-2 py-1 text-sm"
                />
                {q.options.length > 2 && (
                  <button type="button" onClick={() => onRemoveOption(oi)} className="text-red-600 text-sm">
                    ×
                  </button>
                )}
              </div>
            );
          })}
          <button type="button" onClick={onAddMatchPair} className="text-sm text-[var(--color-primary)] hover:underline">
            {t(`${Cf}.addMatchPairBtn`)}
          </button>
        </div>
      )}
    </div>
  );
}
