export function isPwaStandalone(): boolean {
  if (typeof window === "undefined") return false;

  // iOS Safari standalone
  // @ts-ignore
  if (typeof navigator !== "undefined" && (navigator as any).standalone) {
    return true;
  }

  // Chrome/Edge
  if (window.matchMedia) {
    if (window.matchMedia("(display-mode: standalone)").matches) return true;
    if (window.matchMedia("(display-mode: window-controls-overlay)").matches)
      return true;
  }

  return false;
}

export function isIosSafariBrowser(): boolean {
  if (typeof navigator === 'undefined') {
    return false;
  }

  const ua = navigator.userAgent.toLowerCase();
  const isIos = /iphone|ipad|ipod/.test(ua);
  const isWebkit = /webkit/.test(ua);
  const isOtherIosBrowser = /crios|fxios|edgios|opios/.test(ua);
  return isIos && isWebkit && !isOtherIosBrowser;
}

export function isInstallPromptSupportedDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent.toLowerCase();
  return /android|iphone|ipad|ipod|mobile|tablet/.test(ua);
}

export function isPwaMobile(): boolean {
  return isPwaStandalone() && isInstallPromptSupportedDevice();
}
