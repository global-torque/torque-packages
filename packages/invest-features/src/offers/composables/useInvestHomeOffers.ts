// @ts-nocheck
import {
  computed,
  onBeforeUnmount,
  onMounted,
} from 'vue';
import { storeToRefs } from 'pinia';
import type { VOfferCardData } from '@global-torque/domain-types/offerCardTypes';
import { useRepositoryOffer } from '../data/offer.repository.ts';
import { reportOfflineReadError } from '@global-torque/invest-runtime/error/errorReporting';

const HOME_OFFER_LIMIT = 6;

type IdleSchedulerWindow = Window & typeof globalThis & {
  requestIdleCallback?: (callback: IdleRequestCallback) => number;
  cancelIdleCallback?: (handle: number) => void;
};

export function useInvestHomeOffers(options: {
  isVisible?: (offer: VOfferCardData) => boolean;
} = {}) {
  const offerRepository = useRepositoryOffer();
  const { getOffersState } = storeToRefs(offerRepository);
  let offersFetchTimeoutId: number | undefined;
  let offersFetchIdleId: number | undefined;
  let isUnmounted = false;

  const offers = computed<VOfferCardData[]>(() => (
    ((getOffersState.value.data?.data || []) as Array<VOfferCardData & { isStatusPublished?: boolean }>)
      .filter((offer) => options.isVisible?.(offer) ?? true)
      .filter((offer) => offer.isStatusPublished)
      .slice(0, HOME_OFFER_LIMIT)
  ));
  const offersLoading = computed(() => getOffersState.value.loading);

  const loadOffers = async () => {
    if (getOffersState.value.data || getOffersState.value.loading) {
      return;
    }

    try {
      await offerRepository.getOffers();
    } catch (error: unknown) {
      reportOfflineReadError(error, 'Failed to load offers');
    }
  };

  onMounted(() => {
    isUnmounted = false;

    if (
      typeof window === 'undefined'
      || getOffersState.value.data
      || getOffersState.value.loading
    ) {
      return;
    }

    const idleWindow = window as IdleSchedulerWindow;
    if (idleWindow.requestIdleCallback) {
      offersFetchIdleId = idleWindow.requestIdleCallback(() => {
        offersFetchIdleId = undefined;
        if (isUnmounted) return;
        void loadOffers();
      });
      return;
    }

    offersFetchTimeoutId = window.setTimeout(() => {
      offersFetchTimeoutId = undefined;
      if (isUnmounted) return;
      void loadOffers();
    }, 0);
  });

  onBeforeUnmount(() => {
    isUnmounted = true;

    if (offersFetchTimeoutId !== undefined) {
      window.clearTimeout(offersFetchTimeoutId);
      offersFetchTimeoutId = undefined;
    }

    if (offersFetchIdleId !== undefined) {
      (window as IdleSchedulerWindow).cancelIdleCallback?.(offersFetchIdleId);
      offersFetchIdleId = undefined;
    }
  });

  return {
    offers,
    offersLoading,
    loadOffers,
  };
}
