import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import {
  isIosSafariBrowser,
  isInstallPromptSupportedDevice,
  isPwaMobile,
  isPwaStandalone,
} from '../pwaDetector.ts';

const setUserAgent = (value: string) => {
  Object.defineProperty(window.navigator, 'userAgent', {
    configurable: true,
    value,
  });
};

const setStandaloneNavigator = (value?: boolean) => {
  Object.defineProperty(window.navigator, 'standalone', {
    configurable: true,
    value,
  });
};

const setMatchMedia = (standalone = false, overlay = false) => {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches: query === '(display-mode: standalone)'
        ? standalone
        : overlay,
    }),
  });
};

describe('pwaDetector', () => {
  afterEach(() => {
    setStandaloneNavigator(undefined);
    setMatchMedia(false, false);
  });

  it('detects standalone mode from navigator.standalone', () => {
    setStandaloneNavigator(true);

    expect(isPwaStandalone()).toBe(true);
  });

  it('detects standalone mode from matchMedia display modes', () => {
    setStandaloneNavigator(undefined);
    setMatchMedia(true, false);
    expect(isPwaStandalone()).toBe(true);

    setMatchMedia(false, true);
    expect(isPwaStandalone()).toBe(true);
  });

  it('returns false when no standalone display mode is active', () => {
    setStandaloneNavigator(undefined);
    setMatchMedia(false, false);

    expect(isPwaStandalone()).toBe(false);
  });

  it('detects iOS Safari and excludes other iOS browsers', () => {
    setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1');
    expect(isIosSafariBrowser()).toBe(true);

    setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/122.0.0.0 Mobile/15E148 Safari/604.1');
    expect(isIosSafariBrowser()).toBe(false);
  });

  it('detects install-prompt-supported devices and excludes desktop browsers', () => {
    setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)');
    expect(isInstallPromptSupportedDevice()).toBe(false);

    setUserAgent('Mozilla/5.0 (Linux; Android 14; Pixel 8)');
    expect(isInstallPromptSupportedDevice()).toBe(true);

    setUserAgent('Mozilla/5.0 (iPad; CPU OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1');
    expect(isInstallPromptSupportedDevice()).toBe(true);
  });

  it('detects mobile PWAs only when both standalone and phone user agent are present', () => {
    setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1');
    setStandaloneNavigator(true);

    expect(isPwaMobile()).toBe(true);

    setStandaloneNavigator(undefined);
    setMatchMedia(false, false);
    expect(isPwaMobile()).toBe(false);
  });

  it('returns false for iOS Safari detection when navigator is unavailable', () => {
    vi.stubGlobal('navigator', undefined);

    expect(isIosSafariBrowser()).toBe(false);

    vi.unstubAllGlobals();
  });

  it('returns false for standalone and mobile checks when window is unavailable', () => {
    vi.stubGlobal('window', undefined);

    expect(isPwaStandalone()).toBe(false);
    expect(isPwaMobile()).toBe(false);

    vi.unstubAllGlobals();
  });
});
