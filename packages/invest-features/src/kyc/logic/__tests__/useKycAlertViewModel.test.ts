import {
  beforeEach, describe, expect, it, vi,
} from 'vitest';
import { ref } from 'vue';
import { mount } from '@vue/test-utils';
import {
  getInvestDataClientConfig,
  setInvestDataClientConfig,
  type InvestDataClientConfig,
} from '@global-torque/invest-data/service/dataClientConfig';
import { PROFILE_TYPES } from '@global-torque/domain-types/profileTypes';
import { InvestKycTypes } from '@global-torque/domain-types/kycTypes';
import { useKycAlertViewModel } from '../useKycAlertViewModel.ts';

const mockPush = vi.fn();
let mockRoute: { fullPath: string; query: Record<string, string> } | null = {
  fullPath: '/dashboard?tab=wallet',
  query: { tab: 'wallet' },
};
let mockRouter: { push: typeof mockPush } | null = {
  push: mockPush,
};
const openContactUsDialog = vi.fn();
const handlePlaidKyc = vi.fn();

const mockProfilesStore = {
  selectedUserProfileData: ref<any>(null),
  selectedUserProfileId: ref<number | null>(123),
  selectedUserProfileShowKycInitForm: ref(false),
  selectedUserProfileType: ref('individual'),
  selectedUserIndividualProfile: ref<any>(null),
};
const mockSessionStore = {
  userLoggedIn: ref(true),
};
const mockRepositoryKyc = {
  isPlaidLoading: ref(false),
  handlePlaidKyc,
};

vi.mock('vue-router', () => ({
  useRouter: () => mockRouter,
  useRoute: () => mockRoute,
}));

vi.mock('@global-torque/invest-runtime/dialogs', () => ({
  useDialogs: () => ({
    openContactUsDialog,
  }),
}));

vi.mock('@global-torque/invest-runtime/profiles', () => ({
  useProfilesStore: () => mockProfilesStore,
}));

vi.mock('@global-torque/invest-runtime/session', () => ({
  useSessionStore: () => mockSessionStore,
}));

vi.mock('../../model/useKycModel.ts', () => ({
  useKycModel: () => mockRepositoryKyc,
}));

const createViewModel = () => {
  let viewModel!: ReturnType<typeof useKycAlertViewModel>;

  mount({
    template: '<div />',
    setup() {
      viewModel = useKycAlertViewModel();

      return {};
    },
  });

  return viewModel;
};

