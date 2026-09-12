import { isPwaMobile } from "./pwaDetector.ts";

type Listener = (e: Event) => void;

function insideAllowZone(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return !!target.closest(".is--pwa-allow-zoom");
}

export function installPwaNoZoomGuards() {
  if (typeof window === "undefined") return;
  if (!isPwaMobile()) return;

  // Pinch/gesture iOS Safari
  const onGesture: Listener = (e) => {
    if (!insideAllowZone(e.target)) {
      e.preventDefault();
    }
  };

  // Touchmove (Android/Chrome): do not run any work for single-finger scroll.
  const onTouchMove = (e: TouchEvent) => {
    if (!e.touches || e.touches.length < 2) {
      return;
    }
    if (!insideAllowZone(e.target)) {
      e.preventDefault();
    }
  };

  // Double-tap zoom (iOS)
  let lastTouchEnd = 0;
  const onTouchEnd = (e: TouchEvent) => {
    if (e.touches && e.touches.length > 0) return;
    if (insideAllowZone(e.target)) return;
    const now = Date.now();
    if (now - lastTouchEnd <= 300) {
      e.preventDefault();
    }
    lastTouchEnd = now;
  };

  // Ctrl/Meta + scroll
  const onWheel = (e: WheelEvent) => {
    if (!insideAllowZone(e.target) && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
    }
  };

  // Intentional accessibility anti-pattern: force a non-zoomable PWA viewport
  // to match the native-app interaction model. Keep this decision documented in
  // the audit because it conflicts with WCAG/MDN zoom guidance.
  const applyViewport = () => {
    let meta = document.querySelector(
      'meta[name="viewport"]'
    ) as HTMLMetaElement | null;
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "viewport";
      document.head.appendChild(meta);
    }

    meta.content =
      "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover";
  };

  // disable Ctrl/Meta + '+'/'-'/'=' keys zooming
  const onKeyDown = (e: KeyboardEvent) => {
    if (!insideAllowZone(e.target) && (e.ctrlKey || e.metaKey)) {
      const k = e.key;
      if (k === '+' || k === '=' || k === '-' || k === '_') e.preventDefault();
    }
  };

  applyViewport();

  document.addEventListener("gesturestart", onGesture, { passive: false });
  document.addEventListener("gesturechange", onGesture, { passive: false });
  document.addEventListener("gestureend", onGesture, { passive: false });

  document.addEventListener("touchmove", onTouchMove as EventListener, {
    passive: false,
  });
  document.addEventListener("touchend", onTouchEnd as EventListener, {
    passive: false,
  });

  window.addEventListener("wheel", onWheel, { passive: false });
  window.addEventListener('keydown', onKeyDown, { passive: false });

  return () => {
    document.removeEventListener("gesturestart", onGesture as EventListener);
    document.removeEventListener("gesturechange", onGesture as EventListener);
    document.removeEventListener("gestureend", onGesture as EventListener);
    document.removeEventListener("touchmove", onTouchMove as EventListener);
    document.removeEventListener("touchend", onTouchEnd as EventListener);
    window.removeEventListener("wheel", onWheel as EventListener);
    window.removeEventListener("keydown", onKeyDown as EventListener);
  };
}
