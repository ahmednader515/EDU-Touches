"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/components/LocaleProvider";
import { CourseFormSaveOverlay } from "../../CourseFormSaveOverlay";
import {
  QuizQuestionFields,
  type QuestionRow,
} from "@/components/dashboard/QuizQuestionFields";
import {
  defaultQuestionOptions,
  encodeMatchPair,
  normalizeQuestionType,
  serializeQuestionOptionsForApi,
  type QuizQuestionType,
} from "@/lib/quiz-question-utils";
import { isValidLessonVideoUrl } from "@/lib/lesson-video";
import {
  LessonVideoQuestionsEditor,
  defaultLessonVideoQuestionRow,
  defaultLessonVideoQuestionRowTf,
  type LessonVideoQuestionRow,
} from "@/components/dashboard/LessonVideoQuestionsEditor";
import {
  parseTimeToSeconds,
  serializeLessonVideoQuestionsForApi,
} from "@/lib/lesson-video-question-utils";

type CategoryOption = { id: string; name: string; nameAr?: string | null };
type LessonRow = {
  title: string;
  videoUrl: string;
  content: string;
  pdfUrl: string;
  acceptsHomework: boolean;
  videoQuestions: LessonVideoQuestionRow[];
};
type QuizRow = { title: string; timeLimitMinutes: string; questions: QuestionRow[] };

export type ContentOrderEntry = { type: "lesson"; index: number } | { type: "quiz"; index: number };

type InitialQuestionRow = {
  type: string;
  questionText: string;
  options?: { text: string; isCorrect: boolean }[];
};
type InitialQuizRow = { title: string; timeLimitMinutes?: number | null; questions: InitialQuestionRow[] };

type InitialData = {
  id: string;
  titleAr: string;
  titleEn: string;
  descriptionAr: string;
  descriptionEn: string;
  shortDescAr: string;
  shortDescEn: string;
  imageUrl: string;
  price: string;
  isPublished: boolean;
  maxQuizAttempts: number | null;
  categoryId: string;
  lessons: Array<LessonRow & { videoQuestions?: LessonVideoQuestionRow[] }>;
  quizzes: InitialQuizRow[];
  contentOrder: ContentOrderEntry[];
};

const defaultLesson: LessonRow = {
  title: "",
  videoUrl: "",
  content: "",
  pdfUrl: "",
  acceptsHomework: false,
  videoQuestions: [],
};
const defaultQuiz: QuizRow = { title: "", timeLimitMinutes: "", questions: [{ type: "MULTIPLE_CHOICE", questionText: "", options: [{ text: "", isCorrect: false }] }] };

