import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { mount, flushPromises, enableAutoUnmount } from '@vue/test-utils';
import { defineComponent } from 'vue';
import { useInvestHomeOffers } from '../useInvestHomeOffers.ts';

const state = vi.hoisted(() => ({
  getOffersState: {
    value: {
      loading: false,
      data: undefined as undefined | { data: Array<{ id: number; slug?: string; isStatusPublished?: boolean }> },
    },
  },
  getOffers: vi.fn(),
  reportOfflineReadError: vi.fn(),
}));

vi.mock('pinia', () => ({
  storeToRefs: (store: Record<string, unknown>) => store,
}));

vi.mock('../../data/offer.repository.ts', () => ({
  useRepositoryOffer: () => ({
    getOffersState: state.getOffersState,
    getOffers: state.getOffers,
  }),
}));

vi.mock('@webdevelop-pro/invest-runtime/error/errorReporting', () => ({
  reportOfflineReadError: state.reportOfflineReadError,
}));

enableAutoUnmount(afterEach);

type IdleSchedulerWindow = Window & typeof globalThis & {
  requestIdleCallback?: (callback: IdleRequestCallback) => number;
  cancelIdleCallback?: (handle: number) => void;
};

function mountComposable() {
  let viewModel!: ReturnType<typeof useInvestHomeOffers>;

  const wrapper = mount(defineComponent({
    setup() {
      viewModel = useInvestHomeOffers();
      return {};
    },
    template: '<div />',
  }));

  return {
    viewModel,
    wrapper,
  };
}

describe('useInvestHomeOffers', () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    state.getOffersState.value = {
      loading: false,
      data: undefined,
    };
    state.getOffers.mockResolvedValue(undefined);
    Object.defineProperty(window, 'requestIdleCallback', {
      configurable: true,
      value: undefined,
      writable: true,
    });
    Object.defineProperty(window, 'cancelIdleCallback', {
      configurable: true,
      value: undefined,
      writable: true,
    });
  });

  it('exposes the first six offers and loading state from the repository', () => {
    state.getOffersState.value = {
      loading: true,
      data: {
        data: [
          { id: 1, isStatusPublished: true },
          { id: 2, isStatusPublished: true },
          { id: 3, isStatusPublished: true },
          { id: 4, isStatusPublished: true },
          { id: 5, isStatusPublished: true },
          { id: 6, isStatusPublished: true },
          { id: 7, isStatusPublished: true },
        ],
      },
    };

    const { viewModel } = mountComposable();

    expect(viewModel.offers.value.map((offer) => offer.id)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(viewModel.offersLoading.value).toBe(true);
  });

  it('loads offers on the timeout fallback and reports offline read failures', async () => {
    vi.useFakeTimers();
    const error = new Error('offline');
    state.getOffers.mockRejectedValueOnce(error);

    mountComposable();
    await vi.runAllTimersAsync();
    await flushPromises();

    expect(state.getOffers).toHaveBeenCalledTimes(1);
    expect(state.reportOfflineReadError).toHaveBeenCalledWith(error, 'Failed to load offers');
  });

  it('loads offers during idle time when requestIdleCallback exists', async () => {
    const idleCallbacks: IdleRequestCallback[] = [];
    (window as IdleSchedulerWindow).requestIdleCallback = vi.fn((callback) => {
      idleCallbacks.push(callback);
      return 12;
    });

    mountComposable();

    expect(state.getOffers).not.toHaveBeenCalled();
    idleCallbacks[0]?.({ didTimeout: false, timeRemaining: () => 10 });
    await flushPromises();

    expect(state.getOffers).toHaveBeenCalledTimes(1);
  });

  it('cancels scheduled idle work when unmounted before the callback runs', () => {
    const cancelIdleCallback = vi.fn();
    (window as IdleSchedulerWindow).requestIdleCallback = vi.fn(() => 44);
    (window as IdleSchedulerWindow).cancelIdleCallback = cancelIdleCallback;

    const { wrapper } = mountComposable();
    wrapper.unmount();

    expect(cancelIdleCallback).toHaveBeenCalledWith(44);
    expect(state.getOffers).not.toHaveBeenCalled();
  });

  it('does not schedule background loading when data is already present on mount', () => {
    const requestIdleCallback = vi.fn();
    state.getOffersState.value = {
      loading: false,
      data: {
        data: [{ id: 1, isStatusPublished: true }],
      },
    };
    (window as IdleSchedulerWindow).requestIdleCallback = requestIdleCallback;

    mountComposable();

    expect(requestIdleCallback).not.toHaveBeenCalled();
    expect(state.getOffers).not.toHaveBeenCalled();
  });

  it('does not schedule background loading while offers are already loading on mount', () => {
    const requestIdleCallback = vi.fn();
    state.getOffersState.value = {
      loading: true,
      data: undefined,
    };
    (window as IdleSchedulerWindow).requestIdleCallback = requestIdleCallback;

    mountComposable();

    expect(requestIdleCallback).not.toHaveBeenCalled();
    expect(state.getOffers).not.toHaveBeenCalled();
  });

  it('does not load offers after unmount when a timeout callback still fires', async () => {
    vi.useFakeTimers();
    const scheduledCallbacks: Array<() => void> = [];
    const timeoutHandle = globalThis.setTimeout(() => undefined, 0);
    globalThis.clearTimeout(timeoutHandle);
    vi.spyOn(window, 'setTimeout').mockImplementation((callback) => {
      scheduledCallbacks.push(callback as () => void);
      return timeoutHandle;
    });
    vi.spyOn(window, 'clearTimeout').mockImplementation(() => undefined);

    const { wrapper } = mountComposable();
    wrapper.unmount();
    scheduledCallbacks[0]?.();
    await flushPromises();

    expect(state.getOffers).not.toHaveBeenCalled();
  });

  it('does not load offers when data is already present', async () => {
    state.getOffersState.value = {
      loading: false,
      data: {
        data: [{ id: 1, isStatusPublished: true }],
      },
    };

    const { viewModel } = mountComposable();
    await viewModel.loadOffers();

    expect(state.getOffers).not.toHaveBeenCalled();
  });

  it('applies deployment and published-status visibility before the six-offer limit', () => {
    state.getOffersState.value = {
      loading: false,
      data: {
        data: [
          { id: 1, slug: 'hidden', isStatusPublished: true },
          { id: 2, slug: 'closed', isStatusPublished: false },
          ...Array.from({ length: 7 }, (_, index) => ({
            id: index + 3,
            slug: `visible-${index}`,
            isStatusPublished: true,
          })),
        ],
      },
    };

    let viewModel!: ReturnType<typeof useInvestHomeOffers>;
    mount(defineComponent({
      setup() {
        viewModel = useInvestHomeOffers({
          isVisible: (offer) => offer.slug?.startsWith('visible-') ?? false,
        });
        return {};
      },
      template: '<div />',
    }));

    expect(viewModel.offers.value.map((offer) => offer.id)).toEqual([3, 4, 5, 6, 7, 8]);
  });
});
