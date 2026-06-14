"use client";

import { useEffect, useState } from "react";
import { YouTubeOverlayPlayer } from "@/components/YouTubeOverlayPlayer";
import { getGoogleDrivePreviewUrl, getLessonVideoProvider } from "@/lib/lesson-video";
import { useLocale, useT } from "@/components/LocaleProvider";

type Props = {
  videoUrl: string;
  title: string;
  studentCopyrightCode?: string | null;
  copyrightOverlayStyle?: "floating" | "watermark";
};

function VideoCopyrightFloatingBadge({
  code,
  label,
  dir,
}: {
  code: string;
  label: string;
  dir: "rtl" | "ltr";
}) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);
  const positions = [
    "right-3 top-3",
    "left-3 bottom-16",
    "left-3 top-10",
    "right-3 bottom-20",
    "left-1/2 top-4 -translate-x-1/2",
    "right-1/2 bottom-14 translate-x-1/2",
  ];
  const pos = positions[tick % positions.length];
  return (
    <div
      className={`pointer-events-none absolute z-[35] max-w-[min(90%,14rem)] select-none rounded-md border border-white/25 bg-black/60 px-2 py-1.5 text-[10px] font-semibold text-white/95 shadow-lg backdrop-blur-sm sm:text-[11px] ${pos}`}
      dir={dir}
      aria-hidden
    >
      <div className="text-[9px] font-normal text-white/75">{label}</div>
      <div className="font-mono tracking-widest">{code}</div>
    </div>
  );
}

function VideoCopyrightCenterWatermark({ code }: { code: string }) {
  return (
    <div
      className="pointer-events-none absolute inset-0 z-[35] flex items-center justify-center overflow-hidden select-none px-4"
      aria-hidden
    >
      <div className="-rotate-[20deg] text-center font-mono font-bold uppercase tracking-[0.22em] text-white/15 [text-shadow:0_1px_2px_rgba(0,0,0,0.45)] [font-size:clamp(1.4rem,6vw,4.5rem)]">
        {code}
      </div>
    </div>
  );
}

function GoogleDriveVideoPlayer({
  videoUrl,
  title,
  studentCopyrightCode,
  copyrightOverlayStyle = "floating",
}: Props) {
  const t = useT();
  const locale = useLocale();
  const textDir = locale === "ar" ? "rtl" : "ltr";
  const embedUrl = getGoogleDrivePreviewUrl(videoUrl);
  if (!embedUrl) return null;

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border)] bg-black">
      <iframe
        src={embedUrl}
        title={title}
        allow="autoplay; fullscreen"
        allowFullScreen
        className="h-full w-full border-0"
      />
      {/* Block Google Drive pop-out button (top-right of embed) */}
      <div
        className="absolute right-0 top-0 z-[40] h-12 w-14 bg-transparent sm:h-14 sm:w-16"
        aria-hidden
        onPointerDown={(e) => {
          e.stopPropagation();
        }}
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
        }}
      />
      {studentCopyrightCode?.trim()
        ? copyrightOverlayStyle === "watermark"
          ? <VideoCopyrightCenterWatermark code={studentCopyrightCode.trim()} />
          : (
              <VideoCopyrightFloatingBadge
                code={studentCopyrightCode.trim()}
                label={t("video.copyrightCode", "Copyright code")}
                dir={textDir}
              />
            )
        : null}
    </div>
  );
}

export function LessonVideoPlayer(props: Props) {
  const provider = getLessonVideoProvider(props.videoUrl);
  if (provider === "youtube") {
    return <YouTubeOverlayPlayer {...props} />;
  }
  if (provider === "google_drive") {
    return <GoogleDriveVideoPlayer {...props} />;
  }
  return null;
}
