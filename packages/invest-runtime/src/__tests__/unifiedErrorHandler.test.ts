import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import {
  resetUnifiedErrorHandlerForTests,
  setupUnifiedErrorHandler,
} from '../error/unifiedErrorHandler.ts';

const mockReportError = vi.fn();

vi.mock('../error/errorReporting.ts', () => ({
  reportError: (...args: unknown[]) => mockReportError(...args),
  setErrorHandlers: vi.fn(),
  setErrorLogger: vi.fn(),
  setErrorUiReporter: vi.fn(),
}));

describe('runtime unified error handler', () => {
  let addEventListenerSpy: ReturnType<typeof vi.spyOn>;
  const listeners: Array<{ type: string; handler: EventListenerOrEventListenerObject }> = [];

  const emitStoredEvent = (type: string, event: Event) => {
    const listener = listeners.find((item) => item.type === type)?.handler;

    if (typeof listener === 'function') {
      listener(event);
      return;
    }

    listener?.handleEvent(event);
  };

  beforeEach(() => {
    vi.clearAllMocks();
    resetUnifiedErrorHandlerForTests();
    listeners.length = 0;
    addEventListenerSpy = vi.spyOn(window, 'addEventListener').mockImplementation((type, handler) => {
      listeners.push({ type, handler });
    });
  });

  afterEach(() => {
    addEventListenerSpy.mockRestore();
    resetUnifiedErrorHandlerForTests();
  });

  it('installs global listeners only once across repeated initialization', () => {
    const handler = setupUnifiedErrorHandler();

    handler?.initialize();
    handler?.initialize();

    expect(listeners.filter((item) => item.type === 'unhandledrejection')).toHaveLength(1);
    expect(listeners.filter((item) => item.type === 'error')).toHaveLength(1);
  });

  it('wraps a Vue app once and preserves the original error handler', () => {
    const originalErrorHandler = vi.fn();
    const app = {
      config: {
        errorHandler: originalErrorHandler,
      },
    };
    const handler = setupUnifiedErrorHandler();

    handler?.initialize(app);
    handler?.initialize(app);

    const vueError = new Error('Vue exploded');
    app.config.errorHandler(vueError, { type: { name: 'BrokenComponent' } }, 'render function');

    expect(mockReportError).toHaveBeenCalledTimes(1);
    expect(mockReportError).toHaveBeenCalledWith(
      vueError,
      'Something went wrong',
      expect.objectContaining({
        source: 'vue',
        component: 'BrokenComponent',
        caller: ['vue-error-handler', 'render function'],
      }),
    );
    expect(originalErrorHandler).toHaveBeenCalledTimes(1);
  });

  it('suppresses opaque cross-origin script errors', () => {
    const handler = setupUnifiedErrorHandler();
    handler?.initialize();

    emitStoredEvent('error', {
      message: 'Script error.',
      error: null,
      filename: '',
      lineno: 0,
      colno: 0,
    } as ErrorEvent);

    expect(mockReportError).not.toHaveBeenCalled();
  });

  it('forwards ErrorEvent metadata for actionable global errors', () => {
    const handler = setupUnifiedErrorHandler();
    handler?.initialize();

    emitStoredEvent('error', {
      message: 'Boom',
      error: new Error('Boom'),
      filename: 'https://cdn.example.test/app.js?token=secret',
      lineno: 12,
      colno: 34,
      target: window,
    } as ErrorEvent);

    expect(mockReportError).toHaveBeenCalledWith(
      expect.any(Error),
      'Something went wrong',
      expect.objectContaining({
        source: 'global',
        errorEvent: expect.objectContaining({
          filename: 'https://cdn.example.test/app.js?token=secret',
          lineno: 12,
          colno: 34,
          message: 'Boom',
        }),
      }),
    );
  });
});
