import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import {
  isLocalPwaTestEnabled,
  isLocalPwaTestHost,
  isPwaDebugEnabled,
  logPwaDebug,
  toPwaDebugError,
} from '../pwaDebug.ts';

describe('pwaDebug', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    window.history.replaceState({}, '', '/');
    vi.restoreAllMocks();
  });

  it('enables debug mode from the query string or local storage', () => {
    window.history.replaceState({}, '', '/?__pwa_debug=1');
    expect(isPwaDebugEnabled()).toBe(true);

    window.history.replaceState({}, '', '/');
    localStorage.setItem('invest:pwa:debug', 'true');
    expect(isPwaDebugEnabled()).toBe(true);
  });

  it('enables debug mode when localhost test mode is active', () => {
    window.history.replaceState({}, '', '/?__pwa_test=1');

    expect(isPwaDebugEnabled()).toBe(true);
  });

  it('returns false when debug storage cannot be read', () => {
    vi.spyOn(window.localStorage.__proto__, 'getItem').mockImplementation(() => {
      throw new Error('storage unavailable');
    });

    expect(isPwaDebugEnabled()).toBe(false);
  });

  it('returns false when window is unavailable', () => {
    vi.stubGlobal('window', undefined);

    expect(isPwaDebugEnabled()).toBe(false);
    expect(isLocalPwaTestHost()).toBe(false);

    vi.unstubAllGlobals();
  });

  it('detects whether localhost-only PWA test mode is enabled', () => {
    window.history.replaceState({}, '', '/?__pwa_test=1');

    expect(isLocalPwaTestHost()).toBe(true);
    expect(isLocalPwaTestEnabled()).toBe(true);

    window.history.replaceState({}, '', '/dashboard');
    expect(isLocalPwaTestEnabled()).toBe(true);
  });

  it('requires exact opt-in for the documented ilocal hostname', () => {
    const originalLocation = window.location;

    Object.defineProperty(window, 'location', {
      configurable: true,
      value: new URL('https://ilocal.webdevelop.biz:8080/?__pwa_test=1'),
    });

    expect(isLocalPwaTestHost()).toBe(false);
    expect(isLocalPwaTestEnabled()).toBe(false);
    expect(isLocalPwaTestHost('ilocal.webdevelop.biz')).toBe(true);
    expect(isLocalPwaTestEnabled('ilocal.webdevelop.biz')).toBe(true);

    Object.defineProperty(window, 'location', {
      configurable: true,
      value: new URL('https://preview.ilocal.webdevelop.biz/?__pwa_test=1'),
    });

    expect(isLocalPwaTestHost('ilocal.webdevelop.biz')).toBe(false);
    expect(isLocalPwaTestEnabled('ilocal.webdevelop.biz')).toBe(false);

    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalLocation,
    });
  });

  it('returns false for non-local hosts', () => {
    const originalLocation = window.location;

    Object.defineProperty(window, 'location', {
      configurable: true,
      value: new URL('https://invest.example.test/dashboard'),
    });

    expect(isLocalPwaTestHost()).toBe(false);
    expect(isLocalPwaTestEnabled()).toBe(false);

    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalLocation,
    });
  });

  it('gracefully handles session storage failures for test mode flags', () => {
    vi.spyOn(window.sessionStorage, 'setItem').mockImplementation(() => {
      throw new Error('write denied');
    });

    window.history.replaceState({}, '', '/?__pwa_test=1');
    expect(isLocalPwaTestEnabled()).toBe(true);

    window.history.replaceState({}, '', '/dashboard');
    vi.spyOn(window.sessionStorage, 'getItem').mockImplementation(() => {
      throw new Error('read denied');
    });

    expect(isLocalPwaTestEnabled()).toBe(false);
  });

  it('normalizes errors for debug payloads', () => {
    expect(toPwaDebugError(new Error('boom'))).toEqual({
      name: 'Error',
      message: 'boom',
    });
    expect(toPwaDebugError('plain')).toBe('plain');
  });

  it('logs only when debug mode is enabled', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    logPwaDebug('install', 'hidden');
    expect(consoleSpy).not.toHaveBeenCalled();

    window.history.replaceState({}, '', '/offers?__pwa_debug=1');
    logPwaDebug('install', 'shown', { installState: 'native' });

    expect(consoleSpy).toHaveBeenCalledWith('[pwa-debug:install]', {
      message: 'shown',
      pathname: '/offers',
      installState: 'native',
    });
  });
});
