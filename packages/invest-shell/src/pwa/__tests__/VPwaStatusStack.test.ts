import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { shallowMount } from '@vue/test-utils';
import {
  computed,
  ref,
} from 'vue';
import VPwaStatusStack from '../VPwaStatusStack.vue';

vi.mock('@webdevelop-pro/invest-runtime/application-context', () => ({
  useInvestApplicationContext: () => ({
    appConfig: {
      build: {
        version: 'test-build',
        timestamp: '2026-04-03T12:34:56.000Z',
      },
    },
  }),
}));

const isStandalone = ref(false);
const canInstall = ref(false);
const installState = ref<'hidden' | 'native' | 'manual-ios'>('hidden');
const isUpdateReady = ref(false);
const isOfflineReady = ref(false);
const lifecycleState = ref<'idle' | 'offlineReady' | 'updateReady' | 'reloading' | 'registrationError'>('idle');
const registrationError = ref<unknown>(null);
const isOffline = ref(false);
const isReconnected = ref(false);
const isShowingCachedContent = ref(false);
const lastSyncedAt = ref<string | null>(null);
const dismissOfflineBanner = vi.fn();

vi.mock('@webdevelop-pro/invest-runtime/pwa/usePwaStandalone', () => ({
  usePwaStandalone: () => ({
    isStandalone,
  }),
}));

vi.mock('@webdevelop-pro/invest-runtime/pwa/usePwaInstallPrompt', () => ({
  usePwaInstallPrompt: () => ({
    canInstall,
    installState,
    promptInstall: vi.fn(),
    dismissInstallPrompt: vi.fn(),
  }),
}));

vi.mock('@webdevelop-pro/invest-runtime/pwa/usePwaUpdatePrompt', () => ({
  usePwaUpdatePrompt: () => ({
    isUpdateReady,
    isOfflineReady,
    lifecycleState,
    registrationError,
    reloadApp: vi.fn(),
    dismissOfflineReady: vi.fn(),
    dismissUpdateReady: vi.fn(),
  }),
}));

vi.mock('@webdevelop-pro/invest-runtime/pwa/useOfflineStatus', () => ({
  useOfflineStatus: () => ({
    isOffline,
    isReconnected,
    isShowingCachedContent,
  }),
}));

vi.mock('@webdevelop-pro/invest-runtime/pwa/usePwaOfflineDataStatus', () => ({
  usePwaOfflineDataStatus: () => ({
    lastSyncedAt,
  }),
}));

vi.mock('@webdevelop-pro/invest-runtime/pwa/usePwaTelemetry', () => ({
  usePwaTelemetry: () => ({
    handleInstall: vi.fn(),
    handleDismissInstall: vi.fn(),
    handleReloadApp: vi.fn(),
    handleDismissUpdate: vi.fn(),
    handleDismissOfflineReady: vi.fn(),
  }),
}));

vi.mock('@webdevelop-pro/invest-runtime/pwa/usePwaBannerDismissals', () => ({
  usePwaBannerDismissals: () => ({
    isBannerVisible: computed(() => isOffline.value || isReconnected.value),
    dismissActiveBanner: dismissOfflineBanner,
  }),
}));

const mountStatusStack = (props: Record<string, unknown> = {}) => shallowMount(VPwaStatusStack, {
  props: {
    usesMobileShell: false,
    hasFooterMenu: false,
    ...props,
  } as never,
  global: {
    stubs: {
      VPwaInstallPrompt: {
        template: '<div data-testid="install-prompt" />',
      },
      VPwaUpdatePrompt: {
        props: ['appVersion', 'appBuildTimestamp'],
        template: '<div data-testid="update-prompt">{{ appVersion }}|{{ appBuildTimestamp }}</div>',
      },
      VOfflineStatusBanner: {
        template: '<button data-testid="offline-banner" @click="$emit(\'dismiss\')" />',
      },
    },
  },
});

