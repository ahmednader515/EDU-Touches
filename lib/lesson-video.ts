import { getYouTubeVideoId } from "@/lib/youtube";

export type LessonVideoProvider = "youtube" | "google_drive";

/**
 * Extract Google Drive file id from common share / view URLs.
 */
export function getGoogleDriveFileId(url: string | null | undefined): string | null {
  if (!url?.trim()) return null;
  const u = url.trim();

  const fileMatch = u.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (fileMatch) return fileMatch[1];

  const openMatch = u.match(/drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/);
  if (openMatch) return openMatch[1];

  const ucMatch = u.match(/drive\.google\.com\/uc\?(?:[^&]*&)*id=([a-zA-Z0-9_-]+)/);
  if (ucMatch) return ucMatch[1];

  const docsMatch = u.match(/docs\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (docsMatch) return docsMatch[1];

  return null;
}

export function getGoogleDrivePreviewUrl(url: string | null | undefined): string | null {
  const id = getGoogleDriveFileId(url);
  return id ? `https://drive.google.com/file/d/${id}/preview` : null;
}

/** Returns the provider for a lesson video URL, or null if invalid / ambiguous. */
export function getLessonVideoProvider(
  url: string | null | undefined
): LessonVideoProvider | null {
  if (!url?.trim()) return null;
  const u = url.trim();
  const youtube = !!getYouTubeVideoId(u);
  const drive = !!getGoogleDriveFileId(u);
  if (youtube && drive) return null;
  if (youtube) return "youtube";
  if (drive) return "google_drive";
  return null;
}

export function isValidLessonVideoUrl(url: string | null | undefined): boolean {
  if (!url?.trim()) return true;
  return getLessonVideoProvider(url) !== null;
}

export function normalizeLessonVideoUrl(url: string | null | undefined): string | null {
  const trimmed = url?.trim();
  if (!trimmed) return null;
  if (!getLessonVideoProvider(trimmed)) return null;
  return trimmed;
}
