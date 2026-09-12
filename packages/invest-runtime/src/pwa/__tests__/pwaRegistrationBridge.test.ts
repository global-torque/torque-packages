import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { shallowRef } from 'vue';
import {
  setPwaRegistrationBridgeFactory,
  usePwaRegistrationBridge,
} from '../pwaRegistrationBridge.ts';

type RegistrationListener = EventListenerOrEventListenerObject;
type WorkerListener = EventListenerOrEventListenerObject;

const createServiceWorker = () => {
  const listeners = new Set<WorkerListener>();
  const worker = {
    state: 'installing',
    addEventListener: vi.fn((eventName: string, listener: WorkerListener) => {
      if (eventName === 'statechange') {
        listeners.add(listener);
      }
    }),
    removeEventListener: vi.fn((eventName: string, listener: WorkerListener) => {
      if (eventName === 'statechange') {
        listeners.delete(listener);
      }
    }),
  } as unknown as ServiceWorker;

  return {
    worker,
    dispatchStateChange(nextState: ServiceWorkerState) {
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

const createRegistration = (options: {
  installing?: ServiceWorker | null;
  waiting?: ServiceWorker | null;
  scope?: string;
}) => {
  const listeners = new Set<RegistrationListener>();
  const registration = {
    scope: options.scope ?? '/scope',
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

const mockServiceWorkerContainer = (options: {
  controller?: ServiceWorker | null;
  getRegistration?: () => Promise<ServiceWorkerRegistration | null>;
  ready?: Promise<ServiceWorkerRegistration>;
} = {}) => {
  const controllerListeners = new Set<EventListenerOrEventListenerObject>();

  Object.defineProperty(window.navigator, 'serviceWorker', {
    configurable: true,
    value: {
      controller: options.controller ?? null,
      addEventListener: vi.fn((eventName: string, listener: EventListenerOrEventListenerObject) => {
        if (eventName === 'controllerchange') {
          controllerListeners.add(listener);
        }
      }),
      removeEventListener: vi.fn((eventName: string, listener: EventListenerOrEventListenerObject) => {
        if (eventName === 'controllerchange') {
          controllerListeners.delete(listener);
        }
      }),
      getRegistration: vi.fn(options.getRegistration ?? (() => Promise.resolve(null))),
      ready: options.ready ?? Promise.resolve({} as ServiceWorkerRegistration),
    },
  });

  return {
    dispatchControllerChange() {
      const event = new Event('controllerchange');

      for (const listener of controllerListeners) {
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

describe('pwaRegistrationBridge', () => {
  beforeEach(() => {
    setPwaRegistrationBridgeFactory(null);
    Reflect.deleteProperty(window.navigator, 'serviceWorker');
  });

  afterEach(() => {
    setPwaRegistrationBridgeFactory(null);
    vi.restoreAllMocks();
  });

  it('uses the injected bridge factory when provided', () => {
    const injectedBridge = {
      needRefresh: shallowRef(false),
      offlineReady: shallowRef(false),
      updateServiceWorker: vi.fn(),
    };
    setPwaRegistrationBridgeFactory(() => injectedBridge);

    expect(usePwaRegistrationBridge()).toBe(injectedBridge);
  });

  it('falls back to a noop bridge when service workers are unsupported', async () => {
    const bridge = usePwaRegistrationBridge();

    expect(bridge.needRefresh.value).toBe(false);
    expect(bridge.offlineReady.value).toBe(false);
    await expect(bridge.updateServiceWorker()).resolves.toBeUndefined();
  });

  it('marks offline-ready when an installing worker finishes without an active controller', async () => {
    const installingWorker = createServiceWorker();
    const registration = createRegistration({
      installing: installingWorker.worker,
    });

    mockServiceWorkerContainer({
      controller: null,
      getRegistration: async () => registration.registration,
      ready: Promise.resolve(registration.registration),
    });

    const bridge = usePwaRegistrationBridge();
    await flushMicrotasks();

    registration.dispatchUpdateFound();
    installingWorker.dispatchStateChange('installed');

    expect(bridge.offlineReady.value).toBe(true);
    expect(bridge.needRefresh.value).toBe(false);

    bridge.cleanup?.();
  });

  it('marks update-ready when a waiting worker exists under an active controller', async () => {
    const waitingWorker = {
      postMessage: vi.fn(),
    } as unknown as ServiceWorker;
    const registration = createRegistration({
      waiting: waitingWorker,
    });
    const serviceWorker = mockServiceWorkerContainer({
      controller: {} as ServiceWorker,
      getRegistration: async () => registration.registration,
      ready: Promise.resolve(registration.registration),
    });

    const bridge = usePwaRegistrationBridge();
    await flushMicrotasks();

    expect(bridge.needRefresh.value).toBe(true);
    expect(bridge.offlineReady.value).toBe(false);

    await bridge.updateServiceWorker();
    expect(waitingWorker.postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });

    serviceWorker.dispatchControllerChange();
    await flushMicrotasks();

    bridge.cleanup?.();
  });

  it('promotes an installing worker to update-ready when a controller already exists', async () => {
    const installingWorker = createServiceWorker();
    const registration = createRegistration({
      installing: installingWorker.worker,
    });

    mockServiceWorkerContainer({
      controller: {} as ServiceWorker,
      getRegistration: async () => registration.registration,
      ready: Promise.resolve(registration.registration),
    });

    const bridge = usePwaRegistrationBridge();
    await flushMicrotasks();

    registration.dispatchUpdateFound();
    installingWorker.dispatchStateChange('installed');

    expect(bridge.needRefresh.value).toBe(true);
    expect(bridge.offlineReady.value).toBe(false);

    bridge.cleanup?.();
  });

  it('resyncs to a cleared state when registration lookup fails', async () => {
    mockServiceWorkerContainer({
      controller: {} as ServiceWorker,
      getRegistration: async () => {
        throw new Error('lookup failed');
      },
      ready: Promise.reject(new Error('ready failed')),
    });

    const bridge = usePwaRegistrationBridge();
    await flushMicrotasks();

    expect(bridge.needRefresh.value).toBe(false);
    expect(bridge.offlineReady.value).toBe(false);

    bridge.cleanup?.();
  });

  it('ignores late controllerchange and ready rejection after cleanup', async () => {
    const readyDeferred = Promise.reject(new Error('ready failed'));
    const serviceWorker = mockServiceWorkerContainer({
      controller: {} as ServiceWorker,
      getRegistration: async () => null,
      ready: readyDeferred,
    });

    const bridge = usePwaRegistrationBridge();
    await flushMicrotasks();

    bridge.cleanup?.();
    serviceWorker.dispatchControllerChange();
    await flushMicrotasks();

    expect(bridge.needRefresh.value).toBe(false);
    expect(bridge.offlineReady.value).toBe(false);
  });

  it('ignores a late registration lookup result after cleanup', async () => {
    const registrationDeferred = createDeferred<ServiceWorkerRegistration | null>();

    mockServiceWorkerContainer({
      controller: {} as ServiceWorker,
      getRegistration: () => registrationDeferred.promise,
      ready: Promise.resolve({} as ServiceWorkerRegistration),
    });

    const bridge = usePwaRegistrationBridge();
    bridge.cleanup?.();
    registrationDeferred.resolve(createRegistration({}).registration);

    await flushMicrotasks();

    expect(bridge.needRefresh.value).toBe(false);
  });

  it('ignores a late registration lookup error after cleanup', async () => {
    const registrationDeferred = createDeferred<ServiceWorkerRegistration | null>();

    mockServiceWorkerContainer({
      controller: {} as ServiceWorker,
      getRegistration: () => registrationDeferred.promise,
      ready: Promise.resolve({} as ServiceWorkerRegistration),
    });

    const bridge = usePwaRegistrationBridge();
    bridge.cleanup?.();
    registrationDeferred.reject(new Error('late lookup failure'));

    await flushMicrotasks();

    expect(bridge.offlineReady.value).toBe(false);
  });

  it('refreshes registration before posting skip-waiting when no waiting worker is present yet', async () => {
    const waitingWorker = {
      postMessage: vi.fn(),
    } as unknown as ServiceWorker;
    const initialRegistration = createRegistration({});
    const updatedRegistration = createRegistration({
      waiting: waitingWorker,
    });

    mockServiceWorkerContainer({
      controller: {} as ServiceWorker,
      getRegistration: vi.fn()
        .mockResolvedValueOnce(initialRegistration.registration)
        .mockResolvedValueOnce(updatedRegistration.registration),
      ready: Promise.resolve(initialRegistration.registration),
    });

    const bridge = usePwaRegistrationBridge();
    await flushMicrotasks();

    await bridge.updateServiceWorker();

    expect(waitingWorker.postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });

    bridge.cleanup?.();
  });

  it('does not post messages after cleanup and keeps cleanup idempotent', async () => {
    const waitingWorker = {
      postMessage: vi.fn(),
    } as unknown as ServiceWorker;
    const registration = createRegistration({
      waiting: waitingWorker,
    });

    mockServiceWorkerContainer({
      controller: {} as ServiceWorker,
      getRegistration: async () => registration.registration,
      ready: Promise.resolve(registration.registration),
    });

    const bridge = usePwaRegistrationBridge();
    await flushMicrotasks();

    bridge.cleanup?.();
    bridge.cleanup?.();
    await bridge.updateServiceWorker();

    expect(waitingWorker.postMessage).not.toHaveBeenCalled();
  });
});
