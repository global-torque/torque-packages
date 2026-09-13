import { useInvestApplicationContext } from '@global-torque/invest-runtime/application-context';
import {
  computed,
  nextTick,
  onBeforeMount,
  onMounted,
  onUnmounted,
  watch,
  ref,
  type Ref,
  type WatchStopHandle,
} from 'vue';
import { storeToRefs } from 'pinia';
import { useRoute } from 'vitepress';
import { useGlobalLoader } from '@global-torque/invest-runtime/loader';
import { navigateWithQueryParams } from '@global-torque/invest-runtime/navigation';
import { InvestStepTypes } from '@global-torque/domain-types/investmentTypes';
import { useSessionStore } from '@global-torque/invest-runtime/session';
import { useProfilesStore } from '@global-torque/invest-runtime/profiles';
import { useRepositoryOffer } from '../data/offer.repository.ts';
import { OfferFormatter } from '@global-torque/invest-core/offer/formatter';
import { buildPublicFilerImageUrl } from '@global-torque/invest-data/filer';
import defaultOfferImage from '../assets/default.svg?url';
import { getRequiredInvestRuntimeAdapter } from '@global-torque/invest-runtime/adapters';
import type { IOffer, IOfferFormatted } from '@global-torque/domain-types/offerTypes';
import { useSendAnalyticsEvent } from '@global-torque/invest-runtime/analytics/useSendAnalyticsEvent';
import { reportError, reportOfflineReadError } from '@global-torque/invest-runtime/error/errorReporting';

type OfferPageParams = {
  slug?: string;
  data?: unknown;
};

type ProfileSummary = {
  id?: number;
  isKycApproved?: boolean;
};

type OfferDetailOptions = {
  onPublicOfferInvalidated?: (path: string) => void | Promise<void>;
};

const PUBLIC_READ_ONLY_STATUSES = new Set(['legal_closed', 'closed_successfully']);

const getHttpStatus = (error: unknown): number | undefined => {
  if (!error || typeof error !== 'object') return undefined;
  const candidate = error as {
    status?: unknown;
    statusCode?: unknown;
    data?: { statusCode?: unknown; status?: unknown };
    response?: { status?: unknown };
  };
  for (const value of [
    candidate.status,
    candidate.statusCode,
    candidate.data?.statusCode,
    candidate.data?.status,
    candidate.response?.status,
  ]) {
    if (typeof value === 'number') return value;
  }
  return undefined;
};

const defaultInvestSteps = {
  [InvestStepTypes.amount]: {
    title: 'Investment',
    value: InvestStepTypes.amount,
    done: false,
    to: 'amount',
  },
  [InvestStepTypes.ownership]: {
    title: 'Ownership',
    value: InvestStepTypes.ownership,
    done: false,
    to: 'ownership',
  },
  [InvestStepTypes.signature]: {
    title: 'Signature',
    value: InvestStepTypes.signature,
    done: false,
    to: 'signature',
  },
  [InvestStepTypes.funding]: {
    title: 'Funding',
    value: InvestStepTypes.funding,
    done: false,
    to: 'funding',
  },
  [InvestStepTypes.review]: {
    title: 'Confirmation',
    value: InvestStepTypes.review,
    done: false,
    to: 'review',
  },
};

const formatStaticOffer = (value: unknown): IOfferFormatted | null => {
  if (!value || typeof value !== 'object' || !('id' in value) || !('slug' in value)) {
    return null;
  }

  return new OfferFormatter(value as IOffer, {
    fallbackImage: defaultOfferImage,
    resolveImage: buildPublicFilerImageUrl,
  }).format();
};

const mergePreferMeaningful = <T extends object>(
  staticValue: T,
  liveValue: T,
) => {
  const merged = { ...staticValue };

  for (const [key, value] of Object.entries(liveValue as Record<string, unknown>)) {
    if (value === null || value === undefined) {
      continue;
    }
    if (typeof value === 'string' && value.trim() === '') {
      continue;
    }

    (merged as Record<string, unknown>)[key] = value;
  }

  return merged;
};

