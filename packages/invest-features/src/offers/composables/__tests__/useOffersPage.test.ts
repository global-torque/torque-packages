import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { defineComponent } from 'vue';
import { useOffersPage } from '../useOffersPage.ts';

const state = vi.hoisted(() => ({
  route: { path: '/invest' },
  locationPath: '/offers',
  getOffersState: {
    value: {
      loading: false,
      data: undefined as undefined | {
        data: Array<{
          id: number;
          approved_at?: string;
          isNew?: boolean;
          isStatusClosedSuccessfully?: boolean;
          offerFundedPercent?: number;
          slug?: string;
          isStatusPublished?: boolean;
          isStatusLegalClosed?: boolean;
        }>;
      },
    },
  },
  getOffers: vi.fn(),
  hideLoader: vi.fn(),
  reportOfflineReadError: vi.fn(),
}));

vi.mock('pinia', () => ({
  storeToRefs: (store: Record<string, unknown>) => store,
}));

vi.mock('vitepress', () => ({
  useRoute: () => state.route,
}));

vi.mock('@global-torque/invest-runtime/loader', () => ({
  useGlobalLoader: () => ({
    hide: state.hideLoader,
  }),
}));

vi.mock('@global-torque/ui-kit/url-sync', () => ({
  useReactiveLocation: () => ({
    get value() {
      return state.locationPath;
    },
  }),
}));

vi.mock('../../data/offer.repository.ts', () => ({
  useRepositoryOffer: () => ({
    getOffersState: state.getOffersState,
    getOffers: state.getOffers,
  }),
}));

vi.mock('@global-torque/invest-runtime/error/errorReporting', () => ({
  reportOfflineReadError: state.reportOfflineReadError,
}));

function mountComposable() {
  let viewModel!: ReturnType<typeof useOffersPage>;

  mount(defineComponent({
    setup() {
      viewModel = useOffersPage();
      return {};
    },
    template: '<div />',
  }));

  return viewModel;
}

describe('useOffersPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.getOffersState.value = {
      loading: false,
      data: undefined,
    };
    state.locationPath = '/offers';
    state.getOffers.mockResolvedValue(undefined);
  });

  it('exposes offers and closed-offer derived state from the repository', async () => {
    state.getOffersState.value = {
      loading: false,
      data: {
        data: [
          { id: 1, isStatusPublished: true, isStatusClosedSuccessfully: false },
          { id: 2, isStatusClosedSuccessfully: true },
        ],
      },
    };

    const viewModel = mountComposable();
    await flushPromises();

    expect(viewModel.offers.value).toEqual([{ id: 1, isStatusPublished: true, isStatusClosedSuccessfully: false }]);
    expect(viewModel.offersClosed.value).toEqual([{
      id: 2,
      isStatusClosedSuccessfully: true,
      actionLabel: 'View Offer',
    }]);
    expect(viewModel.showClosed.value).toBe(true);
    expect(state.getOffers).not.toHaveBeenCalled();
    expect(state.hideLoader).toHaveBeenCalledTimes(1);
  });

  it('orders offers by newest when the new filter is present', async () => {
    state.locationPath = '/offers?filter=new';
    state.getOffersState.value = {
      loading: false,
      data: {
        data: [
          { id: 1, approved_at: '2026-01-01T00:00:00.000Z', isNew: false, isStatusPublished: true },
          { id: 2, approved_at: '2026-03-01T00:00:00.000Z', isNew: true, isStatusPublished: true },
          { id: 3, approved_at: '2026-02-01T00:00:00.000Z', isNew: true, isStatusPublished: true },
        ],
      },
    };

    const viewModel = mountComposable();
    await flushPromises();

    expect(viewModel.offerFilter.value).toBe('new');
    expect(viewModel.offers.value.map((offer) => offer.id)).toEqual([2, 3, 1]);
  });

  it('orders active offers by funding progress when the almost-funded filter is present', async () => {
    state.locationPath = '/offers?filter=almost-funded';
    state.getOffersState.value = {
      loading: false,
      data: {
        data: [
          { id: 1, approved_at: '2026-01-01T00:00:00.000Z', offerFundedPercent: 40, isStatusPublished: true },
          { id: 2, approved_at: '2026-02-01T00:00:00.000Z', offerFundedPercent: 94, isStatusPublished: true },
          {
            id: 3,
            approved_at: '2026-03-01T00:00:00.000Z',
            isStatusClosedSuccessfully: true,
            offerFundedPercent: 100,
          },
          { id: 4, approved_at: '2026-04-01T00:00:00.000Z', offerFundedPercent: 88, isStatusPublished: true },
        ],
      },
    };

    const viewModel = mountComposable();
    await flushPromises();

    expect(viewModel.offerFilter.value).toBe('almost-funded');
    expect(viewModel.offers.value.map((offer) => offer.id)).toEqual([2, 4, 1]);
  });

  it('loads offers on mount and reports offline read failures', async () => {
    const error = new Error('offline');
    state.getOffers.mockRejectedValueOnce(error);

    mountComposable();
    await flushPromises();

    expect(state.getOffers).toHaveBeenCalledTimes(1);
    expect(state.reportOfflineReadError).toHaveBeenCalledWith(error, 'Failed to load offers');
  });

  it('creates mutually exclusive deployed lifecycle sections before sorting', async () => {
    state.locationPath = '/offers?filter=new';
    state.getOffersState.value = {
      loading: false,
      data: {
        data: [
          { id: 1, slug: 'published', isStatusPublished: true, approved_at: '2026-01-01' },
          { id: 2, slug: 'finalizing', isStatusLegalClosed: true },
          { id: 3, slug: 'closed', isStatusClosedSuccessfully: true },
          { id: 4, slug: 'not-deployed', isStatusPublished: true, approved_at: '2027-01-01' },
        ],
      },
    };
    let viewModel!: ReturnType<typeof useOffersPage>;
    mount(defineComponent({
      setup() {
        viewModel = useOffersPage({ isVisible: (offer) => offer.slug !== 'not-deployed' });
        return {};
      },
      template: '<div />',
    }));
    await flushPromises();

    expect(viewModel.offers.value.map((offer) => offer.id)).toEqual([1]);
    expect(viewModel.offersFinalizing.value).toMatchObject([{ id: 2, actionLabel: 'View Offer' }]);
    expect(viewModel.offersClosed.value).toMatchObject([{ id: 3, actionLabel: 'View Offer' }]);
  });
});
