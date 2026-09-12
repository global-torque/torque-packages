import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import {
  enableAutoUnmount,
  flushPromises,
  mount,
} from '@vue/test-utils';
import {
  defineComponent,
  effectScope,
  ref,
  type Ref,
} from 'vue';
import { useOffersDetailsPage } from '../useOffersDetailsPage.ts';

type OfferPageParams = Parameters<typeof useOffersDetailsPage>[0] extends Ref<infer Value>
  ? Value
  : never;

const state = vi.hoisted(() => ({
  route: { path: '/offers/static-offer' },
  userLoggedIn: { value: false },
  selectedUserProfileId: { value: 7 },
  userProfiles: { value: [] as Array<{ id: number; isKycApproved?: boolean }> },
  getOfferOneState: {
    value: {
      loading: false,
      data: null as null | { id: number; slug: string },
      dataSource: null as null | 'network' | 'offline-cache',
    },
  },
  setInvestState: {
    value: {
      data: null as null | { id: number },
    },
  },
  getInvestUnconfirmedOne: {
    value: null as null | {
      id: number;
      offer: { slug: string };
      profile_id: number;
      step: string;
    },
  },
  hideLoader: vi.fn(),
  navigateWithQueryParams: vi.fn(),
  getInvestmentConfigValue: vi.fn(),
  setSelectedUserProfileById: vi.fn(),
  getInvestUnconfirmed: vi.fn(),
  setInvest: vi.fn(),
  getOfferOne: vi.fn(),
  getOfferComments: vi.fn(),
  sendEvent: vi.fn(),
  reportError: vi.fn(),
  reportOfflineReadError: vi.fn(),
  useInvestApplicationContext: vi.fn(() => ({
    appConfig: { urls: { dashboard: 'https://dashboard.example.test' } },
  })),
}));

vi.mock('pinia', () => ({
  storeToRefs: (store: Record<string, unknown>) => store,
}));

vi.mock('vitepress', () => ({
  useRoute: () => state.route,
}));

vi.mock('@webdevelop-pro/invest-runtime/loader', () => ({
  useGlobalLoader: () => ({
    hide: state.hideLoader,
  }),
}));

vi.mock('@webdevelop-pro/invest-runtime/application-context', () => ({
  useInvestApplicationContext: state.useInvestApplicationContext,
}));

vi.mock('@webdevelop-pro/invest-runtime/navigation', () => ({
  navigateWithQueryParams: state.navigateWithQueryParams,
}));

vi.mock('../../../../config/investmentConfig.ts', () => ({
  getInvestmentConfigValue: state.getInvestmentConfigValue,
}));

vi.mock('@webdevelop-pro/invest-runtime/session', () => ({
  useSessionStore: () => ({
    userLoggedIn: state.userLoggedIn,
  }),
}));

vi.mock('@webdevelop-pro/invest-runtime/profiles', () => ({
  useProfilesStore: () => ({
    selectedUserProfileId: state.selectedUserProfileId,
    userProfiles: state.userProfiles,
    setSelectedUserProfileById: state.setSelectedUserProfileById,
  }),
}));

vi.mock('@webdevelop-pro/invest-runtime/adapters', () => ({
  getRequiredInvestRuntimeAdapter: (key: string) => {
    if (key !== 'investment') throw new Error(`Unexpected adapter: ${key}`);
    return {
      getInvestUnconfirmed: state.getInvestUnconfirmed,
      setInvest: state.setInvest,
    };
  },
}));

vi.mock('../../data/offer.repository.ts', () => ({
  useRepositoryOffer: () => ({
    getOfferOneState: state.getOfferOneState,
    getOfferOne: state.getOfferOne,
    getOfferComments: state.getOfferComments,
  }),
}));

vi.mock('@webdevelop-pro/invest-core/offer/formatter', () => ({
  OfferFormatter: class {
    constructor(private readonly offer: Record<string, unknown>) {}

    format() {
      return this.offer;
    }
  },
}));

vi.mock('@webdevelop-pro/invest-runtime/analytics/useSendAnalyticsEvent', () => ({
  useSendAnalyticsEvent: () => ({
    sendEvent: state.sendEvent,
  }),
}));

vi.mock('@webdevelop-pro/invest-runtime/error/errorReporting', () => ({
  reportError: state.reportError,
  reportOfflineReadError: state.reportOfflineReadError,
}));

enableAutoUnmount(afterEach);

function makeParams(value: OfferPageParams = {
  slug: 'static-offer',
  data: {
    id: 42,
    slug: 'static-offer',
    data: {},
    security_info: {},
  },
}) {
  return ref(value) as Ref<OfferPageParams | undefined>;
}

function mountComposable(params = makeParams()) {
  let viewModel!: ReturnType<typeof useOffersDetailsPage>;

  const wrapper = mount(defineComponent({
    setup() {
      viewModel = useOffersDetailsPage(params);
      return {};
    },
    template: '<div />',
  }));

  return {
    viewModel,
    wrapper,
  };
}

