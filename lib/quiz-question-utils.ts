/** Delimiter for MATCH pair storage in QuestionOption.text */
export const MATCH_PAIR_DELIMITER = "|||";

export type QuizQuestionType =
  | "MULTIPLE_CHOICE"
  | "ESSAY"
  | "TRUE_FALSE"
  | "FILL_IN"
  | "MATCH";

export function encodeMatchPair(left: string, right: string): string {
  return `${left.trim()}${MATCH_PAIR_DELIMITER}${right.trim()}`;
}

export function decodeMatchPair(text: string): { left: string; right: string } | null {
  const idx = text.indexOf(MATCH_PAIR_DELIMITER);
  if (idx < 0) return null;
  const left = text.slice(0, idx).trim();
  const right = text.slice(idx + MATCH_PAIR_DELIMITER.length).trim();
  if (!left || !right) return null;
  return { left, right };
}

export function normalizeFillInAnswer(value: string): string {
  return value.trim().toLowerCase();
}

export function isAutoGradedType(type: string): boolean {
  return (
    type === "MULTIPLE_CHOICE" ||
    type === "TRUE_FALSE" ||
    type === "FILL_IN" ||
    type === "MATCH"
  );
}

export function normalizeQuestionType(type: string): QuizQuestionType {
  if (
    type === "ESSAY" ||
    type === "TRUE_FALSE" ||
    type === "FILL_IN" ||
    type === "MATCH"
  ) {
    return type;
  }
  return "MULTIPLE_CHOICE";
}

export type QuestionOptionInput = { text: string; isCorrect: boolean };
export type QuestionInput = {
  type: string;
  questionText: string;
  options?: QuestionOptionInput[];
};

export async function createOptionsForQuestion(
  createQuestionOption: (data: {
    question_id: string;
    text: string;
    is_correct: boolean;
  }) => Promise<unknown>,
  questionId: string,
  qt: QuestionInput
): Promise<void> {
  const qType = normalizeQuestionType(qt.type);
  if (qType === "ESSAY" || !Array.isArray(qt.options)) return;

  if (qType === "FILL_IN") {
    const correct =
      qt.options.find((o) => o.isCorrect && o.text?.trim()) ??
      qt.options.find((o) => o.text?.trim());
    const text = correct?.text?.trim();
    if (text) {
      await createQuestionOption({
        question_id: questionId,
        text,
        is_correct: true,
      });
    }
    return;
  }

  if (qType === "MATCH") {
    for (const opt of qt.options) {
      const text = opt.text?.trim() ?? "";
      if (text && decodeMatchPair(text)) {
        await createQuestionOption({
          question_id: questionId,
          text,
          is_correct: true,
        });
      }
    }
    return;
  }

  for (const opt of qt.options) {
    await createQuestionOption({
      question_id: questionId,
      text: opt.text?.trim() || "",
      is_correct: !!opt.isCorrect,
    });
  }
}

export function defaultQuestionOptions(
  type: QuizQuestionType,
  tfLabels: { trueLabel: string; falseLabel: string }
): QuestionOptionInput[] {
  switch (type) {
    case "TRUE_FALSE":
      return [
        { text: tfLabels.trueLabel, isCorrect: true },
        { text: tfLabels.falseLabel, isCorrect: false },
      ];
    case "FILL_IN":
      return [{ text: "", isCorrect: true }];
    case "MATCH":
      return [
        { text: encodeMatchPair("", ""), isCorrect: true },
        { text: encodeMatchPair("", ""), isCorrect: true },
      ];
    case "ESSAY":
      return [];
    default:
      return [{ text: "", isCorrect: false }];
  }
}

export function serializeQuestionOptionsForApi(
  qt: QuestionInput
): QuestionOptionInput[] | undefined {
  const qType = normalizeQuestionType(qt.type);
  if (qType === "ESSAY") return undefined;
  const options = qt.options ?? [];
  if (qType === "MULTIPLE_CHOICE") {
    return options
      .filter((o) => o.text.trim())
      .map((o) => ({ text: o.text.trim(), isCorrect: o.isCorrect }));
  }
  if (qType === "TRUE_FALSE") {
    return options.map((o) => ({ text: o.text, isCorrect: o.isCorrect }));
  }
  if (qType === "FILL_IN") {
    const ans = options.find((o) => o.text?.trim())?.text?.trim();
    return ans ? [{ text: ans, isCorrect: true }] : undefined;
  }
  if (qType === "MATCH") {
    const pairs = options
      .map((o) => o.text?.trim() ?? "")
      .filter((text) => decodeMatchPair(text));
    return pairs.length >= 2
      ? pairs.map((text) => ({ text, isCorrect: true }))
      : undefined;
  }
  return undefined;
}

export function scoreFillInAnswer(
  studentAnswer: string,
  options: Array<{ text: string; isCorrect?: boolean }>
): boolean {
  const correct =
    options.find((o) => o.isCorrect && o.text?.trim())?.text ??
    options[0]?.text;
  if (!correct?.trim()) return false;
  return (
    normalizeFillInAnswer(studentAnswer) === normalizeFillInAnswer(correct)
  );
}

export function scoreMatchAnswer(
  studentAnswerJson: string,
  options: Array<{ id: string; text: string }>
): boolean {
  if (!options.length) return false;
  let mapping: Record<string, string>;
  try {
    mapping = JSON.parse(studentAnswerJson) as Record<string, string>;
  } catch {
    return false;
  }
  for (const opt of options) {
    const pair = decodeMatchPair(opt.text);
    if (!pair) return false;
    const selectedId = mapping[opt.id];
    if (!selectedId) return false;
    const selected = options.find((o) => o.id === selectedId);
    const selectedPair = selected ? decodeMatchPair(selected.text) : null;
    if (!selectedPair || selectedPair.right !== pair.right) return false;
  }
  return true;
}

export function updateMatchPairText(
  text: string,
  side: "left" | "right",
  value: string
): string {
  const pair = decodeMatchPair(text) ?? { left: "", right: "" };
  if (side === "left") return encodeMatchPair(value, pair.right);
  return encodeMatchPair(pair.left, value);
}
