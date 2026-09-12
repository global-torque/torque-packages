import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { mount } from '@vue/test-utils';
import {
  defineComponent,
  nextTick,
  shallowRef,
} from 'vue';
import * as pwaUpdatePromptModule from '../usePwaUpdatePrompt.ts';
import { setPwaRegistrationBridgeFactory } from '../pwaRegistrationBridge.ts';

const { usePwaUpdatePrompt } = pwaUpdatePromptModule;
const UPDATE_PROMPT_DISMISS_KEY = 'invest:pwa-update-prompt:dismissed-key';

type PwaUpdateResult = ReturnType<typeof usePwaUpdatePrompt>;
type ControllerChangeListener = EventListenerOrEventListenerObject;
type RegistrationListener = EventListenerOrEventListenerObject;

const needRefresh = shallowRef(false);
const offlineReady = shallowRef(false);
let shouldThrow = false;
let updateServiceWorker = async () => {};

const resetBridgeMock = () => {
  needRefresh.value = false;
  offlineReady.value = false;
  shouldThrow = false;
  updateServiceWorker = async () => {};
};

const setBridgeMockState = (next: {
  needRefresh?: boolean;
  offlineReady?: boolean;
  shouldThrow?: boolean;
  updateServiceWorker?: (reloadPage?: boolean) => Promise<void>;
}) => {
  if (typeof next.needRefresh === 'boolean') {
    needRefresh.value = next.needRefresh;
  }
  if (typeof next.offlineReady === 'boolean') {
    offlineReady.value = next.offlineReady;
  }
  if (typeof next.shouldThrow === 'boolean') {
    shouldThrow = next.shouldThrow;
  }
  if (next.updateServiceWorker) {
    updateServiceWorker = next.updateServiceWorker;
  }
};

const installBridgeMock = () => {
  setPwaRegistrationBridgeFactory(() => {
    if (shouldThrow) {
      throw new Error('mock register failed');
    }

    return {
      needRefresh,
      offlineReady,
      updateServiceWorker,
    };
  });
};

const mountComposable = (options: { testHostname?: string } = {}) => {
  let api!: PwaUpdateResult;
  const wrapper = mount(defineComponent({
    setup() {
      api = usePwaUpdatePrompt(options);
      return () => null;
    },
  }));

  return { wrapper, api };
};

const mockServiceWorkerContainer = (options: {
  controller?: ServiceWorker | null;
  getRegistration?: () => Promise<ServiceWorkerRegistration | null>;
  ready?: Promise<ServiceWorkerRegistration>;
} = {}) => {
  const listeners = new Set<ControllerChangeListener>();

  Object.defineProperty(window.navigator, 'serviceWorker', {
    configurable: true,
    value: {
      controller: options.controller ?? null,
      addEventListener: vi.fn((eventName: string, listener: ControllerChangeListener) => {
        if (eventName === 'controllerchange') {
          listeners.add(listener);
        }
      }),
      removeEventListener: vi.fn((eventName: string, listener: ControllerChangeListener) => {
        if (eventName === 'controllerchange') {
          listeners.delete(listener);
        }
      }),
      getRegistration: vi.fn(options.getRegistration ?? (() => Promise.resolve(null))),
      ready: options.ready ?? Promise.resolve({} as ServiceWorkerRegistration),
    },
  });

  return {
    dispatchControllerChange() {
      const event = new Event('controllerchange');

      for (const listener of listeners) {
        if (typeof listener === 'function') {
          listener(event);
        } else {
          listener.handleEvent(event);
        }
      }
    },
  };
};

