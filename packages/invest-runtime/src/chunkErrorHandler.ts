// After a deploy, browsers holding the old HTML in cache request chunk
// filenames whose hashes no longer exist (e.g. `DashboardWallet-D4KASbBM.js`
// 404s). Vue's `defineAsyncComponent` / dynamic `import()` surface this as
// an unhandled promise rejection. Reload the page once so the browser pulls
// the new HTML + chunk references.
//
// Listeners we install:
//   1. `unhandledrejection`  — catches `import()` failures (the primary case)
//   2. `error` (capturing)   — catches critical <script>/<link> load failures
//
// Before reloading, verify that the same-origin asset is genuinely missing
// (404/410). This prevents transient network errors, aborted modulepreloads,
// and unrelated console messages from reloading the application.
//
// A sessionStorage cooldown remains as a final guard against reload loops.
export function setupChunkErrorHandler(): void {
  if (typeof window === 'undefined') {
    return;
  }
  if ((window as any).__chunkErrorHandlerInstalled) {
    return;
  }
  (window as any).__chunkErrorHandlerInstalled = true;

  const CHUNK_RELOAD_KEY = 'chunk-error-last-reload';
  const CHUNK_RELOAD_COOLDOWN = 30 * 1000; // 30 seconds
  let verificationInFlight = false;

  const isChunkAssetError = (msg: string) => {
    return msg.includes('/assets/')
      && (msg.includes('.js') || msg.includes('.css'));
  };

  const isDynamicImportError = (msg: string) => {
    // Cover Chrome + Firefox phrasing
    return msg.includes('Failed to fetch dynamically imported module:')
      || msg.includes('error loading dynamically imported module:')
      || msg.includes('Loading failed for the module with source')
      || msg.includes('Importing a module script failed');
  };

  const isServiceWorkerAssetError = (msg: string) => {
    return msg.includes('A ServiceWorker intercepted the request')
      && isChunkAssetError(msg);
  };

  const shouldVerifyFromMessage = (msg: string) => {
    return (isDynamicImportError(msg) && isChunkAssetError(msg))
      || isServiceWorkerAssetError(msg);
  };

  const resolveChunkAssetUrl = (value: string): URL | null => {
    if (!isChunkAssetError(value)) {
      return null;
    }

    const match = value.match(
      /(?:https?:\/\/|\/)[^\s"'()]*\/assets\/[^\s"'()]+\.(?:js|css)(?:\?[^\s"'()]*)?/i,
    );
    if (!match) {
      return null;
    }

    try {
      const url = new URL(match[0], window.location.href);
      if (
        url.origin !== window.location.origin
        || !url.pathname.includes('/assets/')
        || !/\.(?:js|css)$/i.test(url.pathname)
      ) {
        return null;
      }
      return url;
    } catch {
      return null;
    }
  };

  const tryReloadOnce = () => {
    try {
      const lastReload = Number(window.sessionStorage.getItem(CHUNK_RELOAD_KEY) || '0');
      const now = Date.now();
      if (Number.isNaN(lastReload) || now - lastReload > CHUNK_RELOAD_COOLDOWN) {
        window.sessionStorage.setItem(CHUNK_RELOAD_KEY, String(now));
        window.location.reload();
        return;
      }
    } catch (storageError) {
      console.warn('chunkErrorHandler: sessionStorage is not accessible, reloading anyway.', storageError);
      window.location.reload();
      return;
    }
    console.warn('chunkErrorHandler: verified missing chunk repeated within 30s; reload skipped to avoid a loop.');
  };

  const verifyMissingAssetAndReload = async (assetUrl: URL) => {
    if (verificationInFlight || typeof window.fetch !== 'function') {
      return;
    }

    verificationInFlight = true;
    try {
      const response = await window.fetch(assetUrl.href, {
        method: 'HEAD',
        cache: 'no-store',
        credentials: 'same-origin',
      });
      if (response.status === 404 || response.status === 410) {
        tryReloadOnce();
      }
    } catch {
      // A network failure is not proof that a deploy removed the asset.
      // Reloading here would turn offline/transient failures into reload loops.
    } finally {
      verificationInFlight = false;
    }
  };

  // 1. Unhandled promise rejection — the primary case for dynamic-import
  //    failures. `Failed to fetch dynamically imported module: …` lands here,
  //    not in console.error.
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event?.reason;
    const msg = reason instanceof Error
      ? `${reason.message} ${reason.stack ?? ''}`
      : String(reason ?? '');
    if (shouldVerifyFromMessage(msg)) {
      const assetUrl = resolveChunkAssetUrl(msg);
      if (assetUrl) {
        void verifyMissingAssetAndReload(assetUrl);
      }
    }
  });

  // 2. Resource load errors — captured at the window level (capture: true)
  //    so we see critical <script src> and stylesheet <link href> failures
  //    that don't bubble. Ignore preload/modulepreload links: browsers may
  //    abort these speculative requests during normal navigation.
  window.addEventListener(
    'error',
    (event) => {
      const target = event?.target as HTMLElement | null;
      if (!target) return;
      const tag = target.tagName?.toLowerCase();
      const src = (target as HTMLScriptElement).src
        ?? (target as HTMLLinkElement).href
        ?? '';
      const isCriticalResource = tag === 'script'
        || (
          tag === 'link'
          && (target as HTMLLinkElement).rel?.toLowerCase() === 'stylesheet'
        );
      if (isCriticalResource && typeof src === 'string') {
        const assetUrl = resolveChunkAssetUrl(src);
        if (assetUrl) {
          void verifyMissingAssetAndReload(assetUrl);
        }
      }
    },
    true,
  );
}