describe('VPwaStatusStack', () => {
  beforeEach(() => {
    dismissOfflineBanner.mockReset();
    isStandalone.value = false;
    canInstall.value = false;
    installState.value = 'hidden';
    isUpdateReady.value = false;
    isOfflineReady.value = false;
    lifecycleState.value = 'idle';
    registrationError.value = null;
    isOffline.value = false;
    isReconnected.value = false;
    isShowingCachedContent.value = false;
    lastSyncedAt.value = null;
  });

  it('shows update prompt on regular web sessions', () => {
    isUpdateReady.value = true;

    const wrapper = mountStatusStack();

    expect(wrapper.find('[data-testid="update-prompt"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="update-prompt"]').text()).toContain('test-build|2026-04-03T12:34:56.000Z');
    expect(wrapper.find('[data-testid="offline-banner"]').exists()).toBe(false);
  });

  it('suppresses web update prompts while offline and keeps the offline banner available', () => {
    isUpdateReady.value = true;
    isOffline.value = true;

    const wrapper = mountStatusStack();

    expect(wrapper.find('[data-testid="update-prompt"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="offline-banner"]').exists()).toBe(true);
  });

  it('keeps the install prompt visible on the web alongside update prompt', () => {
    installState.value = 'native';
    canInstall.value = true;
    isUpdateReady.value = true;

    const wrapper = mountStatusStack();

    expect(wrapper.find('.v-pwa-status-stack').exists()).toBe(true);
    expect(wrapper.find('[data-testid="install-prompt"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="update-prompt"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="offline-banner"]').exists()).toBe(false);
  });

  it('keeps the install prompt visible while offline and hides update prompt', () => {
    installState.value = 'native';
    canInstall.value = true;
    isUpdateReady.value = true;
    isOffline.value = true;

    const wrapper = mountStatusStack();

    expect(wrapper.find('.v-pwa-status-stack').exists()).toBe(true);
    expect(wrapper.find('[data-testid="install-prompt"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="update-prompt"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="offline-banner"]').exists()).toBe(true);
  });

  it('shows runtime PWA alerts inside standalone sessions', () => {
    isStandalone.value = true;
    isUpdateReady.value = true;

    const wrapper = mountStatusStack({
      usesMobileShell: true,
      hasFooterMenu: true,
    });

    expect(wrapper.find('[data-testid="update-prompt"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="update-prompt"]').text()).toContain('test-build|2026-04-03T12:34:56.000Z');
    expect(wrapper.find('[data-testid="offline-banner"]').exists()).toBe(false);
    expect(wrapper.find('.v-pwa-status-stack').classes()).toContain('is--footer-offset');
  });

  it('suppresses standalone update prompts while offline', () => {
    isStandalone.value = true;
    isUpdateReady.value = true;
    isOfflineReady.value = true;
    isOffline.value = true;

    const wrapper = mountStatusStack();

    expect(wrapper.find('[data-testid="update-prompt"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="offline-banner"]').exists()).toBe(true);
  });

  it('hides the standalone update prompt while offline even during reload state', () => {
    isStandalone.value = true;
    lifecycleState.value = 'reloading';
    isOffline.value = true;

    const wrapper = mountStatusStack();

    expect(wrapper.find('[data-testid="update-prompt"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="offline-banner"]').exists()).toBe(true);
  });

  it('keeps the update prompt visible while a refresh is in progress', () => {
    isStandalone.value = true;
    lifecycleState.value = 'reloading';

    const wrapper = mountStatusStack();

    expect(wrapper.find('[data-testid="update-prompt"]').exists()).toBe(true);
  });

  it('shows the standalone update prompt for offline-ready state and registration errors', () => {
    isStandalone.value = true;
    isOfflineReady.value = true;
    registrationError.value = new Error('register failed');

    const wrapper = mountStatusStack();

    expect(wrapper.find('[data-testid="update-prompt"]').exists()).toBe(true);
  });

  it('pins the stack to the viewport bottom when the footer menu is hidden', () => {
    isOffline.value = true;

    const wrapper = mountStatusStack({
      usesMobileShell: true,
      hasFooterMenu: false,
    });

    expect(wrapper.find('.v-pwa-status-stack').classes()).not.toContain('is--footer-offset');
  });

  it('forwards offline banner dismiss actions', async () => {
    isOffline.value = true;

    const wrapper = mountStatusStack();

    await wrapper.get('[data-testid="offline-banner"]').trigger('click');

    expect(dismissOfflineBanner).toHaveBeenCalledTimes(1);
  });
});
