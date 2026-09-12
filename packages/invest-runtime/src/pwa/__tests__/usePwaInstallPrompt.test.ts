/* eslint-disable vue/one-component-per-file */
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { mount } from '@vue/test-utils';
import { defineComponent, nextTick } from 'vue';
import {
  resetPwaInstallPromptRuntimeForTests,
  usePwaInstallPrompt,
} from '../usePwaInstallPrompt.ts';

const INSTALL_PROMPT_DISMISS_KEY = 'invest:pwa-install-prompt:dismissed-at';

type InstallPromptResult = ReturnType<typeof usePwaInstallPrompt>;

const createMatchMedia = (matches = false) => vi.fn().mockImplementation(() => ({
  matches,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
}));

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

const mountComposable = (options: { testHostname?: string } = {}) => {
  let api!: InstallPromptResult;
  const wrapper = mount(defineComponent({
    setup() {
      api = usePwaInstallPrompt(options);
      return () => null;
    },
  }));

  return { wrapper, api };
};

const dispatchBeforeInstallPrompt = (outcome: 'accepted' | 'dismissed' = 'accepted') => {
  const prompt = vi.fn().mockResolvedValue(undefined);
  const event = new Event('beforeinstallprompt');
  Object.assign(event, {
    prompt,
    userChoice: Promise.resolve({
      outcome,
      platform: 'web',
    }),
  });
  window.dispatchEvent(event);
  return { event, prompt };
};

const dispatchStorageUpdate = (dismissedAt: number | null) => {
  if (dismissedAt == null) {
    localStorage.removeItem(INSTALL_PROMPT_DISMISS_KEY);
  } else {
    localStorage.setItem(INSTALL_PROMPT_DISMISS_KEY, String(dismissedAt));
  }

  const event = new Event('storage');
  Object.assign(event, {
    key: INSTALL_PROMPT_DISMISS_KEY,
  });
  window.dispatchEvent(event);
};

const setDocumentVisibilityState = (value: DocumentVisibilityState) => {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    value,
  });
};

