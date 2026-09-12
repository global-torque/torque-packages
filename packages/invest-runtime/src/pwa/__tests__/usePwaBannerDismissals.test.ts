import {
  describe,
  beforeEach,
  expect,
  it,
} from 'vitest';
import {
  defineComponent,
  h,
  onBeforeUnmount,
  nextTick,
  ref,
} from 'vue';
import { mount } from '@vue/test-utils';
import { usePwaBannerDismissals } from '../usePwaBannerDismissals.ts';

const PWA_BANNER_DISMISS_KEY = 'invest:pwa-banner:dismissed-key';

const mountComposable = (activeBannerKey: ReturnType<typeof ref<'offline' | 'reconnected' | null>>) => {
  let api!: ReturnType<typeof usePwaBannerDismissals>;

  const wrapper = mount(defineComponent({
    setup() {
      api = usePwaBannerDismissals(activeBannerKey);
      onBeforeUnmount(() => {
        api = null as never;
      });
      return () => h('div');
    },
  }));

  return {
    wrapper,
    api,
  };
};

const dispatchStorageUpdate = (dismissedBannerKey: 'offline' | 'reconnected' | null, key = PWA_BANNER_DISMISS_KEY) => {
  if (dismissedBannerKey == null) {
    localStorage.removeItem(PWA_BANNER_DISMISS_KEY);
  } else {
    localStorage.setItem(PWA_BANNER_DISMISS_KEY, dismissedBannerKey);
  }

  const event = new Event('storage');
  Object.assign(event, {
    key,
  });
  window.dispatchEvent(event);
};

describe('usePwaBannerDismissals', () => {
  beforeEach(() => {
    localStorage.removeItem(PWA_BANNER_DISMISS_KEY);
  });

  it('hides the active banner after dismissal', () => {
    const activeBannerKey = ref<'offline' | 'reconnected' | null>('offline');
    const { wrapper, api } = mountComposable(activeBannerKey);

    expect(api.isBannerVisible.value).toBe(true);

    api.dismissActiveBanner();

    expect(api.isBannerVisible.value).toBe(false);

    wrapper.unmount();
  });

  it('shows a new banner state after the active key changes', async () => {
    const activeBannerKey = ref<'offline' | 'reconnected' | null>('offline');
    const { wrapper, api } = mountComposable(activeBannerKey);

    api.dismissActiveBanner();
    expect(api.isBannerVisible.value).toBe(false);

    activeBannerKey.value = null;
    await nextTick();
    activeBannerKey.value = 'reconnected';
    await nextTick();

    expect(api.isBannerVisible.value).toBe(true);

    wrapper.unmount();
  });

  it('keeps the dismissed banner hidden after remount while the same banner stays active', async () => {
    const activeBannerKey = ref<'offline' | 'reconnected' | null>('offline');
    const firstMount = mountComposable(activeBannerKey);

    firstMount.api.dismissActiveBanner();
    expect(firstMount.api.isBannerVisible.value).toBe(false);

    firstMount.wrapper.unmount();

    const secondMount = mountComposable(activeBannerKey);
    await nextTick();

    expect(secondMount.api.isBannerVisible.value).toBe(false);

    secondMount.wrapper.unmount();
  });

  it('keeps a stored dismissal when the same banner becomes active after mount', async () => {
    localStorage.setItem(PWA_BANNER_DISMISS_KEY, 'offline');
    const activeBannerKey = ref<'offline' | 'reconnected' | null>(null);
    const { wrapper, api } = mountComposable(activeBannerKey);

    expect(localStorage.getItem(PWA_BANNER_DISMISS_KEY)).toBe('offline');
    expect(api.isBannerVisible.value).toBe(false);

    activeBannerKey.value = 'offline';
    await nextTick();

    expect(localStorage.getItem(PWA_BANNER_DISMISS_KEY)).toBe('offline');
    expect(api.isBannerVisible.value).toBe(false);

    wrapper.unmount();
  });

  it('clears the offline dismissal after reconnect and shows the offline banner again later', async () => {
    const activeBannerKey = ref<'offline' | 'reconnected' | null>('offline');
    const { wrapper, api } = mountComposable(activeBannerKey);

    api.dismissActiveBanner();
    expect(api.isBannerVisible.value).toBe(false);
    expect(localStorage.getItem(PWA_BANNER_DISMISS_KEY)).toBe('offline');

    activeBannerKey.value = 'reconnected';
    await nextTick();

    expect(localStorage.getItem(PWA_BANNER_DISMISS_KEY)).toBeNull();
    expect(api.isBannerVisible.value).toBe(true);

    activeBannerKey.value = 'offline';
    await nextTick();

    expect(localStorage.getItem(PWA_BANNER_DISMISS_KEY)).toBeNull();
    expect(api.isBannerVisible.value).toBe(true);

    wrapper.unmount();
  });

  it('clears a stored dismissal when the reconnected banner becomes active', async () => {
    localStorage.setItem(PWA_BANNER_DISMISS_KEY, 'offline');
    const activeBannerKey = ref<'offline' | 'reconnected' | null>(null);
    const { wrapper, api } = mountComposable(activeBannerKey);

    expect(localStorage.getItem(PWA_BANNER_DISMISS_KEY)).toBe('offline');
    expect(api.isBannerVisible.value).toBe(false);

    activeBannerKey.value = 'reconnected';
    await nextTick();

    expect(localStorage.getItem(PWA_BANNER_DISMISS_KEY)).toBeNull();
    expect(api.isBannerVisible.value).toBe(true);

    wrapper.unmount();
  });

  it('syncs dismissed banner updates from storage while mounted', async () => {
    const activeBannerKey = ref<'offline' | 'reconnected' | null>('offline');
    const { wrapper, api } = mountComposable(activeBannerKey);

    expect(api.isBannerVisible.value).toBe(true);

    dispatchStorageUpdate('offline');
    await nextTick();

    expect(api.isBannerVisible.value).toBe(false);

    wrapper.unmount();
  });

  it('clears stored dismissal when the app returns online', async () => {
    const activeBannerKey = ref<'offline' | 'reconnected' | null>('offline');
    const { wrapper, api } = mountComposable(activeBannerKey);

    api.dismissActiveBanner();
    expect(localStorage.getItem(PWA_BANNER_DISMISS_KEY)).toBe('offline');

    activeBannerKey.value = 'reconnected';
    await nextTick();

    expect(localStorage.getItem(PWA_BANNER_DISMISS_KEY)).toBeNull();
    expect(api.isBannerVisible.value).toBe(true);

    wrapper.unmount();
  });

  it('ignores unrelated storage events', async () => {
    const activeBannerKey = ref<'offline' | 'reconnected' | null>('offline');
    const { wrapper, api } = mountComposable(activeBannerKey);

    dispatchStorageUpdate('offline', 'invest:pwa:other-key');
    await nextTick();

    expect(api.isBannerVisible.value).toBe(true);

    wrapper.unmount();
  });
});
