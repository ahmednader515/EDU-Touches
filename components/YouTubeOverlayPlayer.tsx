"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Plyr from "plyr";
import "plyr/dist/plyr.css";
import { getYouTubeVideoId } from "@/lib/youtube";
import { useLocale, useT } from "./LocaleProvider";
import { VideoQuestionOverlay } from "@/components/VideoQuestionOverlay";
import type { LessonVideoQuestionPayload } from "@/lib/lesson-video-question-utils";

type Props = {
  videoUrl: string;
  title: string;
  studentCopyrightCode?: string | null;
  copyrightOverlayStyle?: "floating" | "watermark";
  videoQuestions?: LessonVideoQuestionPayload[];
};

type PlyrWithEmbed = Plyr & {
  embed?: { getCurrentTime?: () => number };
};

function getPlaybackTime(player: Plyr): number {
  const p = player as PlyrWithEmbed;
  try {
    const fromEmbed = p.embed?.getCurrentTime?.();
    if (typeof fromEmbed === "number" && Number.isFinite(fromEmbed) && fromEmbed >= 0) {
      return fromEmbed;
    }
  } catch {
    /* */
  }
  try {
    const t = player.currentTime;
    if (typeof t === "number" && Number.isFinite(t) && t >= 0) return t;
  } catch {
    /* */
  }
  return 0;
}

function resolveOverlayHost(player: Plyr, wrapper: HTMLElement | null): HTMLElement | null {
  const doc = document as Document & { webkitFullscreenElement?: Element | null };
  const fs = doc.fullscreenElement ?? doc.webkitFullscreenElement;
  const container = player.elements?.container;
  if (fs instanceof HTMLElement) {
    if (container instanceof HTMLElement && (fs === container || container.contains(fs))) {
      return fs;
    }
    return fs;
  }
  if (container instanceof HTMLElement) return container;
  return wrapper;
}

function ensureRelativePosition(el: HTMLElement) {
  if (getComputedStyle(el).position === "static") {
    el.style.position = "relative";
  }
}

function VideoCopyrightFloatingBadge({ code, label, dir }: { code: string; label: string; dir: "rtl" | "ltr" }) {
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
    <div className="pointer-events-none absolute inset-0 z-[35] flex items-center justify-center overflow-hidden select-none px-4" aria-hidden>
      <div className="-rotate-[20deg] text-center font-mono font-bold uppercase tracking-[0.22em] text-white/15 [text-shadow:0_1px_2px_rgba(0,0,0,0.45)] [font-size:clamp(1.4rem,6vw,4.5rem)]">
        {code}
      </div>
    </div>
  );
}