const createServiceWorkerRegistration = (options: {
  installing?: ServiceWorker | null;
  waiting?: ServiceWorker | null;
}) => {
  const listeners = new Set<RegistrationListener>();

  const registration = {
    installing: options.installing ?? null,
    waiting: options.waiting ?? null,
    addEventListener: vi.fn((eventName: string, listener: RegistrationListener) => {
      if (eventName === 'updatefound') {
        listeners.add(listener);
      }
    }),
    removeEventListener: vi.fn((eventName: string, listener: RegistrationListener) => {
      if (eventName === 'updatefound') {
        listeners.delete(listener);
      }
    }),
  } as unknown as ServiceWorkerRegistration;

  return {
    registration,
    dispatchUpdateFound() {
      const event = new Event('updatefound');

      for (const listener of listeners) {
        if (typeof listener === 'function') {
          listener(event);
        } else {
          listener.handleEvent(event);
        }
      }
    },
  };
};

const createServiceWorker = () => {
  const listeners = new Set<EventListenerOrEventListenerObject>();
  const worker = {
    state: 'installing',
    addEventListener: vi.fn((eventName: string, listener: EventListenerOrEventListenerObject) => {
      if (eventName === 'statechange') {
        listeners.add(listener);
      }
    }),
    removeEventListener: vi.fn((eventName: string, listener: EventListenerOrEventListenerObject) => {
      if (eventName === 'statechange') {
        listeners.delete(listener);
      }
    }),
  } as unknown as ServiceWorker;

  return {
    worker,
    setState(nextState: ServiceWorkerState) {
      (worker as { state: ServiceWorkerState }).state = nextState;
      const event = new Event('statechange');

      for (const listener of listeners) {
        if (typeof listener === 'function') {
          listener(event);
        } else {
          listener.handleEvent(event);
        }
      }
    },
  };
};

const flushMicrotasks = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

const createDeferred = <T>() => {
  let resolvePromise!: (value: T | PromiseLike<T>) => void;
  let rejectPromise!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolve, reject) => {
    resolvePromise = resolve;
    rejectPromise = reject;
  });

  return {
    promise,
    resolve: resolvePromise,
    reject: rejectPromise,
  };
};

