import {
  beforeEach, describe, expect, it, vi,
} from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import {
  computed, nextTick, ref,
} from 'vue';
import type { KycAlertModel } from '@global-torque/invest-core/kyc/status';
import OffersDetailsBtn from '../OffersDetailsBtn.vue';

const userLoggedIn = ref(true);
const selectedUserProfileData = ref<any>(null);
const hasAnyKycApprovedProfile = ref(false);
const alertModel = ref<KycAlertModel>({
  show: false,
  variant: 'error' as const,
  title: '',
  description: '',
  buttonText: undefined as string | undefined,
  isLoading: false,
  isDisabled: false,
});
const sendEvent = vi.fn();
const reportError = vi.hoisted(() => vi.fn());

vi.mock('pinia', async () => {
  const actual = await vi.importActual<typeof import('pinia')>('pinia');
  return {
    ...actual,
    storeToRefs: (store: Record<string, unknown>) => {
      if ('userLoggedIn' in store) {
        return { userLoggedIn };
      }

      if ('selectedUserProfileData' in store) {
        return { selectedUserProfileData, hasAnyKycApprovedProfile };
      }

      return actual.storeToRefs(store as never);
    },
  };
});

vi.mock('@global-torque/invest-runtime/session', () => ({
  useSessionStore: () => ({
    userLoggedIn,
  }),
}));

vi.mock('@global-torque/invest-runtime/profiles', () => ({
  useProfilesStore: () => ({
    selectedUserProfileData,
    hasAnyKycApprovedProfile,
  }),
}));

vi.mock('@global-torque/invest-widgets/kyc', () => ({
  useKycAlertViewModel: () => ({
    alertModel,
    onPrimaryAction: vi.fn(),
  }),
}));

vi.mock('@global-torque/invest-runtime/analytics/useSendAnalyticsEvent', () => ({
  useSendAnalyticsEvent: () => ({
    sendEvent,
  }),
}));

vi.mock('@global-torque/invest-runtime/error/errorReporting', () => ({ reportError }));

vi.mock('vitepress', () => ({
  useRoute: () => ({
    path: '/offers/test-offer',
  }),
}));

vi.mock('@global-torque/invest-runtime/navigation', () => ({
  navigateWithQueryParams: vi.fn(),
}));

vi.mock('@global-torque/ui-kit/url-sync', () => ({
  useSyncWithUrl: () => computed(() => 'description'),
}));

const offerKycActionButtonStub = {
  name: 'VKycActionButton',
  template: '<button class="offer-kyc-btn">Continue</button>',
};

describe('OffersDetailsBtn', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    userLoggedIn.value = true;
    selectedUserProfileData.value = { isKycApproved: false };
    hasAnyKycApprovedProfile.value = false;
    alertModel.value = {
      show: false,
      variant: 'error',
      title: '',
      description: '',
      buttonText: undefined,
      isLoading: false,
      isDisabled: false,
    };
  });

  it('shows the centralized KYC action button when the offer still requires KYC', async () => {
    alertModel.value = {
      show: true,
      variant: 'error',
      title: 'Finish Your KYC',
      description: 'Complete KYC',
      buttonText: 'Continue',
      isLoading: false,
      isDisabled: false,
    };

    const wrapper = mount(OffersDetailsBtn, {
      props: {
        isSharesReached: false,
        loading: false,
      },
      global: {
        stubs: {
          VButton: true,
          VKycActionButton: offerKycActionButtonStub,
        },
      },
    });

    await nextTick();
    expect(wrapper.find('.offer-kyc-btn').exists()).toBe(true);
    expect(wrapper.text()).toContain('Continue');
  });

  it('emits the investment intent without waiting for best-effort analytics', async () => {
    selectedUserProfileData.value = { isKycApproved: true };
    sendEvent.mockReturnValueOnce(new Promise(() => undefined));
    const wrapper = mount(OffersDetailsBtn, {
      props: {
        isSharesReached: false,
        loading: false,
      },
      global: {
        stubs: {
          VButton: {
            emits: ['click'],
            template: '<button type="button" @click="$emit(\'click\')"><slot /></button>',
          },
          VKycActionButton: offerKycActionButtonStub,
        },
      },
    });

    await nextTick();
    await wrapper.get('button').trigger('click');

    expect(wrapper.emitted('invest')).toHaveLength(1);
    expect(sendEvent).toHaveBeenCalledOnce();
  });

  it('reports rejected analytics after preserving the investment intent', async () => {
    selectedUserProfileData.value = { isKycApproved: true };
    const analyticsError = new Error('analytics unavailable');
    sendEvent.mockRejectedValueOnce(analyticsError);
    const wrapper = mount(OffersDetailsBtn, {
      props: {
        isSharesReached: false,
        loading: false,
      },
      global: {
        stubs: {
          VButton: {
            emits: ['click'],
            template: '<button type="button" @click="$emit(\'click\')"><slot /></button>',
          },
          VKycActionButton: offerKycActionButtonStub,
        },
      },
    });

    await nextTick();
    await wrapper.get('button').trigger('click');
    expect(wrapper.emitted('invest')).toHaveLength(1);

    await flushPromises();
    expect(reportError).toHaveBeenCalledWith(
      analyticsError,
      'Failed to record offer investment analytics',
    );
  });

  it('keeps the fallback text when the centralized KYC alert is not actionable', async () => {
    selectedUserProfileData.value = {
      isKycApproved: false,
    };
    alertModel.value = {
      show: true,
      variant: 'info',
      title: 'Verification In Progress',
      description: 'Waiting for review',
      buttonText: undefined,
      isLoading: false,
      isDisabled: false,
    };

    const wrapper = mount(OffersDetailsBtn, {
      props: {
        isSharesReached: false,
        loading: false,
      },
      global: {
        stubs: {
          VButton: true,
          VKycActionButton: offerKycActionButtonStub,
        },
      },
    });

    await nextTick();
    expect(wrapper.text()).toContain("You haven't passed KYC!");
    expect(wrapper.find('.offer-kyc-btn').exists()).toBe(false);
  });

  it('keeps the fallback text when KYC is declined and has no CTA', async () => {
    selectedUserProfileData.value = {
      isKycApproved: false,
    };
    alertModel.value = {
      show: true,
      variant: 'error',
      title: 'Verification Declined',
      description: 'Contact support',
      buttonText: undefined,
      isLoading: false,
      isDisabled: false,
    };

    const wrapper = mount(OffersDetailsBtn, {
      props: {
        isSharesReached: false,
        loading: false,
      },
      global: {
        stubs: {
          VButton: true,
          VKycActionButton: offerKycActionButtonStub,
        },
      },
    });

    await nextTick();
    expect(wrapper.text()).toContain("You haven't passed KYC!");
    expect(wrapper.find('.offer-kyc-btn').exists()).toBe(false);
  });

  it('keeps the fallback text when the centralized KYC alert is hidden', async () => {
    selectedUserProfileData.value = {
      isKycApproved: false,
    };
    alertModel.value = {
      show: false,
      variant: 'error',
      title: '',
      description: '',
      buttonText: 'Continue',
      isLoading: false,
      isDisabled: false,
    };

    const wrapper = mount(OffersDetailsBtn, {
      props: {
        isSharesReached: false,
        loading: false,
      },
      global: {
        stubs: {
          VButton: true,
          VKycActionButton: offerKycActionButtonStub,
        },
      },
    });

    await nextTick();
    expect(wrapper.text()).toContain("You haven't passed KYC!");
    expect(wrapper.find('.offer-kyc-btn').exists()).toBe(false);
  });
});