export function YouTubeOverlayPlayer({
  videoUrl,
  title,
  studentCopyrightCode,
  copyrightOverlayStyle = "floating",
  videoQuestions = [],
}: Props) {
  const t = useT();
  const locale = useLocale();
  const textDir = locale === "ar" ? "rtl" : "ltr";
  const wrapperRef = useRef<HTMLDivElement>(null);
  const mountRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<Plyr | null>(null);
  const dismissedRef = useRef<Set<string>>(new Set());
  const pollIdRef = useRef<number | null>(null);
  const fullscreenTopGuardRef = useRef<HTMLDivElement | null>(null);
  const fullscreenTopGuardMoRef = useRef<MutationObserver | null>(null);
  const fullscreenShieldTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const videoQuestionsRef = useRef(videoQuestions);
  const activeQuestionRef = useRef<LessonVideoQuestionPayload | null>(null);
  const playerReadyRef = useRef(false);

  const [mountEl, setMountEl] = useState<HTMLDivElement | null>(null);
  const [overlayHost, setOverlayHost] = useState<HTMLElement | null>(null);
  const [activeQuestion, setActiveQuestion] = useState<LessonVideoQuestionPayload | null>(null);

  const videoId = getYouTubeVideoId(videoUrl);

  const setMountNode = useCallback((node: HTMLDivElement | null) => {
    mountRef.current = node;
    setMountEl(node);
  }, []);

  useEffect(() => {
    videoQuestionsRef.current = videoQuestions;
  }, [videoQuestions]);

  useEffect(() => {
    activeQuestionRef.current = activeQuestion;
  }, [activeQuestion]);

  const syncOverlayHost = useCallback((player: Plyr) => {
    const host = resolveOverlayHost(player, wrapperRef.current);
    if (host) {
      ensureRelativePosition(host);
      setOverlayHost(host);
    }
  }, []);

  const dismissActiveQuestion = useCallback(() => {
    const current = activeQuestionRef.current;
    if (current) dismissedRef.current.add(current.id);
    setActiveQuestion(null);
    try {
      void playerRef.current?.play();
    } catch {
      /* */
    }
  }, []);

  const activateQuestion = useCallback((q: LessonVideoQuestionPayload) => {
    if (dismissedRef.current.has(q.id) || activeQuestionRef.current?.id === q.id) return;
    const player = playerRef.current;
    if (player) syncOverlayHost(player);
    try {
      player?.pause();
    } catch {
      /* */
    }
    setActiveQuestion(q);
  }, [syncOverlayHost]);

  const checkQuestions = useCallback(() => {
    if (activeQuestionRef.current || !playerReadyRef.current) return;
    const questions = videoQuestionsRef.current;
    if (questions.length === 0) return;
    const player = playerRef.current;
    if (!player) return;

    const time = getPlaybackTime(player);
    const sorted = [...questions].sort((a, b) => a.showAtSeconds - b.showAtSeconds);
    for (const q of sorted) {
      if (dismissedRef.current.has(q.id)) continue;
      if (time >= q.showAtSeconds) {
        activateQuestion(q);
        break;
      }
    }
  }, [activateQuestion]);

  useEffect(() => {
    dismissedRef.current = new Set();
    playerReadyRef.current = false;
    setActiveQuestion(null);
    setOverlayHost(null);
  }, [videoId]);

  useEffect(() => {
    if (!videoId || !mountEl) return;

    const clearFullscreenShieldTimers = () => {
      for (const timer of fullscreenShieldTimersRef.current) clearTimeout(timer);
      fullscreenShieldTimersRef.current = [];
    };

    const removeShieldNodeOnly = () => {
      fullscreenTopGuardMoRef.current?.disconnect();
      fullscreenTopGuardMoRef.current = null;
      fullscreenTopGuardRef.current?.remove();
      fullscreenTopGuardRef.current = null;
    };

    const removeFullscreenShield = () => {
      clearFullscreenShieldTimers();
      removeShieldNodeOnly();
    };

    const attachBlockHandlers = (node: HTMLElement) => {
      const stopBubble: EventListener = (e) => e.stopPropagation();
      const stopClick: EventListener = (e) => {
        e.stopPropagation();
        if (e.cancelable) e.preventDefault();
      };
      node.addEventListener("pointerdown", stopBubble, true);
      node.addEventListener("pointerup", stopBubble, true);
      node.addEventListener("click", stopClick, true);
      node.addEventListener("touchstart", stopBubble, { capture: true, passive: true });
      node.addEventListener("touchend", stopBubble, { capture: true, passive: true });
    };

    const mountFullscreenShield = (player: Plyr) => {
      removeShieldNodeOnly();
      const container = player.elements?.container;
      if (!container || !(container instanceof HTMLElement)) return;

      const videoWrap =
        (container.querySelector(".plyr__video-wrapper") as HTMLElement | null) ?? container;
      ensureRelativePosition(videoWrap);

      const topGuard = document.createElement("div");
      topGuard.setAttribute("aria-hidden", "true");
      topGuard.setAttribute("data-lesson-yt-top-guard", "");
      topGuard.className = "pointer-events-auto bg-transparent";
      topGuard.style.cssText =
        "position:absolute;left:0;right:0;top:0;width:100%;box-sizing:border-box;z-index:2147483647;height:clamp(9rem,min(30%,28vmin),22rem);min-height:9rem;max-height:45%;";
      attachBlockHandlers(topGuard);

      const pinGuardOnTop = () => {
        const g = fullscreenTopGuardRef.current;
        if (!g?.isConnected || videoWrap.lastElementChild === g) return;
        videoWrap.appendChild(g);
      };

      videoWrap.appendChild(topGuard);
      fullscreenTopGuardRef.current = topGuard;
      pinGuardOnTop();

      fullscreenTopGuardMoRef.current?.disconnect();
      const mo = new MutationObserver(() => pinGuardOnTop());
      mo.observe(videoWrap, { childList: true });
      fullscreenTopGuardMoRef.current = mo;
    };

    const isTouch =
      typeof window !== "undefined" &&
      ("ontouchstart" in window || (typeof navigator !== "undefined" && navigator.maxTouchPoints > 0));

    const player = new Plyr(mountEl, {
      controls: [
        "play-large",
        "play",
        "progress",
        "current-time",
        "duration",
        "mute",
        "volume",
        "settings",
        "pip",
        "fullscreen",
      ],
      settings: ["quality", "speed"],
      ratio: "16:9",
      fullscreen: { enabled: true, fallback: true, iosNative: false },
      autopause: false,
      hideControls: !isTouch,
      clickToPlay: !isTouch,
      keyboard: { focused: true, global: false },
      youtube: {
        rel: 0,
        modestbranding: 1,
        iv_load_policy: 3,
        playsinline: 1,
        cc_load_policy: 0,
        ...(typeof window !== "undefined" && window.location?.origin ? { origin: window.location.origin } : {}),
      },
    });

    playerRef.current = player;

    const stopPolling = () => {
      if (pollIdRef.current != null) {
        window.clearInterval(pollIdRef.current);
        pollIdRef.current = null;
      }
    };

    const startPolling = () => {
      stopPolling();
      pollIdRef.current = window.setInterval(checkQuestions, 250);
    };

    const onReady = () => {
      playerReadyRef.current = true;
      syncOverlayHost(player);
      checkQuestions();
      startPolling();
      window.setTimeout(checkQuestions, 400);
      window.setTimeout(checkQuestions, 1200);
    };

    const onTimeRelated = () => {
      syncOverlayHost(player);
      checkQuestions();
    };

    const onEnterFullscreen = () => {
      syncOverlayHost(player);
      mountFullscreenShield(player);
      requestAnimationFrame(() => {
        syncOverlayHost(player);
        mountFullscreenShield(player);
        const t1 = setTimeout(() => mountFullscreenShield(player), 80);
        const t2 = setTimeout(() => mountFullscreenShield(player), 250);
        fullscreenShieldTimersRef.current.push(t1, t2);
      });
    };

    const onExitFullscreen = () => {
      removeFullscreenShield();
      syncOverlayHost(player);
    };

    player.on("ready", onReady);
    player.on("timeupdate", onTimeRelated);
    player.on("seeked", onTimeRelated);
    player.on("playing", onTimeRelated);
    player.on("pause", onTimeRelated);
    player.on("enterfullscreen", onEnterFullscreen);
    player.on("exitfullscreen", onExitFullscreen);

    const doc = document as Document & { webkitFullscreenElement?: Element | null };
    const onDocumentFullscreenChange = () => {
      syncOverlayHost(player);
      if (!document.fullscreenElement && !doc.webkitFullscreenElement) {
        removeFullscreenShield();
      }
    };
    document.addEventListener("fullscreenchange", onDocumentFullscreenChange);
    document.addEventListener("webkitfullscreenchange", onDocumentFullscreenChange);

    return () => {
      stopPolling();
      playerReadyRef.current = false;
      document.removeEventListener("fullscreenchange", onDocumentFullscreenChange);
      document.removeEventListener("webkitfullscreenchange", onDocumentFullscreenChange);
      player.off("ready", onReady);
      player.off("timeupdate", onTimeRelated);
      player.off("seeked", onTimeRelated);
      player.off("playing", onTimeRelated);
      player.off("pause", onTimeRelated);
      player.off("enterfullscreen", onEnterFullscreen);
      player.off("exitfullscreen", onExitFullscreen);
      removeFullscreenShield();
      playerRef.current = null;
      setOverlayHost(null);
      try {
        player.destroy();
      } catch {
        /* */
      }
    };
  }, [videoId, mountEl, syncOverlayHost, checkQuestions]);

  if (!videoId) return null;

  const overlayNode = activeQuestion ? (
    <VideoQuestionOverlay question={activeQuestion} onDismiss={dismissActiveQuestion} />
  ) : null;

  const overlayPortal =
    overlayNode && overlayHost ? createPortal(overlayNode, overlayHost) : null;

  const overlayFallback =
    overlayNode && !overlayHost ? (
      <div className="absolute inset-0 z-[200]">{overlayNode}</div>
    ) : null;

  return (
    <>
      <div
        ref={wrapperRef}
        className="plyr-lesson-video relative aspect-video w-full overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border)] bg-black"
      >
        <div key={videoId} className="h-full w-full [&_.plyr]:h-full [&_.plyr]:max-h-none">
          <div
            ref={setMountNode}
            data-plyr-provider="youtube"
            data-plyr-embed-id={videoId}
            data-plyr-title={title}
            className="h-full w-full"
          />
        </div>
        {!activeQuestion && (
          <div
            className="absolute inset-x-0 top-0 z-[40] h-12 bg-transparent sm:h-14 md:h-16"
            aria-hidden
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
            }}
          />
        )}
        {studentCopyrightCode?.trim() && !activeQuestion
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
        {overlayFallback}
      </div>
      {overlayPortal}
    </>
  );
}
