import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { mount } from '@vue/test-utils';
import { defineComponent, nextTick, ref } from 'vue';

const sendEvent = vi.fn();

vi.mock('../../analytics/useSendAnalyticsEvent.ts', () => ({
  useSendAnalyticsEvent: () => ({
    sendEvent,
  }),
}));

import { usePwaTelemetry } from '../usePwaTelemetry.ts';

const mountTelemetry = (options: Partial<Parameters<typeof usePwaTelemetry>[0]> = {}) => {
  let api!: ReturnType<typeof usePwaTelemetry>;

  const wrapper = mount(defineComponent({
    setup() {
      api = usePwaTelemetry({
        canInstall: ref(false),
        installState: ref('hidden'),
        isUpdateReady: ref(false),
        isOfflineReady: ref(false),
        isOffline: ref(false),
        isReconnected: ref(false),
        registrationError: ref(null),
        promptInstall: async () => null,
        dismissInstallPrompt: vi.fn(),
        reloadApp: async () => {},
        dismissUpdateReady: vi.fn(),
        dismissOfflineReady: vi.fn(),
        ...options,
      });
      return () => null;
    },
  }));

  return { wrapper, api };
};

describe('usePwaTelemetry', () => {
  beforeEach(() => {
    sendEvent.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('tracks install prompt visibility for both native and manual install states', async () => {
    const installState = ref<'hidden' | 'native' | 'manual-ios'>('hidden');

    const { wrapper } = mountTelemetry({
      installState,
    });

    installState.value = 'manual-ios';
    await nextTick();

    expect(sendEvent).toHaveBeenCalledWith(expect.objectContaining({
      event_type: 'open',
      httpRequestUrl: 'pwa://install/prompt-shown',
    }));

    wrapper.unmount();
  });

  it('tracks service-worker registration failures', async () => {
    const registrationError = ref<unknown>(null);

    const { wrapper } = mountTelemetry({
      registrationError,
    });

    registrationError.value = new Error('boom');
    await nextTick();

    expect(sendEvent).toHaveBeenCalledWith(expect.objectContaining({
      event_type: 'send',
      status_code: 500,
      httpRequestUrl: 'pwa://service-worker/register',
    }));

    wrapper.unmount();
  });

  it('tracks PWA actions with approved analytics event types', async () => {
    const dismissInstallPrompt = vi.fn();
    const reloadApp = vi.fn().mockResolvedValue(undefined);
    const dismissUpdateReady = vi.fn();
    const dismissOfflineReady = vi.fn();

    const { wrapper, api } = mountTelemetry({
      promptInstall: async () => 'accepted',
      dismissInstallPrompt,
      reloadApp,
      dismissUpdateReady,
      dismissOfflineReady,
    });

    await api.handleInstall();
    api.handleDismissInstall();
    await api.handleReloadApp();
    api.handleDismissUpdate();
    api.handleDismissOfflineReady();

    expect(dismissInstallPrompt).toHaveBeenCalledTimes(1);
    expect(reloadApp).toHaveBeenCalledTimes(1);
    expect(dismissUpdateReady).toHaveBeenCalledTimes(1);
    expect(dismissOfflineReady).toHaveBeenCalledTimes(1);
    expect(sendEvent).toHaveBeenNthCalledWith(1, expect.objectContaining({
      event_type: 'click',
      httpRequestUrl: 'pwa://install/accepted',
    }));
    expect(sendEvent).toHaveBeenNthCalledWith(2, expect.objectContaining({
      event_type: 'close',
      httpRequestUrl: 'pwa://install/dismissed',
    }));
    expect(sendEvent).toHaveBeenNthCalledWith(3, expect.objectContaining({
      event_type: 'click',
      httpRequestUrl: 'pwa://update/accepted',
    }));
    expect(sendEvent).toHaveBeenNthCalledWith(4, expect.objectContaining({
      event_type: 'close',
      httpRequestUrl: 'pwa://update/dismissed',
    }));
    expect(sendEvent).toHaveBeenNthCalledWith(5, expect.objectContaining({
      event_type: 'close',
      httpRequestUrl: 'pwa://offline/ready-dismissed',
    }));

    wrapper.unmount();
  });
});
