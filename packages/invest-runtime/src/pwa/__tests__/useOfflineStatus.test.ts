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
import { useOfflineStatus } from '../useOfflineStatus.ts';

type OfflineStatusResult = ReturnType<typeof useOfflineStatus>;

const listeners = {
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
};

const mountComposable = () => {
  let api!: OfflineStatusResult;
  const wrapper = mount(defineComponent({
    setup() {
      api = useOfflineStatus();
      return () => null;
    },
  }));

  return { wrapper, api };
};

describe('useOfflineStatus', () => {
  let online = true;
  let controller: ServiceWorker | null = {} as ServiceWorker;

  beforeEach(() => {
    vi.useFakeTimers();
    online = true;
    controller = {} as ServiceWorker;

    Object.defineProperty(window.navigator, 'onLine', {
      configurable: true,
      get: () => online,
    });

    Object.defineProperty(window.navigator, 'serviceWorker', {
      configurable: true,
      value: {
        get controller() {
          return controller;
        },
        addEventListener: listeners.addEventListener,
        removeEventListener: listeners.removeEventListener,
      },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('marks the app offline and recognizes when cached content is available', async () => {
    const { wrapper, api } = mountComposable();

    online = false;
    window.dispatchEvent(new Event('offline'));
    await nextTick();

    expect(api.isOffline.value).toBe(true);
    expect(api.isShowingCachedContent.value).toBe(true);

    wrapper.unmount();
  });

  it('shows a short reconnect state after the network returns', async () => {
    const { wrapper, api } = mountComposable();

    online = false;
    window.dispatchEvent(new Event('offline'));
    await nextTick();

    online = true;
    window.dispatchEvent(new Event('online'));
    await nextTick();

    expect(api.isOffline.value).toBe(false);
    expect(api.isReconnected.value).toBe(true);

    vi.advanceTimersByTime(4_000);
    await nextTick();
    expect(api.isReconnected.value).toBe(false);

    wrapper.unmount();
  });

  it('distinguishes offline mode without a service-worker controller', async () => {
    controller = null;
    const { wrapper, api } = mountComposable();

    online = false;
    window.dispatchEvent(new Event('offline'));
    await nextTick();

    expect(api.isOffline.value).toBe(true);
    expect(api.isShowingCachedContent.value).toBe(false);

    wrapper.unmount();
  });
});