describe('useOffersDetailsPage', () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    state.route.path = '/offers/static-offer';
    state.userLoggedIn.value = false;
    state.selectedUserProfileId.value = 7;
    state.userProfiles.value = [];
    state.getOfferOneState.value = {
      loading: false,
      data: null,
      dataSource: null,
    };
    state.setInvestState.value = {
      data: null,
    };
    state.getInvestUnconfirmedOne.value = null;
    state.getInvestmentConfigValue.mockReturnValue('https://dashboard.example.test');
    state.getInvestUnconfirmed.mockResolvedValue(undefined);
    state.setInvest.mockResolvedValue(undefined);
    state.getOfferOne.mockImplementation(async () => {
      const offer = { id: 42, slug: 'static-offer', status: 'published' };
      state.getOfferOneState.value = { loading: false, data: offer, dataSource: 'network' };
      return offer;
    });
    state.getOfferComments.mockResolvedValue(undefined);
    state.sendEvent.mockResolvedValue(undefined);
  });

  it('does not fetch comments or files while the composable is only being set up for static render', async () => {
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const scope = effectScope();

    scope.run(() => {
      useOffersDetailsPage(makeParams());
    });
    await flushPromises();

    expect(state.getOfferComments).not.toHaveBeenCalled();

    scope.stop();
    consoleWarn.mockRestore();
  });

  it('fetches comments after the client component mounts', async () => {
    const { viewModel } = mountComposable();
    await flushPromises();

    expect(viewModel.offer.value?.id).toBe(42);
    expect(state.getOfferComments).toHaveBeenCalledTimes(1);
    expect(state.getOfferComments).toHaveBeenCalledWith(42);
  });

  it('fetches comments after mount when the user is logged in', async () => {
    state.userLoggedIn.value = true;

    mountComposable();
    await flushPromises();

    expect(state.getOfferComments).toHaveBeenCalledWith(42);
  });

  it('navigates to a newly created investment without mutating the readonly current investment', async () => {
    state.setInvest.mockResolvedValue({ id: 1005 });
    const { viewModel } = mountComposable();
    await flushPromises();

    expect(state.useInvestApplicationContext).toHaveBeenCalledOnce();

    await viewModel.investHandler();

    expect(state.useInvestApplicationContext).toHaveBeenCalledOnce();
    expect(state.setInvest).toHaveBeenCalledWith('static-offer', 7);
    expect(state.getInvestUnconfirmedOne.value).toBeNull();
    expect(state.navigateWithQueryParams).toHaveBeenCalledWith(
      'https://dashboard.example.test/invest/static-offer/amount/1005/7',
    );
    expect(state.reportError).not.toHaveBeenCalled();
  });

  it('creates a new investment instead of resuming another profile investment', async () => {
    state.getInvestUnconfirmedOne.value = {
      id: 998,
      offer: { slug: 'static-offer' },
      profile_id: 6,
      step: 'review',
    };
    state.setInvest.mockResolvedValue({ id: 1006 });
    state.getInvestUnconfirmed.mockResolvedValue({
      count: 1,
      data: [state.getInvestUnconfirmedOne.value],
    });
    const { viewModel } = mountComposable();
    await flushPromises();

    await viewModel.investHandler();

    expect(state.setInvest).toHaveBeenCalledWith('static-offer', 7);
    expect(state.navigateWithQueryParams).toHaveBeenCalledWith(
      'https://dashboard.example.test/invest/static-offer/amount/1006/7',
    );
  });

  it('resumes an investment only after reloading the matching offer and profile', async () => {
    const pending = {
      id: 998,
      offer: { slug: 'static-offer' },
      profile_id: 7,
      step: 'review',
    };
    state.getInvestUnconfirmed.mockResolvedValue({ count: 1, data: [pending] });
    const { viewModel } = mountComposable();
    await flushPromises();

    await viewModel.investHandler();

    expect(state.setInvest).not.toHaveBeenCalled();
    expect(state.navigateWithQueryParams).toHaveBeenCalledWith(
      'https://dashboard.example.test/invest/static-offer/review/998/7',
    );
  });

  it('keeps static and offline-cached content read-only', async () => {
    state.getOfferOne.mockImplementation(async () => {
      const offer = { id: 42, slug: 'static-offer', status: 'published' };
      state.getOfferOneState.value = { loading: false, data: offer, dataSource: 'offline-cache' };
      return offer;
    });
    const { viewModel } = mountComposable();
    await flushPromises();

    expect(viewModel.offer.value?.slug).toBe('static-offer');
    expect(viewModel.transactionalControlsEnabled.value).toBe(false);
    await viewModel.investHandler();
    expect(state.getInvestUnconfirmed).not.toHaveBeenCalled();
    expect(state.setInvest).not.toHaveBeenCalled();
  });

  it.each(['legal_closed', 'closed_successfully'])('keeps live %s offers public and read-only', async (status) => {
    state.getOfferOne.mockImplementation(async () => {
      const offer = { id: 42, slug: 'static-offer', status };
      state.getOfferOneState.value = { loading: false, data: offer, dataSource: 'network' };
      return offer;
    });
    const { viewModel } = mountComposable();
    await flushPromises();
    expect(viewModel.offer.value?.slug).toBe('static-offer');
    expect(viewModel.liveVerification.value).toBe('read_only');
    expect(viewModel.transactionalControlsEnabled.value).toBe(false);
  });

  it('invalidates static fallback and requests cache eviction on live 404', async () => {
    const onPublicOfferInvalidated = vi.fn();
    state.getOfferOne.mockRejectedValue({ data: { statusCode: 404 } });
    let viewModel!: ReturnType<typeof useOffersDetailsPage>;
    mount(defineComponent({
      setup() {
        viewModel = useOffersDetailsPage(makeParams(), { onPublicOfferInvalidated });
        return {};
      },
      template: '<div />',
    }));
    await flushPromises();
    expect(viewModel.offer.value).toBeNull();
    expect(viewModel.liveVerification.value).toBe('invalid');
    expect(onPublicOfferInvalidated).toHaveBeenCalledWith('/offers/static-offer');
  });
});
