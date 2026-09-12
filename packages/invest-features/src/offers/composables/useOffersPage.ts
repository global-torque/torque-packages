// @ts-nocheck
import {
  computed,
  onMounted,
  onUnmounted,
  watch,
} from 'vue';
import { storeToRefs } from 'pinia';
import { useRoute } from 'vitepress';
import { useReactiveLocation } from '@global-torque/ui-kit/url-sync';
import { useGlobalLoader } from '@webdevelop-pro/invest-runtime/loader';
import type { VOfferCardData } from '@webdevelop-pro/domain-types/offerCardTypes';
import { useRepositoryOffer } from '../data/offer.repository.ts';
import { reportOfflineReadError } from '@webdevelop-pro/invest-runtime/error/errorReporting';

type OffersPageFilter = 'new' | 'almost-funded' | '';
type OffersPageOffer = VOfferCardData & {
  approved_at?: string;
  isNew?: boolean;
  offerFundedPercent?: number;
  isStatusPublished?: boolean;
  isStatusLegalClosed?: boolean;
};

const OFFERS_PAGE_BASE_URL = 'https://invest.local';

function getTimestamp(value?: string) {
  if (!value) {
    return 0;
  }

  const timestamp = Date.parse(value);

  return Number.isFinite(timestamp) ? timestamp : 0;
}

function getNumericId(value?: string | number) {
  const id = Number(value);

  return Number.isFinite(id) ? id : 0;
}

function getFundedPercent(offer: OffersPageOffer) {
  return Number.isFinite(offer.offerFundedPercent)
    ? Number(offer.offerFundedPercent)
    : 0;
}

function compareNewestOffers(left: OffersPageOffer, right: OffersPageOffer) {
  return Number(Boolean(right.isNew)) - Number(Boolean(left.isNew))
    || getTimestamp(right.approved_at) - getTimestamp(left.approved_at)
    || getNumericId(right.id) - getNumericId(left.id);
}

function compareAlmostFundedOffers(left: OffersPageOffer, right: OffersPageOffer) {
  return Number(Boolean(left.isStatusClosedSuccessfully)) - Number(Boolean(right.isStatusClosedSuccessfully))
    || getFundedPercent(right) - getFundedPercent(left)
    || compareNewestOffers(left, right);
}

function normalizeOffersPageFilter(value: string | null): OffersPageFilter {
  return value === 'new' || value === 'almost-funded' ? value : '';
}

function sortOffersForFilter(offers: OffersPageOffer[], filter: OffersPageFilter) {
  if (filter === 'new') {
    return [...offers].sort(compareNewestOffers);
  }

  if (filter === 'almost-funded') {
    return [...offers].sort(compareAlmostFundedOffers);
  }

  return offers;
}

export function useOffersPage(options: {
  isVisible?: (offer: VOfferCardData) => boolean;
} = {}) {
  const offerRepository = useRepositoryOffer();
  const { getOffersState } = storeToRefs(offerRepository);
  const globalLoader = useGlobalLoader();
  const route = useRoute();
  const currentLocationPath = useReactiveLocation(route.path ?? '/offers');
  let routeHideLoaderTimeoutId: number | undefined;

  const visibleOffers = computed<OffersPageOffer[]>(() => (
    ((getOffersState.value.data?.data || []) as OffersPageOffer[])
      .filter((offer) => options.isVisible?.(offer) ?? true)
  ));
  const offerFilter = computed<OffersPageFilter>(() => {
    const url = new URL(currentLocationPath.value || '/', OFFERS_PAGE_BASE_URL);

    return normalizeOffersPageFilter(url.searchParams.get('filter'));
  });
  const sortedOffers = computed<VOfferCardData[]>(() => (
    sortOffersForFilter(
      visibleOffers.value.filter((offer) => offer.isStatusPublished),
      offerFilter.value,
    )
  ));
  const offersFinalizing = computed(() => visibleOffers.value
    .filter((offer) => offer.isStatusLegalClosed)
    .map((offer) => ({ ...offer, actionLabel: 'View Offer' })));
  const offersClosed = computed(() => visibleOffers.value
    .filter((offer) => offer.isStatusClosedSuccessfully)
    .map((offer) => ({ ...offer, actionLabel: 'View Offer' })));
  const showClosed = computed(() => ((offersClosed.value?.length || 0) > 0));

  globalLoader.hide();

  watch(
    () => route.path,
    () => {
      if (routeHideLoaderTimeoutId !== undefined) {
        window.clearTimeout(routeHideLoaderTimeoutId);
      }

      routeHideLoaderTimeoutId = window.setTimeout(() => {
        globalLoader.hide();
      }, 0);
    },
  );

  onUnmounted(() => {
    if (routeHideLoaderTimeoutId !== undefined) {
      window.clearTimeout(routeHideLoaderTimeoutId);
    }
  });

  onMounted(() => {
    if (!getOffersState.value.data) {
      offerRepository.getOffers()
        .catch((error) => reportOfflineReadError(error, 'Failed to load offers'));
    }
  });

  return {
    getOffersState,
    offers: sortedOffers,
    offersFinalizing,
    offersClosed,
    offerFilter,
    showClosed,
  };
}