describe('usePwaUpdatePrompt', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    window.history.replaceState({}, '', '/?__pwa_test=1');
    localStorage.clear();
    sessionStorage.clear();
    resetBridgeMock();
    installBridgeMock();
    Reflect.deleteProperty(window.navigator, 'serviceWorker');
  });

  afterEach(() => {
    setPwaRegistrationBridgeFactory(null);
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('starts idle when no offline-ready or update-ready state is present', () => {
    const { wrapper, api } = mountComposable();

    expect(api.lifecycleState.value).toBe('idle');
    expect(api.isOfflineReady.value).toBe(false);
    expect(api.isUpdateReady.value).toBe(false);

    wrapper.unmount();
  });

  it('surfaces offline-ready lifecycle from the service worker registration refs', async () => {
    setBridgeMockState({ offlineReady: true });
    const { wrapper, api } = mountComposable();
    await nextTick();

    expect(api.isOfflineReady.value).toBe(true);
    expect(api.lifecycleState.value).toBe('offlineReady');

    wrapper.unmount();
  });

  it('surfaces update-ready lifecycle from the service worker registration refs', async () => {
    setBridgeMockState({ needRefresh: true });
    const { wrapper, api } = mountComposable();
    await nextTick();

    expect(api.isUpdateReady.value).toBe(true);
    expect(api.lifecycleState.value).toBe('updateReady');

    wrapper.unmount();
  });

  it('switches to reloading state when refresh is accepted', async () => {
    const serviceWorker = mockServiceWorkerContainer();
    const updateServiceWorker = vi.fn().mockResolvedValue(undefined);
    setBridgeMockState({
      needRefresh: true,
      updateServiceWorker,
    });
    const { wrapper, api } = mountComposable();
    const reloadPromise = api.reloadApp();

    expect(api.lifecycleState.value).toBe('reloading');
    expect(updateServiceWorker).toHaveBeenCalledWith(true);

    serviceWorker.dispatchControllerChange();
    await reloadPromise;

    expect(api.lifecycleState.value).toBe('idle');
    expect(api.isUpdateReady.value).toBe(false);

    wrapper.unmount();
  });

  it('surfaces registration errors as a first-class lifecycle state', () => {
    setBridgeMockState({ shouldThrow: true });
    const { wrapper, api } = mountComposable();

    expect(api.lifecycleState.value).toBe('registrationError');
    expect(api.registrationError.value).toBeInstanceOf(Error);

    wrapper.unmount();
  });

  it('supports the localhost-only update-ready test hook', async () => {
    const { wrapper, api } = mountComposable();

    window.dispatchEvent(new Event('invest:pwa-test:update-ready'));
    await nextTick();

    expect(api.isUpdateReady.value).toBe(true);
    expect(api.lifecycleState.value).toBe('updateReady');

    wrapper.unmount();
  });

  it('ignores the localhost-only update-ready hook when test mode is not enabled', async () => {
    window.history.replaceState({}, '', '/dashboard');
    const { wrapper, api } = mountComposable();

    window.dispatchEvent(new Event('invest:pwa-test:update-ready'));
    await nextTick();

    expect(api.isUpdateReady.value).toBe(false);
    expect(api.lifecycleState.value).toBe('idle');

    wrapper.unmount();
  });

  it('clears update-ready state when the prompt is dismissed', async () => {
    setBridgeMockState({ needRefresh: true });
    const { wrapper, api } = mountComposable();
    await nextTick();

    expect(api.isUpdateReady.value).toBe(true);
    expect(api.lifecycleState.value).toBe('updateReady');

    api.dismissUpdateReady();

    expect(api.isUpdateReady.value).toBe(false);
    expect(api.lifecycleState.value).toBe('idle');
    expect(localStorage.getItem(UPDATE_PROMPT_DISMISS_KEY)).toBe('updateReady');

    wrapper.unmount();
  });

  it('lets the localhost update-ready test hook reopen a dismissed update prompt', async () => {
    const { wrapper, api } = mountComposable();

    window.dispatchEvent(new Event('invest:pwa-test:update-ready'));
    await nextTick();

    expect(api.isUpdateReady.value).toBe(true);

    api.dismissUpdateReady();

    expect(api.isUpdateReady.value).toBe(false);
    expect(localStorage.getItem(UPDATE_PROMPT_DISMISS_KEY)).toBe('updateReady');

    window.dispatchEvent(new Event('invest:pwa-test:update-ready'));
    await nextTick();

    expect(api.isUpdateReady.value).toBe(true);
    expect(localStorage.getItem(UPDATE_PROMPT_DISMISS_KEY)).toBeNull();

    wrapper.unmount();
  });

  it('keeps synthetic update state local to the composable host policy', async () => {
    const originalLocation = window.location;
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: new URL('https://ilocal.webdevelop.biz/?__pwa_test=1'),
    });

    const optedIn = mountComposable({ testHostname: 'ilocal.webdevelop.biz' });
    const optedOut = mountComposable({ testHostname: 'other.webdevelop.biz' });

    window.dispatchEvent(new Event('invest:pwa-test:update-ready'));
    await nextTick();

    expect(optedIn.api.isUpdateReady.value).toBe(true);
    expect(optedOut.api.isUpdateReady.value).toBe(false);

    optedIn.wrapper.unmount();
    optedOut.wrapper.unmount();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalLocation,
    });
  });

  it('keeps update-ready dismissed across remount while the same update state remains active', async () => {
    setBridgeMockState({ needRefresh: true });
    const firstMount = mountComposable();
    await nextTick();

    firstMount.api.dismissUpdateReady();
    expect(firstMount.api.isUpdateReady.value).toBe(false);

    firstMount.wrapper.unmount();

    const secondMount = mountComposable();
    await nextTick();

    expect(secondMount.api.isUpdateReady.value).toBe(false);
    expect(secondMount.api.lifecycleState.value).toBe('idle');

    secondMount.wrapper.unmount();
  });

  it('returns to update-ready state when the new worker does not claim the page in time', async () => {
    vi.useFakeTimers();
    mockServiceWorkerContainer();
    const updateServiceWorker = vi.fn().mockResolvedValue(undefined);

    setBridgeMockState({
      needRefresh: true,
      updateServiceWorker,
    });

    const { wrapper, api } = mountComposable();
    const reloadPromise = api.reloadApp();

    await vi.advanceTimersByTimeAsync(2_500);
    await reloadPromise;

    expect(updateServiceWorker).toHaveBeenCalledWith(true);
    expect(api.lifecycleState.value).toBe('updateReady');
    expect(api.isUpdateReady.value).toBe(true);

    wrapper.unmount();
  });

  it('resolves the refresh attempt when controllerchange fires promptly', async () => {
    vi.useFakeTimers();
    const serviceWorker = mockServiceWorkerContainer();
    const updateServiceWorker = vi.fn().mockResolvedValue(undefined);

    setBridgeMockState({
      needRefresh: true,
      updateServiceWorker,
    });

    const { wrapper, api } = mountComposable();
    const reloadPromise = api.reloadApp();

    serviceWorker.dispatchControllerChange();
    await reloadPromise;

    expect(updateServiceWorker).toHaveBeenCalledWith(true);
    expect(api.lifecycleState.value).toBe('idle');
    expect(api.isUpdateReady.value).toBe(false);

    wrapper.unmount();
  });

  it('leaves reloading state immediately when no service worker container exists', async () => {
    const updateServiceWorkerSpy = vi.fn().mockResolvedValue(undefined);
    setBridgeMockState({
      needRefresh: true,
      updateServiceWorker: updateServiceWorkerSpy,
    });

    const { wrapper, api } = mountComposable();
    await api.reloadApp();

    expect(updateServiceWorkerSpy).toHaveBeenCalledWith(true);
    expect(api.lifecycleState.value).toBe('updateReady');

    wrapper.unmount();
  });

  it('clears offline-ready state when dismissed', async () => {
    setBridgeMockState({ offlineReady: true });
    const { wrapper, api } = mountComposable();
    await nextTick();

    expect(api.isOfflineReady.value).toBe(true);

    api.dismissOfflineReady();

    expect(api.isOfflineReady.value).toBe(false);
    expect(api.lifecycleState.value).toBe('idle');
    expect(localStorage.getItem(UPDATE_PROMPT_DISMISS_KEY)).toBe('offlineReady');

    wrapper.unmount();
  });

  it('keeps offline-ready dismissed across remount while the same state remains active', async () => {
    setBridgeMockState({ offlineReady: true });
    const firstMount = mountComposable();
    await nextTick();

    firstMount.api.dismissOfflineReady();
    expect(firstMount.api.isOfflineReady.value).toBe(false);

    firstMount.wrapper.unmount();

    const secondMount = mountComposable();
    await nextTick();

    expect(secondMount.api.isOfflineReady.value).toBe(false);
    expect(secondMount.api.lifecycleState.value).toBe('idle');

    secondMount.wrapper.unmount();
  });

  it('ignores dismiss actions when the registration bridge failed to initialize', () => {
    setBridgeMockState({ shouldThrow: true });
    const { wrapper, api } = mountComposable();

    api.dismissOfflineReady();
    api.dismissUpdateReady();

    expect(api.lifecycleState.value).toBe('registrationError');

    wrapper.unmount();
  });

  it('unmounts safely when window becomes unavailable', () => {
    const { wrapper } = mountComposable();

    vi.stubGlobal('window', undefined);
    wrapper.unmount();
    vi.unstubAllGlobals();
  });

  it('resets local test update-ready state when controllerchange fires', async () => {
    const serviceWorker = mockServiceWorkerContainer();
    const { wrapper, api } = mountComposable();

    window.dispatchEvent(new Event('invest:pwa-test:update-ready'));
    await nextTick();
    expect(api.isUpdateReady.value).toBe(true);

    api.dismissUpdateReady();
    expect(localStorage.getItem(UPDATE_PROMPT_DISMISS_KEY)).toBe('updateReady');

    serviceWorker.dispatchControllerChange();
    await nextTick();

    expect(api.isUpdateReady.value).toBe(false);
    expect(api.lifecycleState.value).toBe('idle');
    expect(localStorage.getItem(UPDATE_PROMPT_DISMISS_KEY)).toBeNull();

    wrapper.unmount();
  });

  it('shows a new prompt kind after clearing the previous dismissal', async () => {
    setBridgeMockState({ offlineReady: true });
    const { wrapper, api } = mountComposable();
    await nextTick();

    api.dismissOfflineReady();
    expect(api.isOfflineReady.value).toBe(false);

    setBridgeMockState({
      offlineReady: false,
      needRefresh: true,
    });
    await nextTick();

    expect(localStorage.getItem(UPDATE_PROMPT_DISMISS_KEY)).toBeNull();
    expect(api.isUpdateReady.value).toBe(true);
    expect(api.lifecycleState.value).toBe('updateReady');

    wrapper.unmount();
  });

  it('resets reloading state and rethrows when refresh fails', async () => {
    const serviceWorker = mockServiceWorkerContainer();
    const refreshError = new Error('refresh failed');
    const updateServiceWorkerSpy = vi.fn().mockRejectedValue(refreshError);

    setBridgeMockState({
      needRefresh: true,
      updateServiceWorker: updateServiceWorkerSpy,
    });

    const { wrapper, api } = mountComposable();

    await expect(api.reloadApp()).rejects.toThrow('refresh failed');
    expect(updateServiceWorkerSpy).toHaveBeenCalledWith(true);
    expect(api.lifecycleState.value).toBe('updateReady');

    serviceWorker.dispatchControllerChange();
    wrapper.unmount();
  });

  it('falls back to browser service worker APIs when no host bridge is installed', async () => {
    const postMessage = vi.fn();
    const waitingWorker = { postMessage } as unknown as ServiceWorker;
    const { registration } = createServiceWorkerRegistration({
      waiting: waitingWorker,
    });
    const serviceWorker = mockServiceWorkerContainer({
      controller: {} as ServiceWorker,
      getRegistration: async () => registration,
      ready: Promise.resolve(registration),
    });

    setPwaRegistrationBridgeFactory(null);

    const { wrapper, api } = mountComposable();
    await flushMicrotasks();
    await nextTick();

    expect(api.isUpdateReady.value).toBe(true);

    const reloadPromise = api.reloadApp();
    expect(postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });

    serviceWorker.dispatchControllerChange();
    await reloadPromise;

    wrapper.unmount();
  });

  it('surfaces offline-ready state from browser service worker installation events', async () => {
    const installingWorker = createServiceWorker();
    const registration = createServiceWorkerRegistration({
      installing: installingWorker.worker,
    });

    mockServiceWorkerContainer({
      controller: null,
      getRegistration: async () => registration.registration,
      ready: Promise.resolve(registration.registration),
    });

    setPwaRegistrationBridgeFactory(null);

    const { wrapper, api } = mountComposable();
    await flushMicrotasks();
    await nextTick();

    registration.dispatchUpdateFound();
    installingWorker.setState('installed');
    await nextTick();

    expect(api.isOfflineReady.value).toBe(true);
    expect(api.lifecycleState.value).toBe('offlineReady');

    wrapper.unmount();
  });

  it('does not reattach browser registration listeners after unmount when serviceWorker.ready resolves late', async () => {
    const readyRegistration = createServiceWorkerRegistration({});
    const readyDeferred = createDeferred<ServiceWorkerRegistration>();

    mockServiceWorkerContainer({
      controller: null,
      getRegistration: async () => null,
      ready: readyDeferred.promise,
    });

    setPwaRegistrationBridgeFactory(null);

    const { wrapper } = mountComposable();
    await flushMicrotasks();

    wrapper.unmount();

    readyDeferred.resolve(readyRegistration.registration);
    await flushMicrotasks();

    expect(readyRegistration.registration.addEventListener).not.toHaveBeenCalled();
  });
});