const mergeOfferData = (
  staticOffer: IOfferFormatted | null,
  liveOffer: IOfferFormatted | null,
): IOfferFormatted | null => {
  if (!staticOffer) return liveOffer;
  if (!liveOffer) return staticOffer;

  return {
    ...mergePreferMeaningful(staticOffer, liveOffer),
    data: mergePreferMeaningful(staticOffer.data ?? {}, liveOffer.data ?? {}),
    security_info: mergePreferMeaningful(
      staticOffer.security_info ?? {},
      liveOffer.security_info ?? {},
    ),
  } as IOfferFormatted;
};

export function useOffersDetailsPage(
  params: Ref<OfferPageParams | undefined>,
  options: OfferDetailOptions = {},
) {
  const userSessionStore = useSessionStore();
  const { userLoggedIn } = storeToRefs(userSessionStore);
  const profilesStore = useProfilesStore();
  const { selectedUserProfileId, userProfiles } = storeToRefs(profilesStore);
  const offerRepository = useRepositoryOffer();
  const { getOfferOneState } = storeToRefs(offerRepository);
  const investmentRepository = getRequiredInvestRuntimeAdapter('investment');
  const dashboardBase = useInvestApplicationContext().appConfig.urls.dashboard ?? '';
  const { sendEvent } = useSendAnalyticsEvent();
  const route = useRoute();
  let hideLoaderTimeoutId: number | undefined;
  let stopOfferAssetsWatcher: WatchStopHandle | undefined;
  const liveVerification = ref<'unverified' | 'published' | 'read_only' | 'invalid'>('unverified');

  const investSteps = computed(() => defaultInvestSteps);
  const isDeterministicFixture = computed(() => (
    Boolean(params.value?.data)
    && typeof params.value?.data === 'object'
    && (params.value.data as Record<string, unknown>).deterministicFixture === true
  ));
  const fallbackOffer = computed(() => formatStaticOffer(params.value?.data));
  const runtimeOffer = computed<IOfferFormatted | null>(() => {
    const nextOffer = getOfferOneState.value.data;
    const id = Number(nextOffer?.id);

    if (
      !Number.isFinite(id)
      || id <= 0
      || String(nextOffer?.slug ?? '') !== String(params.value?.slug ?? '')
    ) {
      return null;
    }

    return nextOffer ?? null;
  });
  const offer = computed(() => (
    liveVerification.value === 'invalid'
      ? null
      : mergeOfferData(fallbackOffer.value, runtimeOffer.value)
  ));
  const transactionalControlsEnabled = computed(() => liveVerification.value === 'published');
  const activeOfferId = computed(() => {
    const id = Number(offer.value?.id);
    return Number.isFinite(id) && id > 0 ? id : null;
  });
  const offerLoading = computed(() => (
    getOfferOneState.value.loading && !fallbackOffer.value
  ));

  const loadOfferAssets = (offerId: number) => {
    offerRepository.getOfferComments(offerId)
      .catch((error) => reportOfflineReadError(error, 'Failed to load offer comments'));
  };

  const switchToApprovedProfileIfNeeded = async () => {
    try {
      const profiles = (userProfiles.value || []) as ProfileSummary[];
      const current = profiles.find((profile) => profile?.id === selectedUserProfileId.value);

      if (profiles.length === 0 || current?.isKycApproved) {
        return;
      }

      const approvedProfiles = profiles.filter((profile) => profile?.isKycApproved);
      const randomApproved = approvedProfiles[Math.floor(Math.random() * approvedProfiles.length)];

      if (randomApproved?.id && randomApproved.id !== selectedUserProfileId.value) {
        profilesStore.setSelectedUserProfileById(randomApproved.id);
        await nextTick();
      }
    } catch {
      // Preserve the previous silent fallback if profile switching cannot complete.
    }
  };

  const investHandler = async () => {
    if (!transactionalControlsEnabled.value) return;
    await switchToApprovedProfileIfNeeded();
    const slug = String(params.value?.slug ?? '');
    const profileId = Number(selectedUserProfileId.value);
    let currentInvestment;
    try {
      const latest = await investmentRepository.getInvestUnconfirmed(slug, profileId);
      currentInvestment = latest?.data?.find(investment => (
        Number(investment.profile_id) === profileId
        && String(investment.offer?.slug ?? '') === slug
      ));
    } catch (error) {
      reportError(error, 'Failed to load pending investment');
      return;
    }

    if (!currentInvestment?.id) {
      try {
        const createdInvestment = await investmentRepository.setInvest(
          slug,
          selectedUserProfileId.value as unknown as string,
        );

        if (createdInvestment?.id) {
          navigateWithQueryParams(`${dashboardBase}/invest/${slug}/amount/${createdInvestment.id}/${selectedUserProfileId.value}`);
        }
      } catch (error) {
        reportError(error, 'Failed to start investment');
      }
    } else if (currentInvestment?.id) {
      const { step }: { step: InvestStepTypes } = currentInvestment;
      const name = Object.keys(investSteps.value).includes(step) ? investSteps.value[step].to : 'amount';
      navigateWithQueryParams(`${dashboardBase}/invest/${slug}/${name}/${currentInvestment.id}/${selectedUserProfileId.value}`);
    }
  };

  watch(
    () => route.path,
    () => {
      if (hideLoaderTimeoutId !== undefined) {
        window.clearTimeout(hideLoaderTimeoutId);
      }

      hideLoaderTimeoutId = window.setTimeout(() => {
        useGlobalLoader().hide();
      }, 100);
    },
  );

  onUnmounted(() => {
    stopOfferAssetsWatcher?.();
    stopOfferAssetsWatcher = undefined;

    if (hideLoaderTimeoutId !== undefined) {
      window.clearTimeout(hideLoaderTimeoutId);
    }
  });

  onBeforeMount(async () => {
    if (userLoggedIn.value && params.value?.slug) {
      investmentRepository.getInvestUnconfirmed(String(params.value?.slug), selectedUserProfileId.value)
        .catch((error) => reportOfflineReadError(error, 'Failed to load investment'));
    }
    if (params.value?.slug) {
      if (isDeterministicFixture.value) {
        liveVerification.value = 'read_only';
        return;
      }
      try {
        const liveOffer = await offerRepository.getOfferOne(String(params.value.slug));
        const isNetworkResponse = getOfferOneState.value.dataSource === 'network';
        if (isNetworkResponse && liveOffer.status === 'published') {
          liveVerification.value = 'published';
        } else if (isNetworkResponse && PUBLIC_READ_ONLY_STATUSES.has(liveOffer.status)) {
          liveVerification.value = 'read_only';
        } else if (isNetworkResponse) {
          liveVerification.value = 'invalid';
          await options.onPublicOfferInvalidated?.(route.path);
        }
      } catch (error) {
        if (getHttpStatus(error) === 404) {
          liveVerification.value = 'invalid';
          await options.onPublicOfferInvalidated?.(route.path);
        } else {
          reportOfflineReadError(error, 'Failed to load offer');
        }
      }
      void sendEvent({
        event_type: 'open',
        method: 'GET',
        httpRequestMethod: 'GET',
        request_path: route.path,
        httpRequestUrl: `/public/offer/${params.value?.slug}`,
      });
    }
  });

  onMounted(() => {
    stopOfferAssetsWatcher = watch(activeOfferId, (offerId) => {
      if (!offerId) {
        return;
      }

      loadOfferAssets(offerId);
    }, { immediate: true });
  });

  return {
    offer,
    offerLoading,
    transactionalControlsEnabled,
    liveVerification,
    investHandler,
  };
}