describe('useKycAlertViewModel', () => {
  let originalAppConfig: InvestDataClientConfig;
  let originalLocation: Location;

  beforeEach(() => {
    originalAppConfig = getInvestDataClientConfig();
    setInvestDataClientConfig({
      ...originalAppConfig,
      appUrls: {
        ...originalAppConfig.appUrls,
        dashboard: 'https://www.torque.investments/dashboard',
        static: 'https://www.torque.investments',
      },
    });
    originalLocation = window.location;
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        origin: 'https://www.torque.investments',
        href: 'https://www.torque.investments/voltcore-solid-state-battery-round?tab=overview#terms',
        assign: vi.fn(),
      },
    });
    vi.clearAllMocks();
    mockRoute = {
      fullPath: '/dashboard?tab=wallet',
      query: { tab: 'wallet' },
    };
    mockRouter = {
      push: mockPush,
    };
    mockProfilesStore.selectedUserProfileData.value = {
      isKycApproved: false,
      kyc_status: InvestKycTypes.pending,
    };
    mockProfilesStore.selectedUserProfileId.value = 123;
    mockProfilesStore.selectedUserProfileShowKycInitForm.value = false;
    mockProfilesStore.selectedUserProfileType.value = 'individual';
    mockProfilesStore.selectedUserIndividualProfile.value = null;
    mockSessionStore.userLoggedIn.value = true;
    mockRepositoryKyc.isPlaidLoading.value = false;
    handlePlaidKyc.mockResolvedValue({ success: true });
    mockPush.mockResolvedValue(undefined);
  });

  afterEach(() => {
    setInvestDataClientConfig(originalAppConfig);
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalLocation,
    });
  });

  it('hides the alert for approved profiles', () => {
    mockProfilesStore.selectedUserProfileData.value = {
      isKycApproved: true,
      kyc_status: InvestKycTypes.approved,
    };

    const viewModel = createViewModel();

    expect(viewModel.alertModel.value.show).toBe(false);
  });

  it('navigates to submit KYC with redirect when the init form is required', async () => {
    mockProfilesStore.selectedUserProfileShowKycInitForm.value = true;

    const viewModel = createViewModel();
    await viewModel.onPrimaryAction();

    expect(mockPush).toHaveBeenCalledWith(
      '/dashboard/profile/123/kyc?tab=wallet&redirect=%2Fdashboard%3Ftab%3Dwallet',
    );
    expect(handlePlaidKyc).not.toHaveBeenCalled();
  });

  it('navigates to submit KYC with the current browser URL when router context is unavailable', async () => {
    mockProfilesStore.selectedUserProfileShowKycInitForm.value = true;
    mockRoute = null;
    mockRouter = null;

    const viewModel = createViewModel();
    await viewModel.onPrimaryAction();

    expect(window.location.assign).toHaveBeenCalledWith(
      'https://www.torque.investments/dashboard/profile/123/kyc?redirect=https%3A%2F%2Fwww.torque.investments%2Fvoltcore-solid-state-battery-round%3Ftab%3Doverview%23terms',
    );
    expect(mockPush).not.toHaveBeenCalled();
    expect(handlePlaidKyc).not.toHaveBeenCalled();
  });

  it('starts Plaid directly when the init form is not required', async () => {
    const viewModel = createViewModel();
    await viewModel.onPrimaryAction();

    expect(handlePlaidKyc).toHaveBeenCalledWith(123);
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('resolves SDIRA and SOLO401K profiles through the linked individual profile', async () => {
    mockProfilesStore.selectedUserProfileType.value = PROFILE_TYPES.SDIRA;
    mockProfilesStore.selectedUserIndividualProfile.value = { id: 999 };

    const viewModel = createViewModel();
    await viewModel.onPrimaryAction();

    expect(handlePlaidKyc).toHaveBeenCalledWith(999);
  });

  it('opens contact us when the description action targets the support link', () => {
    const viewModel = createViewModel();
    const preventDefault = vi.fn();
    const stopPropagation = vi.fn();

    viewModel.onDescriptionAction({
      target: {
        closest: (selector: string) => (selector === '[data-action="contact-us"]' ? {} : null),
      },
      preventDefault,
      stopPropagation,
    } as unknown as Event);

    expect(preventDefault).toHaveBeenCalled();
    expect(stopPropagation).toHaveBeenCalled();
    expect(openContactUsDialog).toHaveBeenCalledWith('dashboard verification');
  });

  it('opens contact us when keyboard activation comes from the rich-text wrapper', () => {
    const viewModel = createViewModel();
    const preventDefault = vi.fn();
    const stopPropagation = vi.fn();

    viewModel.onDescriptionAction({
      target: {
        closest: () => null,
      },
      currentTarget: {
        querySelector: (selector: string) => (selector === '[data-action="contact-us"]' ? {} : null),
      },
      preventDefault,
      stopPropagation,
    } as unknown as Event);

    expect(preventDefault).toHaveBeenCalled();
    expect(stopPropagation).toHaveBeenCalled();
    expect(openContactUsDialog).toHaveBeenCalledWith('dashboard verification');
  });

  it('reflects Plaid loading in the alert CTA state', () => {
    mockRepositoryKyc.isPlaidLoading.value = true;

    const viewModel = createViewModel();

    expect(viewModel.alertModel.value.isLoading).toBe(true);
    expect(viewModel.alertModel.value.isDisabled).toBe(true);
  });

  it('does not run the primary action when the alert has no CTA', async () => {
    mockProfilesStore.selectedUserProfileData.value = {
      isKycApproved: false,
      kyc_status: InvestKycTypes.in_progress,
    };

    const viewModel = createViewModel();
    await viewModel.onPrimaryAction();

    expect(handlePlaidKyc).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });
});