export function EditCourseForm({ courseId, initialData }: { courseId: string; initialData: InitialData }) {
  const router = useRouter();
  const t = useT();
  const Cf = "dashboard.courseForm";
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [form, setForm] = useState({
    titleAr: initialData.titleAr,
    titleEn: initialData.titleEn,
    descriptionAr: initialData.descriptionAr,
    descriptionEn: initialData.descriptionEn,
    shortDescAr: initialData.shortDescAr,
    shortDescEn: initialData.shortDescEn,
    imageUrl: initialData.imageUrl,
    price: initialData.price,
    isPublished: initialData.isPublished,
    maxQuizAttempts: initialData.maxQuizAttempts != null ? String(initialData.maxQuizAttempts) : "",
    categoryId: initialData.categoryId ?? "",
    categoryNameAr: "",
    categoryNameEn: "",
  });
  const [lessons, setLessons] = useState<LessonRow[]>(
    initialData.lessons.length > 0
      ? initialData.lessons.map((l) => {
          const r = l as Record<string, unknown>;
          return {
            title: String(l.title ?? ""),
            videoUrl: String(l.videoUrl ?? ""),
            content: String(l.content ?? ""),
            pdfUrl: String(l.pdfUrl ?? ""),
            acceptsHomework: Boolean(r.acceptsHomework ?? r.accepts_homework ?? false),
            videoQuestions: Array.isArray(l.videoQuestions) ? l.videoQuestions : [],
          };
        })
      : [defaultLesson]
  );

  const loadCategories = () => {
    fetch("/api/categories")
      .then((r) => r.json())
      .then((data) => Array.isArray(data) && setCategories(data))
      .catch(() => {});
  };

  useEffect(() => {
    loadCategories();
  }, []);

  const [deletingCategoryId, setDeletingCategoryId] = useState<string | null>(null);
  async function handleDeleteCategory(catId: string) {
    if (!confirm(t(`${Cf}.confirmDeleteCategory`))) return;
    setDeletingCategoryId(catId);
    try {
      const res = await fetch(`/api/categories/${encodeURIComponent(catId)}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.error ?? t(`${Cf}.deleteCategoryFailed`));
        return;
      }
      if (form.categoryId === catId) setForm((f) => ({ ...f, categoryId: "" }));
      loadCategories();
    } finally {
      setDeletingCategoryId(null);
    }
  }

  const [quizzes, setQuizzes] = useState<QuizRow[]>(
    initialData.quizzes.length > 0
      ? initialData.quizzes.map((q) => ({
          title: q.title,
          timeLimitMinutes: q.timeLimitMinutes != null ? String(q.timeLimitMinutes) : "",
          questions: q.questions.length > 0
            ? q.questions.map((qt) => {
                const type = normalizeQuestionType(qt.type);
                const options =
                  qt.options?.length
                    ? qt.options
                    : defaultQuestionOptions(type, {
                        trueLabel: t(`${Cf}.trueOption`),
                        falseLabel: t(`${Cf}.falseOption`),
                      });
                return { type, questionText: qt.questionText, options };
              })
            : [{ type: "MULTIPLE_CHOICE" as const, questionText: "", options: [{ text: "", isCorrect: false }] }],
        }))
      : [defaultQuiz]
  );
  const [contentOrder, setContentOrder] = useState<ContentOrderEntry[]>(() => {
    const co = initialData.contentOrder;
    if (co?.length) return co;
    return [
      ...initialData.lessons.map((_, i) => ({ type: "lesson" as const, index: i })),
      ...initialData.quizzes.map((_, i) => ({ type: "quiz" as const, index: i })),
    ];
  });
  const [imageUploading, setImageUploading] = useState(false);
  const [imageUploadError, setImageUploadError] = useState("");
  const [pdfUploading, setPdfUploading] = useState<number | null>(null);

  function addLesson() {
    setLessons((l) => [...l, { ...defaultLesson }]);
    setContentOrder((c) => [...c, { type: "lesson", index: c.filter((x) => x.type === "lesson").length }]);
  }
  function removeLesson(i: number) {
    setLessons((l) => l.filter((_, idx) => idx !== i));
    setContentOrder((c) =>
      c
        .filter((e) => !(e.type === "lesson" && e.index === i))
        .map((e) => (e.type === "lesson" && e.index > i ? { ...e, index: e.index - 1 } : e))
    );
  }
  function updateLesson(i: number, field: keyof LessonRow, value: string | boolean) {
    setLessons((l) => l.map((x, idx) => (idx === i ? { ...x, [field]: value } : x)));
  }

  function addLessonVideoQuestion(li: number) {
    setLessons((l) =>
      l.map((x, i) =>
        i === li
          ? {
              ...x,
              videoQuestions: [
                ...x.videoQuestions,
                defaultLessonVideoQuestionRow({
                  trueLabel: t(`${Cf}.trueOption`),
                  falseLabel: t(`${Cf}.falseOption`),
                }),
              ],
            }
          : x
      )
    );
  }
  function removeLessonVideoQuestion(li: number, qti: number) {
    setLessons((l) =>
      l.map((x, i) =>
        i === li ? { ...x, videoQuestions: x.videoQuestions.filter((_, j) => j !== qti) } : x
      )
    );
  }
  function updateLessonVideoQuestion(li: number, qti: number, field: keyof LessonVideoQuestionRow, value: string) {
    setLessons((l) =>
      l.map((x, i) =>
        i === li
          ? {
              ...x,
              videoQuestions: x.videoQuestions.map((q, j) => (j === qti ? { ...q, [field]: value } : q)),
            }
          : x
      )
    );
  }
  function setLessonVideoQuestionType(li: number, qti: number, type: LessonVideoQuestionRow["type"]) {
    const tf = { trueLabel: t(`${Cf}.trueOption`), falseLabel: t(`${Cf}.falseOption`) };
    setLessons((l) =>
      l.map((x, i) =>
        i === li
          ? {
              ...x,
              videoQuestions: x.videoQuestions.map((q, j) =>
                j === qti
                  ? type === "TRUE_FALSE"
                    ? { ...defaultLessonVideoQuestionRowTf(tf), questionText: q.questionText, showAtMmSs: q.showAtMmSs, durationSeconds: q.durationSeconds }
                    : { ...defaultLessonVideoQuestionRow(tf), questionText: q.questionText, showAtMmSs: q.showAtMmSs, durationSeconds: q.durationSeconds }
                  : q
              ),
            }
          : x
      )
    );
  }
  function addLessonVideoQuestionOption(li: number, qti: number) {
    setLessons((l) =>
      l.map((x, i) =>
        i === li
          ? {
              ...x,
              videoQuestions: x.videoQuestions.map((q, j) =>
                j === qti ? { ...q, options: [...q.options, { text: "", isCorrect: false }] } : q
              ),
            }
          : x
      )
    );
  }
  function removeLessonVideoQuestionOption(li: number, qti: number, oi: number) {
    setLessons((l) =>
      l.map((x, i) =>
        i === li
          ? {
              ...x,
              videoQuestions: x.videoQuestions.map((q, j) =>
                j === qti ? { ...q, options: q.options.filter((_, o) => o !== oi) } : q
              ),
            }
          : x
      )
    );
  }
  function updateLessonVideoQuestionOption(
    li: number,
    qti: number,
    oi: number,
    field: "text" | "isCorrect",
    value: string | boolean
  ) {
    setLessons((l) =>
      l.map((x, i) =>
        i === li
          ? {
              ...x,
              videoQuestions: x.videoQuestions.map((q, j) =>
                j === qti
                  ? { ...q, options: q.options.map((o, oi2) => (oi2 === oi ? { ...o, [field]: value } : o)) }
                  : q
              ),
            }
          : x
      )
    );
  }
  function setLessonVideoQuestionCorrectOption(li: number, qti: number, oi: number) {
    setLessons((l) =>
      l.map((x, i) =>
        i === li
          ? {
              ...x,
              videoQuestions: x.videoQuestions.map((q, j) =>
                j === qti
                  ? { ...q, options: q.options.map((o, oi2) => ({ ...o, isCorrect: oi2 === oi })) }
                  : q
              ),
            }
          : x
      )
    );
  }

  function addQuiz() {
    setQuizzes((q) => [...q, { ...defaultQuiz }]);
    setContentOrder((c) => [...c, { type: "quiz", index: c.filter((x) => x.type === "quiz").length }]);
  }
  function removeQuiz(qi: number) {
    setQuizzes((q) => q.filter((_, i) => i !== qi));
    setContentOrder((c) =>
      c
        .filter((e) => !(e.type === "quiz" && e.index === qi))
        .map((e) => (e.type === "quiz" && e.index > qi ? { ...e, index: e.index - 1 } : e))
    );
  }
  function updateQuizTitle(qi: number, title: string) {
    setQuizzes((q) => q.map((x, i) => (i === qi ? { ...x, title } : x)));
  }
  function updateQuizTimeLimit(qi: number, value: string) {
    setQuizzes((q) => q.map((x, i) => (i === qi ? { ...x, timeLimitMinutes: value } : x)));
  }
  function addQuestion(qi: number) {
    setQuizzes((q) =>
      q.map((x, i) =>
        i === qi ? { ...x, questions: [...x.questions, { type: "MULTIPLE_CHOICE" as const, questionText: "", options: [{ text: "", isCorrect: false }] }] } : x
      )
    );
  }
  function removeQuestion(qi: number, qti: number) {
    setQuizzes((q) => q.map((x, i) => (i === qi ? { ...x, questions: x.questions.filter((_, j) => j !== qti) } : x)));
  }
  function updateQuestion(qi: number, qti: number, field: "type" | "questionText", value: string) {
    setQuizzes((q) =>
      q.map((x, i) =>
        i === qi ? { ...x, questions: x.questions.map((qt, j) => (j === qti ? { ...qt, [field]: value } : qt)) } : x
      )
    );
  }
  function setQuestionType(qi: number, qti: number, type: QuizQuestionType) {
    setQuizzes((q) =>
      q.map((x, i) =>
        i === qi
          ? {
              ...x,
              questions: x.questions.map((qt, j) =>
                j === qti
                  ? {
                      ...qt,
                      type,
                      options: defaultQuestionOptions(type, {
                        trueLabel: t(`${Cf}.trueOption`),
                        falseLabel: t(`${Cf}.falseOption`),
                      }),
                    }
                  : qt
              ),
            }
          : x
      )
    );
  }
  function addMatchPair(qi: number, qti: number) {
    setQuizzes((q) =>
      q.map((x, i) =>
        i === qi
          ? {
              ...x,
              questions: x.questions.map((qt, j) =>
                j === qti
                  ? {
                      ...qt,
                      options: [...qt.options, { text: encodeMatchPair("", ""), isCorrect: true }],
                    }
                  : qt
              ),
            }
          : x
      )
    );
  }
  function setCorrectOption(qi: number, qti: number, oi: number) {
    setQuizzes((prev) =>
      prev.map((qu, i) =>
        i === qi
          ? {
              ...qu,
              questions: qu.questions.map((qt, j) =>
                j === qti
                  ? { ...qt, options: qt.options.map((o, oi2) => ({ ...o, isCorrect: oi2 === oi })) }
                  : qt
              ),
            }
          : qu
      )
    );
  }
  function addOption(qi: number, qti: number) {
    setQuizzes((q) =>
      q.map((x, i) =>
        i === qi ? { ...x, questions: x.questions.map((qt, j) => (j === qti ? { ...qt, options: [...qt.options, { text: "", isCorrect: false }] } : qt)) } : x
      )
    );
  }
  function removeOption(qi: number, qti: number, oi: number) {
    setQuizzes((q) =>
      q.map((x, i) =>
        i === qi ? { ...x, questions: x.questions.map((qt, j) => (j === qti ? { ...qt, options: qt.options.filter((_, o) => o !== oi) } : qt)) } : x
      )
    );
  }
  function updateOption(qi: number, qti: number, oi: number, field: "text" | "isCorrect", value: string | boolean) {
    setQuizzes((q) =>
      q.map((x, i) =>
        i === qi
          ? {
              ...x,
              questions: x.questions.map((qt, j) =>
                j === qti ? { ...qt, options: qt.options.map((o, oi2) => (oi2 === oi ? { ...o, [field]: value } : o)) } : qt
              ),
            }
          : x
      )
    );
  }

  function moveContentOrder(fromIndex: number, direction: "up" | "down") {
    const toIndex = direction === "up" ? fromIndex - 1 : fromIndex + 1;
    if (toIndex < 0 || toIndex >= contentOrder.length) return;
    setContentOrder((c) => {
      const next = [...c];
      const t = next[fromIndex];
      next[fromIndex] = next[toIndex];
      next[toIndex] = t;
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
    const invalidVideoLesson = lessons.findIndex(
      (l) => l.videoUrl.trim() && !isValidLessonVideoUrl(l.videoUrl)
    );
    if (invalidVideoLesson >= 0) {
      setError(t(`${Cf}.invalidVideoUrl`));
      return;
    }

    const validLessons = lessons.filter((l) => l.title.trim());
    const validQuizzes = quizzes
      .filter((q) => q.title.trim())
      .filter((q) => q.questions.some((qt) => qt.questionText.trim()) && q.questions.filter((qt) => qt.questionText.trim()).length > 0)
      .map((q) => ({
        title: q.title.trim(),
        timeLimitMinutes: (() => {
          const n = parseInt(q.timeLimitMinutes, 10);
          return Number.isFinite(n) && n >= 1 ? n : undefined;
        })(),
        questions: q.questions
          .filter((qt) => qt.questionText.trim())
          .map((qt) => ({
            type: qt.type,
            questionText: qt.questionText.trim(),
            options: serializeQuestionOptionsForApi(qt),
          })),
      }));
    const validLessonIndices = lessons.map((l, i) => (l.title.trim() ? i : -1)).filter((i) => i >= 0);
    const validQuizIndices = quizzes
      .map((q, i) => (q.title.trim() && q.questions.some((qt) => qt.questionText.trim()) ? i : -1))
      .filter((i) => i >= 0);
    const filteredContentOrder = contentOrder
      .filter(
        (e) =>
          (e.type === "lesson" && validLessonIndices.includes(e.index)) || (e.type === "quiz" && validQuizIndices.includes(e.index))
      )
      .map((e) =>
        e.type === "lesson"
          ? { type: "lesson" as const, index: validLessonIndices.indexOf(e.index) }
          : { type: "quiz" as const, index: validQuizIndices.indexOf(e.index) }
      );

    const payload = {
      titleAr: form.titleAr.trim(),
      titleEn: form.titleEn.trim(),
      descriptionAr: form.descriptionAr.trim(),
      descriptionEn: form.descriptionEn.trim(),
      shortDescAr: form.shortDescAr.trim() || undefined,
      shortDescEn: form.shortDescEn.trim() || undefined,
      imageUrl: form.imageUrl.trim() || undefined,
      price: form.price ? parseFloat(form.price) : 0,
      isPublished: form.isPublished,
      maxQuizAttempts: form.maxQuizAttempts.trim() ? parseInt(form.maxQuizAttempts, 10) : null,
      ...(form.categoryNameAr.trim() || form.categoryNameEn.trim()
        ? { categoryNameAr: form.categoryNameAr.trim(), categoryNameEn: form.categoryNameEn.trim() }
        : form.categoryId ? { categoryId: form.categoryId } : { categoryId: null }),
      lessons: validLessons.map((l) => ({
        title: l.title.trim(),
        videoUrl: l.videoUrl.trim() || undefined,
        content: l.content.trim() || undefined,
        pdfUrl: l.pdfUrl.trim() || undefined,
        acceptsHomework: l.acceptsHomework,
        videoQuestions: serializeLessonVideoQuestionsForApi(
          l.videoQuestions.map((q) => ({
            type: q.type,
            questionText: q.questionText,
            showAtSeconds: parseTimeToSeconds(q.showAtMmSs) ?? 0,
            durationSeconds: parseInt(q.durationSeconds, 10) || 10,
            options: q.options,
          }))
        ),
      })),
      quizzes: validQuizzes,
      contentOrder: filteredContentOrder,
    };
    const res = await fetch(`/api/dashboard/courses/${courseId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? t(`${Cf}.saveEditFailed`));
      return;
    }
    router.push("/dashboard/courses");
    router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 max-w-3xl space-y-8">
      <CourseFormSaveOverlay
        open={loading}
        title={t(`${Cf}.editingOverlayTitle`)}
        subtitle={t(`${Cf}.editingOverlaySubtitle`)}
      />
      {error && (
        <div className="rounded-[var(--radius-btn)] bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      <section className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
        <h3 className="mb-4 text-lg font-semibold text-[var(--color-foreground)]">{t(`${Cf}.sectionCourseBasics`)}</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[var(--color-foreground)]">{t(`${Cf}.courseImageLabel`)}</label>
            {form.imageUrl && (
              <div className="mt-2 flex items-start gap-2">
                <img src={form.imageUrl} alt={t(`${Cf}.previewAlt`)} className="h-24 w-40 rounded-[var(--radius-btn)] border border-[var(--color-border)] object-cover" />
                <button type="button" onClick={() => setForm((f) => ({ ...f, imageUrl: "" }))} className="text-sm text-red-600 hover:underline">{t(`${Cf}.remove`)}</button>
              </div>
            )}
            <div className="mt-2 flex flex-wrap gap-2">
              <label className="cursor-pointer rounded-[var(--radius-btn)] border border-[var(--color-border)] bg-[var(--color-background)] px-4 py-2 text-sm font-medium transition hover:bg-[var(--color-border)]/50">
                {imageUploading ? t(`${Cf}.uploadingImage`) : t(`${Cf}.chooseImageUpload`)}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  disabled={imageUploading}
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    setImageUploadError("");
                    setImageUploading(true);
                    try {
                      const fd = new FormData();
                      fd.set("file", f);
                      const res = await fetch("/api/upload/image", { method: "POST", body: fd });
                      const data = await res.json().catch(() => ({}));
                      if (res.ok && data.url) setForm((prev) => ({ ...prev, imageUrl: data.url }));
                      else setImageUploadError(data.error || t(`${Cf}.uploadFailedDetail`));
                    } catch {
                      setImageUploadError(t(`${Cf}.connectionFailedUpload`));
                    } finally {
                      setImageUploading(false);
                      e.target.value = "";
                    }
                  }}
                />
              </label>
            </div>
            {imageUploadError && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{imageUploadError}</p>}
            <input
              type="url"
              value={form.imageUrl}
              onChange={(e) => { setForm((f) => ({ ...f, imageUrl: e.target.value })); setImageUploadError(""); }}
              placeholder={t(`${Cf}.imageUrlPlaceholder`)}
              className="mt-2 w-full rounded-[var(--radius-btn)] border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--color-foreground)]">{t(`${Cf}.categoryOptional`)}</label>
            <p className="mt-1 text-xs text-[var(--color-muted)]">{t(`${Cf}.categoryHelpChooseOrNew`)}</p>
            <select
              value={form.categoryNameAr.trim() || form.categoryNameEn.trim() ? "" : form.categoryId}
              onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value, categoryNameAr: "", categoryNameEn: "" }))}
              className="mt-1 w-full rounded-[var(--radius-btn)] border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2"
            >
              <option value="">{t(`${Cf}.noCategoryOption`)}</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.nameAr ?? cat.name}
                </option>
              ))}
            </select>
            <div className="mt-2">
              <label className="block text-xs text-[var(--color-muted)]">{t(`${Cf}.newCategoryBilingualHint`)}</label>
              <input
                type="text"
                value={form.categoryNameAr}
                onChange={(e) => setForm((f) => ({ ...f, categoryNameAr: e.target.value, categoryId: "" }))}
                placeholder={t(`${Cf}.newCategoryArabicPlaceholder`)}
                className="mt-1 w-full rounded-[var(--radius-btn)] border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm"
              />
              <input
                type="text"
                value={form.categoryNameEn}
                onChange={(e) => setForm((f) => ({ ...f, categoryNameEn: e.target.value, categoryId: "" }))}
                placeholder={t(`${Cf}.newCategoryEnglishLabel`)}
                className="mt-1 w-full rounded-[var(--radius-btn)] border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm"
              />
            </div>
            {categories.length > 0 && (
              <div className="mt-3">
                <p className="mb-2 text-xs font-medium text-[var(--color-muted)]">{t(`${Cf}.deleteExistingSection`)}</p>
                <ul className="space-y-1.5">
                  {categories.map((cat) => (
                    <li key={cat.id} className="flex items-center justify-between gap-2 rounded-[var(--radius-btn)] border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm">
                      <span className="text-[var(--color-foreground)]">{cat.nameAr ?? cat.name}</span>
                      <button
                        type="button"
                        onClick={() => handleDeleteCategory(cat.id)}
                        disabled={deletingCategoryId === cat.id}
                        className="rounded border border-red-500/50 bg-red-500/10 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-500/20 disabled:opacity-50"
                      >
                        {deletingCategoryId === cat.id ? t(`${Cf}.deletingBtn`) : t(`${Cf}.deleteBtn`)}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--color-foreground)]">{t(`${Cf}.priceEgpLabel`)}</label>
            <input type="number" step="0.01" min="0" value={form.price} onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))} className="mt-1 w-full rounded-[var(--radius-btn)] border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--color-foreground)]">{t(`${Cf}.quizAttemptsHint`)}</label>
            <input type="number" min="1" placeholder={t(`${Cf}.unlimitedPlaceholderLine`)} value={form.maxQuizAttempts} onChange={(e) => setForm((f) => ({ ...f, maxQuizAttempts: e.target.value }))} className="mt-1 w-full rounded-[var(--radius-btn)] border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2" />
            <p className="mt-1 text-xs text-[var(--color-muted)]">{t(`${Cf}.quizAttemptsExplanation`)}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--color-foreground)]">{t(`${Cf}.titleArRequired`)}</label>
            <input type="text" value={form.titleAr} onChange={(e) => setForm((f) => ({ ...f, titleAr: e.target.value }))} className="mt-1 w-full rounded-[var(--radius-btn)] border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--color-foreground)]">{t(`${Cf}.titleEnRequired`)}</label>
            <input type="text" value={form.titleEn} onChange={(e) => setForm((f) => ({ ...f, titleEn: e.target.value }))} className="mt-1 w-full rounded-[var(--radius-btn)] border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--color-foreground)]">{t(`${Cf}.shortDescAr`)}</label>
            <input type="text" maxLength={300} value={form.shortDescAr} onChange={(e) => setForm((f) => ({ ...f, shortDescAr: e.target.value }))} className="mt-1 w-full rounded-[var(--radius-btn)] border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--color-foreground)]">{t(`${Cf}.shortDescEn`)}</label>
            <input type="text" maxLength={300} value={form.shortDescEn} onChange={(e) => setForm((f) => ({ ...f, shortDescEn: e.target.value }))} className="mt-1 w-full rounded-[var(--radius-btn)] border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--color-foreground)]">{t(`${Cf}.fullDescArRequired`)}</label>
            <textarea value={form.descriptionAr} onChange={(e) => setForm((f) => ({ ...f, descriptionAr: e.target.value }))} rows={4} className="mt-1 w-full rounded-[var(--radius-btn)] border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--color-foreground)]">{t(`${Cf}.fullDescEnRequired`)}</label>
            <textarea value={form.descriptionEn} onChange={(e) => setForm((f) => ({ ...f, descriptionEn: e.target.value }))} rows={4} className="mt-1 w-full rounded-[var(--radius-btn)] border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2" required />
          </div>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={form.isPublished} onChange={(e) => setForm((f) => ({ ...f, isPublished: e.target.checked }))} />
            <span className="text-sm text-[var(--color-foreground)]">{t(`${Cf}.publishedCourseLabel`)}</span>
          </label>
        </div>
      </section>

      <section className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
        <h3 className="mb-4 text-lg font-semibold text-[var(--color-foreground)]">{t(`${Cf}.lessonsHeading`)}</h3>
        <p className="mb-4 text-sm text-[var(--color-muted)]">{t(`${Cf}.lessonsIntro`)}</p>
        {lessons.map((lesson, i) => (
          <div key={i} className="mb-6 rounded-[var(--radius-btn)] border border-[var(--color-border)] bg-[var(--color-background)] p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="font-medium text-[var(--color-foreground)]">{t(`${Cf}.lessonN`)}{i + 1}</span>
              {lessons.length > 1 && (
                <button type="button" onClick={() => removeLesson(i)} className="text-sm text-red-600 hover:underline">{t(`${Cf}.lessonDeleteBtn`)}</button>
              )}
            </div>
            <div className="space-y-2">
              <input type="text" value={lesson.title} onChange={(e) => updateLesson(i, "title", e.target.value)} placeholder={t(`${Cf}.lessonTitlePlaceholder`)} className="w-full rounded-[var(--radius-btn)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm" />
              <input type="url" value={lesson.videoUrl} onChange={(e) => updateLesson(i, "videoUrl", e.target.value)} placeholder={t(`${Cf}.videoUrlPlaceholder`)} className="w-full rounded-[var(--radius-btn)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm" />
              <p className="text-xs text-[var(--color-muted)]">{t(`${Cf}.videoUrlHint`)}</p>
              <LessonVideoQuestionsEditor
                lessonIndex={i}
                videoUrl={lesson.videoUrl}
                questions={lesson.videoQuestions}
                onAddQuestion={() => addLessonVideoQuestion(i)}
                onRemoveQuestion={(qti) => removeLessonVideoQuestion(i, qti)}
                onUpdateQuestion={(qti, field, value) => updateLessonVideoQuestion(i, qti, field, value)}
                onSetType={(qti, type) => setLessonVideoQuestionType(i, qti, type)}
                onAddOption={(qti) => addLessonVideoQuestionOption(i, qti)}
                onRemoveOption={(qti, oi) => removeLessonVideoQuestionOption(i, qti, oi)}
                onUpdateOption={(qti, oi, field, value) => updateLessonVideoQuestionOption(i, qti, oi, field, value)}
                onSetCorrectOption={(qti, oi) => setLessonVideoQuestionCorrectOption(i, qti, oi)}
              />
              <div>
                <label className="block text-xs text-[var(--color-muted)]">{t(`${Cf}.lessonPdfOptional`)}</label>
                {lesson.pdfUrl ? (
                  <div className="mt-1 flex items-center gap-2">
                    <a href={lesson.pdfUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-[var(--color-primary)] hover:underline">{t(`${Cf}.viewPdf`)}</a>
                    <button type="button" onClick={() => updateLesson(i, "pdfUrl", "")} className="text-sm text-red-600 hover:underline">{t(`${Cf}.remove`)}</button>
                  </div>
                ) : (
                  <label className="mt-1 inline-block cursor-pointer rounded-[var(--radius-btn)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm">
                    {pdfUploading === i ? t(`${Cf}.uploadingPdf`) : t(`${Cf}.choosePdfUpload`)}
                    <input
                      type="file"
                      accept="application/pdf"
                      className="hidden"
                      disabled={pdfUploading !== null}
                      onChange={async (e) => {
                        const f = e.target.files?.[0];
                        if (!f) return;
                        setPdfUploading(i);
                        try {
                          const fd = new FormData();
                          fd.set("file", f);
                          const res = await fetch("/api/upload/pdf", { method: "POST", body: fd });
                          const data = await res.json().catch(() => ({}));
                          if (res.ok && data.url) updateLesson(i, "pdfUrl", data.url);
                        } finally {
                          setPdfUploading(null);
                          e.target.value = "";
                        }
                      }}
                    />
                  </label>
                )}
              </div>
              <textarea value={lesson.content} onChange={(e) => updateLesson(i, "content", e.target.value)} placeholder={t(`${Cf}.notesPlaceholder`)} rows={2} className="w-full rounded-[var(--radius-btn)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm" />
              <label className="flex items-center gap-2 pt-2">
                <input type="checkbox" checked={lesson.acceptsHomework} onChange={(e) => updateLesson(i, "acceptsHomework", e.target.checked)} className="rounded border-[var(--color-border)]" />
                <span className="text-sm text-[var(--color-foreground)]">{t(`${Cf}.homeworkCheckbox`)}</span>
              </label>
            </div>
          </div>
        ))}
        <button type="button" onClick={addLesson} className="rounded-[var(--radius-btn)] border border-[var(--color-border)] px-4 py-2 text-sm font-medium">{t(`${Cf}.addLessonBtn`)}</button>
      </section>

      <section className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
        <h3 className="mb-4 text-lg font-semibold text-[var(--color-foreground)]">{t(`${Cf}.quizzesHeading`)}</h3>
        <p className="mb-4 text-sm text-[var(--color-muted)]">{t(`${Cf}.quizzesIntro`)}</p>
        {quizzes.map((quiz, qi) => (
          <div key={qi} className="mb-6 rounded-[var(--radius-btn)] border border-[var(--color-border)] bg-[var(--color-background)] p-4">
            <div className="mb-3 flex items-center justify-between">
              <input type="text" value={quiz.title} onChange={(e) => updateQuizTitle(qi, e.target.value)} placeholder={t(`${Cf}.quizTitlePlaceholder`)} className="flex-1 rounded-[var(--radius-btn)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2" />
              {quizzes.length > 1 && (
                <button type="button" onClick={() => removeQuiz(qi)} className="mr-2 text-sm text-red-600 hover:underline">{t(`${Cf}.deleteQuiz`)}</button>
              )}
            </div>
            <div className="mb-3">
              <label className="block text-sm font-medium text-[var(--color-foreground)]">{t(`${Cf}.quizDurationMinutes`)}</label>
              <input
                type="number"
                min="1"
                placeholder={t(`${Cf}.openTimePlaceholderLine`)}
                value={quiz.timeLimitMinutes}
                onChange={(e) => updateQuizTimeLimit(qi, e.target.value)}
                className="mt-1 w-full max-w-xs rounded-[var(--radius-btn)] border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2"
              />
              <p className="mt-1 text-xs text-[var(--color-muted)]">{t(`${Cf}.quizTimeHelp`)}</p>
            </div>
            {quiz.questions.map((q, qti) => (
              <QuizQuestionFields
                key={qti}
                qi={qi}
                qti={qti}
                q={q}
                quizQuestionCount={quiz.questions.length}
                onSetType={(type) => setQuestionType(qi, qti, type)}
                onUpdateQuestionText={(text) => updateQuestion(qi, qti, "questionText", text)}
                onRemoveQuestion={() => removeQuestion(qi, qti)}
                onAddOption={() => addOption(qi, qti)}
                onRemoveOption={(oi) => removeOption(qi, qti, oi)}
                onUpdateOption={(oi, field, value) => updateOption(qi, qti, oi, field, value)}
                onSetCorrectOption={(oi) => setCorrectOption(qi, qti, oi)}
                onAddMatchPair={() => addMatchPair(qi, qti)}
              />
            ))}
            <button type="button" onClick={() => addQuestion(qi)} className="mb-2 text-sm text-[var(--color-primary)] hover:underline">{t(`${Cf}.addQuestionBtn`)}</button>
          </div>
        ))}
        <button type="button" onClick={addQuiz} className="rounded-[var(--radius-btn)] border border-[var(--color-border)] px-4 py-2 text-sm font-medium">{t(`${Cf}.addQuizBtn`)}</button>
      </section>

      <section className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
        <h3 className="mb-2 text-lg font-semibold text-[var(--color-foreground)]">{t(`${Cf}.orderSectionTitle`)}</h3>
        <p className="mb-4 text-sm text-[var(--color-muted)]">
          {t(`${Cf}.orderSectionHelpLine`)}
        </p>
        <ul className="space-y-2">
          {contentOrder.map((entry, pos) => {
            const label =
              entry.type === "lesson"
                ? `${t(`${Cf}.lessonN`)}${entry.index + 1}${lessons[entry.index]?.title?.trim() ? ": " + lessons[entry.index].title.trim() : ""}`
                : `${t(`${Cf}.orderQuizPrefix`)}${entry.index + 1}${quizzes[entry.index]?.title?.trim() ? ": " + quizzes[entry.index].title.trim() : ""}`;
            return (
              <li
                key={`${entry.type}-${entry.index}-${pos}`}
                className="flex items-center justify-between gap-2 rounded-[var(--radius-btn)] border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2"
              >
                <span className="text-sm text-[var(--color-foreground)]">
                  {pos + 1}. {label}
                </span>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => moveContentOrder(pos, "up")}
                    disabled={pos === 0}
                    className="rounded border border-[var(--color-border)] px-2 py-1 text-xs disabled:opacity-40"
                    title={t(`${Cf}.moveUpTitle`)}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => moveContentOrder(pos, "down")}
                    disabled={pos === contentOrder.length - 1}
                    className="rounded border border-[var(--color-border)] px-2 py-1 text-xs disabled:opacity-40"
                    title={t(`${Cf}.moveDownTitle`)}
                  >
                    ↓
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <div className="flex gap-3">
        <button type="submit" disabled={loading} className="rounded-[var(--radius-btn)] bg-[var(--color-primary)] px-6 py-2 font-medium text-white hover:bg-[var(--color-primary-hover)] disabled:opacity-50">
          {loading ? t(`${Cf}.savingCreateBtnBusy`) : t(`${Cf}.saveChangesIdle`)}
        </button>
        <button type="button" onClick={() => router.push("/dashboard/courses")} className="rounded-[var(--radius-btn)] border border-[var(--color-border)] px-6 py-2 font-medium">
          {t(`${Cf}.cancelBtnShort`)}
        </button>
      </div>
    </form>
  );
}