describe('usePwaInstallPrompt', () => {
  beforeEach(() => {
    resetPwaInstallPromptRuntimeForTests();
    localStorage.clear();
    sessionStorage.clear();
    window.history.replaceState({}, '', '/');
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: createMatchMedia(false),
    });
    setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)');
    setStandaloneNavigator(undefined);
    setDocumentVisibilityState('visible');
  });

  afterEach(() => {
    resetPwaInstallPromptRuntimeForTests();
    vi.restoreAllMocks();
  });

  it('shows the native install prompt after beforeinstallprompt fires and hides it after acceptance', async () => {
    setUserAgent('Mozilla/5.0 (Linux; Android 14; Pixel 8)');
    const { wrapper, api } = mountComposable();

    const { prompt } = dispatchBeforeInstallPrompt('accepted');
    await nextTick();

    expect(api.installState.value).toBe('native');
    expect(api.canInstall.value).toBe(true);

    await expect(api.promptInstall()).resolves.toBe('accepted');
    expect(prompt).toHaveBeenCalledTimes(1);
    expect(api.installState.value).toBe('hidden');
    expect(api.canInstall.value).toBe(false);

    wrapper.unmount();
  });

  it('persists dismissal cooldown after the native prompt is dismissed', async () => {
    setUserAgent('Mozilla/5.0 (Linux; Android 14; Pixel 8)');
    const firstMount = mountComposable();

    dispatchBeforeInstallPrompt('dismissed');
    await nextTick();
    await expect(firstMount.api.promptInstall()).resolves.toBe('dismissed');
    expect(localStorage.getItem(INSTALL_PROMPT_DISMISS_KEY)).toBeTruthy();

    firstMount.wrapper.unmount();

    const secondMount = mountComposable();
    dispatchBeforeInstallPrompt('accepted');
    await nextTick();

    expect(secondMount.api.installState.value).toBe('hidden');
    expect(secondMount.api.canInstall.value).toBe(false);

    secondMount.wrapper.unmount();
  });

  it('hides the prompt after the appinstalled event fires', async () => {
    setUserAgent('Mozilla/5.0 (Linux; Android 14; Pixel 8)');
    const { wrapper, api } = mountComposable();

    dispatchBeforeInstallPrompt('accepted');
    await nextTick();

    expect(api.installState.value).toBe('native');

    window.dispatchEvent(new Event('appinstalled'));
    await nextTick();

    expect(api.installState.value).toBe('hidden');
    expect(api.canInstall.value).toBe(false);

    wrapper.unmount();
  });

  it('ignores install events fired before mount finishes binding browser listeners', async () => {
    setUserAgent('Mozilla/5.0 (Linux; Android 14; Pixel 8)');
    let api!: InstallPromptResult;
    const prompt = vi.fn().mockResolvedValue(undefined);

    const wrapper = mount(defineComponent({
      setup() {
        api = usePwaInstallPrompt();

        const event = new Event('beforeinstallprompt');
        Object.assign(event, {
          prompt,
          userChoice: Promise.resolve({
            outcome: 'accepted',
            platform: 'web',
          }),
        });
        window.dispatchEvent(event);

        return () => null;
      },
    }));

    await nextTick();

    expect(api.installState.value).toBe('hidden');
    await expect(api.promptInstall()).resolves.toBeNull();
    expect(prompt).not.toHaveBeenCalled();

    wrapper.unmount();
  });

  it('keeps the pending install prompt across composable remounts in the same page session', async () => {
    setUserAgent('Mozilla/5.0 (Linux; Android 14; Pixel 8)');
    const firstMount = mountComposable();

    dispatchBeforeInstallPrompt('accepted');
    await nextTick();

    expect(firstMount.api.installState.value).toBe('native');
    firstMount.wrapper.unmount();

    const secondMount = mountComposable();
    await nextTick();

    expect(secondMount.api.installState.value).toBe('native');
    expect(secondMount.api.canInstall.value).toBe(true);

    secondMount.wrapper.unmount();
  });

  it('syncs prompt dismissal updates from storage while mounted', async () => {
    setUserAgent('Mozilla/5.0 (Linux; Android 14; Pixel 8)');
    const { wrapper, api } = mountComposable();

    dispatchBeforeInstallPrompt('accepted');
    await nextTick();

    expect(api.installState.value).toBe('native');

    dispatchStorageUpdate(Date.now());
    await nextTick();

    expect(api.installState.value).toBe('hidden');
    expect(api.canInstall.value).toBe(false);

    wrapper.unmount();
  });

  it('ignores unrelated storage events', async () => {
    setUserAgent('Mozilla/5.0 (Linux; Android 14; Pixel 8)');
    const { wrapper, api } = mountComposable();

    dispatchBeforeInstallPrompt('accepted');
    await nextTick();

    const event = new Event('storage');
    Object.assign(event, {
      key: 'invest:pwa:other-key',
    });
    window.dispatchEvent(event);
    await nextTick();

    expect(api.installState.value).toBe('native');

    wrapper.unmount();
  });

  it('keeps state unchanged when the storage event repeats the same dismissal timestamp', async () => {
    const dismissedAt = Date.now();
    localStorage.setItem(INSTALL_PROMPT_DISMISS_KEY, String(dismissedAt));

    const { wrapper, api } = mountComposable();
    await nextTick();

    expect(api.installState.value).toBe('hidden');

    dispatchStorageUpdate(dismissedAt);
    await nextTick();

    expect(api.installState.value).toBe('hidden');

    wrapper.unmount();
  });

  it('refreshes install state when the tab becomes visible and standalone mode changes', async () => {
    const { wrapper, api } = mountComposable();

    expect(api.installState.value).toBe('hidden');

    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: createMatchMedia(true),
    });
    setDocumentVisibilityState('visible');

    document.dispatchEvent(new Event('visibilitychange'));
    await nextTick();

    expect(api.installState.value).toBe('hidden');
    expect(api.canInstall.value).toBe(false);

    wrapper.unmount();
  });

  it('does nothing when the tab becomes visible but prompt state did not change', async () => {
    const { wrapper, api } = mountComposable();

    setDocumentVisibilityState('visible');
    document.dispatchEvent(new Event('visibilitychange'));
    await nextTick();

    expect(api.installState.value).toBe('hidden');

    wrapper.unmount();
  });

  it('ignores visibility changes while the tab is hidden', async () => {
    const { wrapper, api } = mountComposable();

    setDocumentVisibilityState('hidden');
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: createMatchMedia(true),
    });

    document.dispatchEvent(new Event('visibilitychange'));
    await nextTick();

    expect(api.installState.value).toBe('hidden');

    wrapper.unmount();
  });

  it('returns null when promptInstall is called without a deferred prompt', async () => {
    const { wrapper, api } = mountComposable();

    await expect(api.promptInstall()).resolves.toBeNull();

    wrapper.unmount();
  });

  it('can dismiss manually even when storage writes fail', async () => {
    const { wrapper, api } = mountComposable();
    vi.spyOn(window.localStorage.__proto__, 'setItem').mockImplementation(() => {
      throw new Error('storage disabled');
    });

    api.dismissInstallPrompt();
    await nextTick();

    expect(api.installState.value).toBe('hidden');

    wrapper.unmount();
  });

  it('can dismiss manually when window is unavailable', async () => {
    const { wrapper, api } = mountComposable();

    vi.stubGlobal('window', undefined);
    api.dismissInstallPrompt();
    vi.unstubAllGlobals();

    await nextTick();
    expect(api.installState.value).toBe('hidden');

    wrapper.unmount();
  });

  it('ignores the localhost test prompt event when test mode is not enabled', async () => {
    const { wrapper, api } = mountComposable();

    window.dispatchEvent(new CustomEvent('invest:pwa-test:before-install-prompt', {
      detail: { outcome: 'accepted' },
    }));
    await nextTick();

    expect(api.installState.value).toBe('hidden');

    wrapper.unmount();
  });

  it('keeps the install prompt hidden on desktop even if beforeinstallprompt fires', async () => {
    const { wrapper, api } = mountComposable();

    dispatchBeforeInstallPrompt('accepted');
    await nextTick();

    expect(api.installState.value).toBe('hidden');
    expect(api.canInstall.value).toBe(false);
    await expect(api.promptInstall()).resolves.toBeNull();

    wrapper.unmount();
  });

  it('shows the manual iOS install guidance when Safari does not expose beforeinstallprompt', () => {
    setUserAgent(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
    );

    const { wrapper, api } = mountComposable();

    expect(api.installState.value).toBe('manual-ios');
    expect(api.showManualInstall.value).toBe(true);
    expect(api.canInstall.value).toBe(false);

    wrapper.unmount();
  });

  it('ignores localStorage read failures and keeps the prompt logic usable', async () => {
    setUserAgent('Mozilla/5.0 (Linux; Android 14; Pixel 8)');
    vi.spyOn(window.localStorage.__proto__, 'getItem').mockImplementation(() => {
      throw new Error('storage disabled');
    });

    const { wrapper, api } = mountComposable();
    dispatchBeforeInstallPrompt('accepted');
    await nextTick();

    expect(api.installState.value).toBe('native');
    await expect(api.promptInstall()).resolves.toBe('accepted');

    wrapper.unmount();
  });

  it('keeps localhost PWA test mode enabled across same-tab route changes', async () => {
    setUserAgent('Mozilla/5.0 (Linux; Android 14; Pixel 8)');
    vi.spyOn(console, 'log').mockImplementation(() => {});
    window.history.replaceState({}, '', '/?__pwa_test=1');
    const firstMount = mountComposable();

    firstMount.wrapper.unmount();

    window.history.replaceState({}, '', '/dashboard');
    const secondMount = mountComposable();

    window.dispatchEvent(new CustomEvent('invest:pwa-test:before-install-prompt', {
      detail: { outcome: 'accepted' },
    }));
    await nextTick();

    expect(secondMount.api.installState.value).toBe('native');

    secondMount.wrapper.unmount();
  });

  it('keeps synthetic prompts local to the composable host policy', async () => {
    setUserAgent('Mozilla/5.0 (Linux; Android 14; Pixel 8)');
    const originalLocation = window.location;
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: new URL('https://ilocal.webdevelop.biz/?__pwa_test=1'),
    });

    const optedIn = mountComposable({ testHostname: 'ilocal.webdevelop.biz' });
    const optedOut = mountComposable({ testHostname: 'other.webdevelop.biz' });

    window.dispatchEvent(new CustomEvent('invest:pwa-test:before-install-prompt', {
      detail: { outcome: 'accepted' },
    }));
    await nextTick();

    expect(optedIn.api.installState.value).toBe('native');
    expect(optedOut.api.installState.value).toBe('hidden');

    optedIn.wrapper.unmount();
    optedOut.wrapper.unmount();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalLocation,
    });
  });

  it('does not persist a synthetic dismissal or consume another host policy consumer\'s real prompt', async () => {
    setUserAgent('Mozilla/5.0 (Linux; Android 14; Pixel 8)');
    const originalLocation = window.location;
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: new URL('https://ilocal.webdevelop.biz/?__pwa_test=1'),
    });

    const optedIn = mountComposable({ testHostname: 'ilocal.webdevelop.biz' });
    const optedOut = mountComposable({ testHostname: 'other.webdevelop.biz' });
    const { prompt } = dispatchBeforeInstallPrompt('accepted');
    await nextTick();

    expect(optedIn.api.installState.value).toBe('native');
    expect(optedOut.api.installState.value).toBe('native');

    window.dispatchEvent(new CustomEvent('invest:pwa-test:before-install-prompt', {
      detail: { outcome: 'dismissed' },
    }));
    await nextTick();

    await expect(optedIn.api.promptInstall()).resolves.toBe('dismissed');
    expect(localStorage.getItem(INSTALL_PROMPT_DISMISS_KEY)).toBeNull();
    expect(optedOut.api.installState.value).toBe('native');
    expect(optedOut.api.canInstall.value).toBe(true);

    await expect(optedOut.api.promptInstall()).resolves.toBe('accepted');
    expect(prompt).toHaveBeenCalledTimes(1);
    await nextTick();
    expect(optedIn.api.installState.value).toBe('hidden');
    expect(optedOut.api.installState.value).toBe('hidden');

    optedIn.wrapper.unmount();
    optedOut.wrapper.unmount();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalLocation,
    });
  });

  it('keeps manual dismissal of a synthetic prompt local to its host policy consumer', async () => {
    setUserAgent('Mozilla/5.0 (Linux; Android 14; Pixel 8)');
    const originalLocation = window.location;
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: new URL('https://ilocal.webdevelop.biz/?__pwa_test=1'),
    });

    const optedIn = mountComposable({ testHostname: 'ilocal.webdevelop.biz' });
    const optedOut = mountComposable({ testHostname: 'other.webdevelop.biz' });
    const { prompt } = dispatchBeforeInstallPrompt('accepted');
    await nextTick();

    window.dispatchEvent(new CustomEvent('invest:pwa-test:before-install-prompt', {
      detail: { outcome: 'accepted' },
    }));
    await nextTick();

    optedIn.api.dismissInstallPrompt('dismissed-by-user');
    await nextTick();

    expect(localStorage.getItem(INSTALL_PROMPT_DISMISS_KEY)).toBeNull();
    expect(optedOut.api.installState.value).toBe('native');
    expect(optedOut.api.canInstall.value).toBe(true);

    await expect(optedOut.api.promptInstall()).resolves.toBe('accepted');
    expect(prompt).toHaveBeenCalledTimes(1);
    await nextTick();
    expect(optedIn.api.installState.value).toBe('hidden');
    expect(optedOut.api.installState.value).toBe('hidden');

    optedIn.wrapper.unmount();
    optedOut.wrapper.unmount();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalLocation,
    });
  });

  it('keeps native manual dismissal shared across two consumers', async () => {
    setUserAgent('Mozilla/5.0 (Linux; Android 14; Pixel 8)');
    const firstConsumer = mountComposable();
    const secondConsumer = mountComposable();

    dispatchBeforeInstallPrompt('accepted');
    await nextTick();

    expect(firstConsumer.api.installState.value).toBe('native');
    expect(secondConsumer.api.installState.value).toBe('native');

    firstConsumer.api.dismissInstallPrompt('dismissed-by-user');
    await nextTick();

    expect(localStorage.getItem(INSTALL_PROMPT_DISMISS_KEY)).toBeTruthy();
    expect(firstConsumer.api.installState.value).toBe('hidden');
    expect(secondConsumer.api.installState.value).toBe('hidden');

    firstConsumer.wrapper.unmount();
    secondConsumer.wrapper.unmount();
  });
});
