<script setup lang="ts">
import {
  computed, onMounted, onUnmounted, ref, watch,
} from 'vue';
import { useRoute } from 'vitepress';
import { Button } from '@global-torque/ui-primitives/button';
import VKycActionButton from '@global-torque/invest-widgets/kyc/VKycActionButton.vue';
import { storeToRefs } from 'pinia';
import { useSessionStore } from '@global-torque/invest-runtime/session';
import { useProfilesStore } from '@global-torque/invest-runtime/profiles';
import { useKycAlertViewModel } from '@global-torque/invest-widgets/kyc';
import { useSendAnalyticsEvent } from '@global-torque/invest-runtime/analytics/useSendAnalyticsEvent';
import { reportError } from '@global-torque/invest-runtime/error/errorReporting';
import { useEventListener } from '@vueuse/core';
import { OfferTabTypes } from './logic/useOffersDetailsContent.ts';
import { useOfferSignIn } from './logic/useOfferSignIn.ts';
import { useSyncWithUrl } from '@global-torque/ui-kit/url-sync';

const props = defineProps({
  isSharesReached: {
    type: Boolean,
    required: true,
  },
  loading: Boolean,
});

const emit = defineEmits(['invest']);

const userSessionStore = useSessionStore();
const { userLoggedIn } = storeToRefs(userSessionStore);
const profilesStore = useProfilesStore();
const { selectedUserProfileData, hasAnyKycApprovedProfile } = storeToRefs(profilesStore);
const { alertModel: kycAlertModel } = useKycAlertViewModel();
const route = useRoute();
const { sendEvent } = useSendAnalyticsEvent();
const { signIn } = useOfferSignIn();

const rootEl = ref<HTMLElement | null>(null);
const isFloating = ref(false);
const initialBottom = ref<number | null>(null);
const footerEl = ref<HTMLElement | null>(null);
const isFooterVisible = ref(false);
const isClient = typeof window !== 'undefined';
const isClientReady = ref(false);
let footerObserver: IntersectionObserver | null = null;
let frameId = 0;

const activeTab = useSyncWithUrl<string>({
  key: 'tab',
  defaultValue: OfferTabTypes.description,
});

const showInvestBtn = computed(() => (
  selectedUserProfileData.value?.isKycApproved
  || hasAnyKycApprovedProfile.value
  || props.isSharesReached
));
const showKycBtn = computed(() => (
  !hasAnyKycApprovedProfile.value
  && !showInvestBtn.value
  && kycAlertModel.value.show
  && Boolean(kycAlertModel.value.buttonText)
  && !props.isSharesReached
));
const canFloatButton = computed(() => (
  isClient
  && activeTab.value === OfferTabTypes.description
));

const investClickHandler = () => {
  emit('invest');
  void sendEvent({
    event_type: 'click',
    method: 'GET',
    httpRequestMethod: 'GET',
    request_path: route.path,
  }).catch((error) => {
    reportError(error, 'Failed to record offer investment analytics');
  });
};

const updateFloatingState = () => {
  if (!canFloatButton.value) {
    isFloating.value = false;
    return;
  }

  // Use floating behavior only on mobile / small screens
  const isMobile = window.innerWidth < 768;
  if (!isMobile) {
    isFloating.value = false;
    return;
  }

  // Only show floating button on the Description tab
  if (activeTab.value && activeTab.value !== OfferTabTypes.description) {
    isFloating.value = false;
    return;
  }

  // If we haven't measured the original button position yet, do nothing
  if (!initialBottom.value) return;

  // Start floating once the original button has completely scrolled above the viewport
  const scrolledPastButton = window.scrollY >= initialBottom.value;

  isFloating.value = scrolledPastButton && !isFooterVisible.value;
};

const scheduleFloatingStateUpdate = () => {
  if (!isClient) return;
  if (frameId) return;
  frameId = window.requestAnimationFrame(() => {
    frameId = 0;
    updateFloatingState();
  });
};

const updateInitialBottom = () => {
  if (!isClient || !rootEl.value) return;
  const rect = rootEl.value.getBoundingClientRect();
  initialBottom.value = rect.bottom + window.scrollY;
};

if (isClient) {
  useEventListener(window, 'scroll', scheduleFloatingStateUpdate, { passive: true });
  useEventListener(window, 'resize', () => {
    updateInitialBottom();
    scheduleFloatingStateUpdate();
  });
}

watch(
  () => activeTab.value,
  () => {
    scheduleFloatingStateUpdate();
  },
);

onMounted(() => {
  if (!isClient) return;

  footerEl.value = document.querySelector('.app-layout-default__footer') as HTMLElement | null;
  if (footerEl.value && typeof IntersectionObserver !== 'undefined') {
    footerObserver = new IntersectionObserver(
      ([entry]) => {
        isFooterVisible.value = entry.isIntersecting;
        scheduleFloatingStateUpdate();
      },
      {
        root: null,
        threshold: 0,
        rootMargin: '0px 0px -24px 0px',
      },
    );
    footerObserver.observe(footerEl.value);
  }

  updateInitialBottom();

  scheduleFloatingStateUpdate();
  isClientReady.value = true;
});

watch(() => rootEl.value, () => {
  updateInitialBottom();
  scheduleFloatingStateUpdate();
});

onUnmounted(() => {
  if (frameId) {
    window.cancelAnimationFrame(frameId);
    frameId = 0;
  }
  if (footerObserver) {
    footerObserver.disconnect();
    footerObserver = null;
  }
});
</script>

<template>
  <div
    ref="rootEl"
    class="OffersDetailsBtn offer-details-btn"
    :class="{ 'offer-details-btn--floating': isFloating }"
  >
    <Button
      v-if="!isClientReady"
      class="offer-details-btn__btn"
      disabled
      size="lg"
    >
      Loading...
    </Button>
    <template v-else>
      <Button
        v-if="!userLoggedIn"
        class="offer-details-btn__btn"
        @click="signIn"
        size="lg"
      >
        Log in
      </Button>
      <Button
        v-else-if="showInvestBtn"
        class="offer-details-btn__btn"
        :disabled="loading || isSharesReached"
        @click="investClickHandler"
        size="lg"
      >
        Invest Now
      </Button>
      <VKycActionButton
        v-else-if="showKycBtn"
        class="offer-details-btn__btn"
        size="large"
      />
      <p
        v-else
        class="offer-details-btn__info is--small"
      >
        You haven't passed KYC!
      </p>
      <p
        v-if="isSharesReached && showInvestBtn"
        class="offer-details-btn__info is--small"
      >
        Offer already reached subscription
      </p>
    </template>
  </div>
</template>

<style lang="scss">
.offer-details-btn {
  &__btn {
    width: 100%;
  }

  &__info {
    margin-top: 8px;
    color: var(--color-text-meta);
  }

  &.offer-details-btn--floating {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 12px;
    z-index: 90;
    margin: 0 auto;
  }
}

.mobile-app-shell .offer-details-btn.offer-details-btn--floating,
.pwa-mobile .offer-details-btn.offer-details-btn--floating {
  bottom: calc(var(--pwa-footer-safe-offset) + env(safe-area-inset-bottom) + 12px);
}

</style>
