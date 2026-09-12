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
import { useFilerNotificationRefresh } from '../useFilerNotificationRefresh.ts';

const notificationFieldsState = ref<{ data: Record<string, unknown> | undefined }>({
  data: undefined,
});
const reportError = vi.fn();

vi.mock('pinia', async () => {
  const actual = await vi.importActual<typeof import('pinia')>('pinia');
  return {
    ...actual,
    storeToRefs: (store: Record<string, unknown>) => store,
  };
});

vi.mock('../useFilerModel.ts', () => ({
  useFilerModel: () => ({
    notificationFieldsState,
  }),
}));

vi.mock('../../error/errorReporting.ts', () => ({
  reportError: (...args: unknown[]) => reportError(...args),
}));

const mountComposable = (setupComposable: () => void) => mount(defineComponent({
  setup() {
    setupComposable();
    return () => null;
  },
}));

describe('useFilerNotificationRefresh', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    notificationFieldsState.value = { data: undefined };
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('refreshes after a matching filer notification with debounce', async () => {
    const refresh = vi.fn(async () => undefined);
    const wrapper = mountComposable(() => {
      useFilerNotificationRefresh({
        delayMs: 3000,
        refresh,
        refreshErrorMessage: 'Failed to refresh user data',
      });
    });

    notificationFieldsState.value = {
      data: {
        object_id: 1,
        type: 'file',
      },
    };
    await nextTick();

    expect(refresh).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(3000);
    expect(refresh).toHaveBeenCalledTimes(1);

    wrapper.unmount();
  });

  it('ignores notifications that do not match the provided filter', async () => {
    const refresh = vi.fn(async () => undefined);
    const wrapper = mountComposable(() => {
      useFilerNotificationRefresh({
        match: (fields) => fields.type === 'file_thumbnail',
        refresh,
        refreshErrorMessage: 'Failed to refresh avatar',
      });
    });

    notificationFieldsState.value = {
      data: {
        object_id: 1,
        type: 'file',
      },
    };
    await nextTick();
    await vi.runAllTimersAsync();

    expect(refresh).not.toHaveBeenCalled();

    wrapper.unmount();
  });

  it('supports fallback refreshes and clears them after a matching notification', async () => {
    const refresh = vi.fn(async () => undefined);
    const onSettled = vi.fn();
    const enabled = ref(true);
    let scheduleFallbackRefresh!: () => void;

    const wrapper = mountComposable(() => {
      const api = useFilerNotificationRefresh({
        enabled,
        fallbackMs: 5000,
        match: (fields) => fields.type === 'file_thumbnail',
        refresh,
        refreshErrorMessage: 'Failed to refresh avatar after thumbnail generation',
        fallbackErrorMessage: 'Failed to refresh avatar after upload',
        onSettled,
      });
      scheduleFallbackRefresh = api.scheduleFallbackRefresh;
    });

    scheduleFallbackRefresh();
    await vi.advanceTimersByTimeAsync(3000);

    notificationFieldsState.value = {
      data: {
        object_id: 7,
        type: 'file_thumbnail',
      },
    };
    await nextTick();
    await vi.runAllTimersAsync();

    expect(refresh).toHaveBeenCalledTimes(1);
    expect(onSettled).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(5000);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(reportError).not.toHaveBeenCalled();

    wrapper.unmount();
  });
});
