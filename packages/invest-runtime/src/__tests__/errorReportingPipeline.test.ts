import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import {
  reportError,
  setErrorLogger,
  setErrorReporter,
  setErrorUiReporter,
} from '../error/errorReporting.ts';
import { APIError } from '@global-torque/invest-data/service/handlers/apiError';

describe('runtime error reporting pipeline', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setErrorLogger(null);
    setErrorReporter(null);
    setErrorUiReporter(null);
    Object.defineProperty(window.navigator, 'onLine', {
      configurable: true,
      value: true,
    });
  });

  afterEach(() => {
    setErrorLogger(null);
    setErrorReporter(null);
    setErrorUiReporter(null);
  });

  it('keeps analytics logging while routing visible errors through a UI-only reporter', () => {
    const logger = vi.fn();
    const uiReporter = vi.fn();

    setErrorLogger(logger);
    setErrorUiReporter(uiReporter);

    reportError(new Error('Boom'), 'Fallback');

    expect(logger).toHaveBeenCalledTimes(1);
    expect(uiReporter).toHaveBeenCalledTimes(1);
    expect(uiReporter).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Fallback',
      description: 'Boom',
      presentation: 'toast',
    }));
  });

  it('reports initialized API envelope details to the global UI reporter', async () => {
    const logger = vi.fn();
    const uiReporter = vi.fn();
    const error = new APIError(
      'Failed to create investment',
      new Response(JSON.stringify({
        error: {
          status: 400,
          message: 'Bad Request',
          details: { amount: ['Amount must be at least 100'] },
        },
      }), { status: 400 }),
    );
    await error.initializeResponseJson();

    setErrorLogger(logger);
    setErrorUiReporter(uiReporter);
    reportError(error, 'Investment failed');

    expect(logger).toHaveBeenCalledTimes(1);
    expect(uiReporter).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Investment failed',
      description: 'Amount must be at least 100',
      presentation: 'toast',
    }));
  });

  it('does not call the UI reporter for silent global contexts', () => {
    const logger = vi.fn();
    const uiReporter = vi.fn();

    setErrorLogger(logger);
    setErrorUiReporter(uiReporter);

    reportError(new Error('Boom'), 'Fallback', { source: 'global', silent: true });

    expect(logger).toHaveBeenCalledTimes(1);
    expect(uiReporter).not.toHaveBeenCalled();
  });
});
