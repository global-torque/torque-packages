import { describe, it, beforeEach, afterEach, expect, vi } from 'vitest';
import { setupChunkErrorHandler } from '../chunkErrorHandler.ts';

describe('setupChunkErrorHandler', () => {
  const originalWindow = global.window as unknown;
  const originalConsoleError = console.error;
  const originalConsoleWarn = console.warn;

  let reloadMock: ReturnType<typeof vi.fn>;
  let fetchMock: ReturnType<typeof vi.fn>;
  let getItemMock: ReturnType<typeof vi.fn>;
  let setItemMock: ReturnType<typeof vi.fn>;
  let addEventListenerMock: ReturnType<typeof vi.fn>;
  let listeners: Record<string, Array<(event: any) => void>>;

  beforeEach(() => {
    reloadMock = vi.fn();
    fetchMock = vi.fn().mockResolvedValue({ status: 404 });
    getItemMock = vi.fn().mockReturnValue(null);
    setItemMock = vi.fn();
    listeners = {};
    addEventListenerMock = vi.fn((type: string, handler: (event: any) => void) => {
      listeners[type] ??= [];
      listeners[type].push(handler);
    });

    (global as any).window = {
      location: {
        href: 'https://example.com/dashboard/',
        origin: 'https://example.com',
        reload: reloadMock,
      },
      fetch: fetchMock,
      sessionStorage: {
        getItem: getItemMock,
        setItem: setItemMock,
      },
      addEventListener: addEventListenerMock,
    };

    (console as any).error = vi.fn();
    (console as any).warn = vi.fn();

    // Ensure flag is reset between tests
    (window as any).__chunkErrorHandlerInstalled = undefined;
  });

  afterEach(() => {
    (global as any).window = originalWindow;
    console.error = originalConsoleError;
    console.warn = originalConsoleWarn;
  });

  const flushAsyncWork = async () => {
    await Promise.resolve();
    await Promise.resolve();
  };

  it('does not patch console.error or reload from a console-only message', async () => {
    setupChunkErrorHandler();

    const msg =
      'TypeError: error loading dynamically imported module: https://example.com/assets/chunks/ViewHome.ABC123.js';

    console.error(msg as unknown as Error);
    await flushAsyncWork();

    expect(console.error).toHaveBeenCalledWith(msg);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(reloadMock).not.toHaveBeenCalled();
  });

  it('is idempotent when called multiple times', () => {
    setupChunkErrorHandler();

    // Calling again should be a no-op
    setupChunkErrorHandler();

    expect(addEventListenerMock).toHaveBeenCalledTimes(2);
  });

  it('reloads on unhandledrejection only after the chunk is confirmed missing', async () => {
    // Regression: deployed dashboard surfaces stale chunk hashes as
    // `Uncaught (in promise) TypeError: Failed to fetch dynamically
    // imported module: …` as an unhandledrejection event.
    setupChunkErrorHandler();

    const rejectionHandler = listeners.unhandledrejection?.[0];
    expect(rejectionHandler).toBeDefined();

    rejectionHandler!({
      reason: new TypeError(
        'Failed to fetch dynamically imported module: https://example.com/dashboard/assets/DashboardWallet-ABC.js',
      ),
    });
    await flushAsyncWork();

    expect(fetchMock).toHaveBeenCalledWith(
      'https://example.com/dashboard/assets/DashboardWallet-ABC.js',
      {
        method: 'HEAD',
        cache: 'no-store',
        credentials: 'same-origin',
      },
    );
    expect(reloadMock).toHaveBeenCalledTimes(1);
    expect(setItemMock).toHaveBeenCalledTimes(1);
  });

  it('does not reload when the chunk still exists', async () => {
    fetchMock.mockResolvedValue({ status: 200 });
    setupChunkErrorHandler();

    listeners.unhandledrejection?.[0]?.({
      reason: new TypeError(
        'Failed to fetch dynamically imported module: https://example.com/dashboard/assets/DashboardWallet-ABC.js',
      ),
    });
    await flushAsyncWork();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(reloadMock).not.toHaveBeenCalled();
    expect(setItemMock).not.toHaveBeenCalled();
  });

  it('reloads on a script tag 404 for a hashed chunk', async () => {
    setupChunkErrorHandler();

    const errorHandler = listeners.error?.[0];
    expect(errorHandler).toBeDefined();

    errorHandler!({
      target: {
        tagName: 'SCRIPT',
        src: 'https://example.com/dashboard/assets/chunk-vue-XYZ.js',
      },
    });
    await flushAsyncWork();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(reloadMock).toHaveBeenCalledTimes(1);
  });

  it('ignores aborted modulepreload link errors', async () => {
    setupChunkErrorHandler();

    listeners.error?.[0]?.({
      target: {
        tagName: 'LINK',
        rel: 'modulepreload',
        href: 'https://example.com/dashboard/assets/chunk-vue-XYZ.js',
      },
    });
    await flushAsyncWork();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(reloadMock).not.toHaveBeenCalled();
  });
});
