<script setup lang="ts">
// @ts-nocheck
import { IOfferFormatted } from '@global-torque/domain-types/offerTypes';
import { PropType, computed } from 'vue';
import { Skeleton } from '@global-torque/ui-primitives/skeleton';
import { ShareIcon as share, InfoIcon as infoIcon } from '@global-torque/invest-widgets/icons/action';
import { FileIcon as file } from '@global-torque/invest-widgets/icons/file';
import OffersDetailsBtn from './OffersDetailsBtn.vue';
import { Progress } from '@global-torque/ui-primitives/progress';
import { Button } from '@global-torque/ui-primitives/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@global-torque/ui-primitives/tooltip';
import { useOffersDetailsSide } from './logic/useOffersDetailsSide.ts';
import { useDialogs } from '@global-torque/invest-runtime/dialogs';

const props = defineProps({
  offer: {
    type: Object as PropType<IOfferFormatted>,
  },
  loading: {
    type: Boolean,
    default: true,
  },
  transactional: {
    type: Boolean,
    default: false,
  },
});
defineEmits(['invest']);

const offerRef = computed(() => props.offer);
const {
  readOnlyInfo,
  openEndedNavNotice,
  onChainDetails,
  investmentDocUrl,
  onShareClick,
  copied,
  isOpenEnded,
} = useOffersDetailsSide(offerRef);
const dialogsStore = useDialogs();

const handleContactUsClick = () => {
  dialogsStore.openContactUsDialog('offers');
};
</script>

<template>
  <div class="OfferDetailsSide offer-details-side">
    <div
      class="offer-details-side__share-wrap is--gt-desktop-show"
    >
      <Button
        class="offer-details-side__share bg-accent text-accent-foreground hover:bg-accent/80"
        @click.stop="onShareClick"
        variant="ghost"
        size="sm"
      >
        <share
          class="offer-details-side__share-icon"
        />
        <span v-if="!copied">Share</span>
        <span v-else>Copied!</span>
      </Button>
    </div>
    <div
      v-if="!isOpenEnded"
      class="offer-details-side__progress-wrap"
    >
      <div class="flex flex-col gap-2">
        <span class="is--h5__title">
          {{ offer?.offerFundedPercent }}% Funded
        </span>
        <Progress
          :model-value="offer?.offerFundedPercent"
          aria-label="Funding progress"
        />
      </div>
    </div>
    <div class="offer-details-side__side-card">
      <div class="offer-details-side__side-details">
        <template v-if="loading">
          <Skeleton
            v-for="i in 4"
            :key="i"
            class="offer-details-side__side-details-info"
            :style="{ width: '100%', height: '26px' }"
          />
        </template>
        <aside
          v-if="openEndedNavNotice"
          class="offer-details-side__nav-notice"
          role="status"
          data-testid="offer-nav-notice"
        >
          <strong class="offer-details-side__nav-notice-title is--h6__title">
            {{ openEndedNavNotice.title }}
          </strong>
          <p class="offer-details-side__nav-notice-text is--small">
            {{ openEndedNavNotice.text }}
          </p>
        </aside>
        <template
          v-for="(item, index) in readOnlyInfo"
          :key="index"
        >
          <div
            v-if="item.text && item.show !== false"
            class="offer-details-side__side-details-info"
          >
            <span class="offer-details-side__side-details-label is--h6__title">
              {{ item.title }}
            </span>

            <Skeleton
              v-if="loading"
              class="offer-details-side__details-value is--body"
              :style="{ width: '100px', height: '26px' }"
            />
            <TooltipProvider v-else-if="item.tooltip" :delay-duration="100">
              <Tooltip>
                <TooltipTrigger>
                  <span class="offer-details-side__details-value is--body is--tooltip">
                    <infoIcon class="offer-details-side__info-icon" />
                    {{ item.text }}
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  {{ item.tooltip }}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <span
              v-else
              class="offer-details-side__details-value is--body"
            >
              {{ item.text }}
            </span>
          </div>
        </template>
        <details
          v-if="onChainDetails?.length"
          class="offer-details-side__on-chain"
          data-testid="offer-on-chain-details"
        >
          <summary class="offer-details-side__on-chain-title is--h6__title">
            On-chain details
          </summary>
          <div class="offer-details-side__on-chain-content">
            <div
              v-for="item in onChainDetails"
              :key="item.key"
              class="offer-details-side__side-details-info"
              data-testid="offer-on-chain-row"
              :data-row-key="item.key"
            >
              <span class="offer-details-side__side-details-label is--h6__title">
                {{ item.title }}
              </span>
              <a
                v-if="item.href"
                :href="item.href"
                target="_blank"
                rel="noopener noreferrer"
                class="offer-details-side__details-value offer-details-side__details-link is--body"
                data-testid="offer-on-chain-link"
              >
                {{ item.text }}
              </a>
              <span
                v-else
                class="offer-details-side__details-value is--body"
                data-testid="offer-on-chain-text"
              >
                {{ item.text }}
              </span>
            </div>
          </div>
        </details>
        <Button
          v-if="investmentDocUrl"
          :href="investmentDocUrl"
          as="a"
          target="_blank"
          rel="noopener noreferrer"
          class="offer-details-side__document-button w-full text-secondary"
          variant="outline"
          size="sm"
        >
          <file
            class="offer-details-side__document-icon"
          />
          Investment Agreement
        </Button>
      </div>
      <div class="offer-details-side__side-card-footer">
        <div class="offer-details-side__min-invest">
          <span class="offer-details-side__min-invest-label is--h6__title">
            Min investment:
          </span>
          <span class="offer-details-side__min-invest-value is--h4__title">
            {{ offer?.minInvestmentFormatted }}
          </span>
        </div>
        <OffersDetailsBtn
          v-if="transactional"
          :is-shares-reached="offer?.isSharesReached || false"
          :loading="loading"
          class="offer-details-side__button"
          @invest="$emit('invest')"
        />
      </div>
    </div>
    <Button
      @click="handleContactUsClick"
     class="w-full"
      variant="link"
      size="sm"
    >
      Contact Investor Relation Team
    </Button>
  </div>
</template>

<style lang="scss">
@use '@global-torque/ui-kit/styles/mixins' as *;
.offer-details-side {

  &__progress-wrap {
    margin-bottom: 22px;

    @include media-lte(tablet) {
      margin-top: 12px;
    }
  }

  &__share-wrap {
    display: flex;
    justify-content: end;
    margin-bottom: 46px;
  }

  &__side-card {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: flex-start;
    align-self: stretch;
    border-radius: 2px;
    border: 1px solid var(--border);
    background: var(--background);
    box-shadow: var(
      --ui-shadow-control,
      0 2px 5px 1px color-mix(in srgb, #12161f 3%, transparent),
      0 2px 3px -2px color-mix(in srgb, #12161f 15%, transparent)
    );
    margin-bottom: 20px;
  }

  &__side-details {
    display: flex;
    padding: 20px;
    flex-direction: column;
    align-items: flex-start;
    align-self: stretch;
    border-bottom: 1px solid var(--border);
  }

  &__side-details-info {
    display: flex;
    justify-content: space-between;
    width: 100%;
    align-items: center;

    & + & {
      margin-top: 7px;
    }

    &:last-of-type:not(:last-child) {
      margin-bottom: 22px !important;
    }
  }

  &__side-details-label {
    color: var(--color-text-meta);
  }

  &__nav-notice {
    width: 100%;
    margin-bottom: 18px;
    padding: 12px;
    border-left: 2px solid var(--primary);
    background: var(--accent);
  }

  &__nav-notice-title,
  &__nav-notice-text {
    color: var(--color-text-strong);
  }

  &__nav-notice-text {
    margin: 4px 0 0;
  }

  &__on-chain {
    width: 100%;
    margin-top: 18px;
    padding-top: 18px;
    border-top: 1px solid var(--border);
  }

  &__on-chain-title {
    color: var(--color-text-strong);
    cursor: pointer;
  }

  &__on-chain-content {
    margin-top: 12px;
  }

  &__details-value {
    color: var(--color-text-strong);
    width: fit-content;
    display: flex;
    text-align: end;
    gap: 6px;
    justify-content: end;
    align-items: center;

    &.is--tooltip {
      cursor: help;
    }
  }

  &__on-chain &__details-value {
    max-width: 58%;
    overflow-wrap: anywhere;
  }

  &__details-link {
    color: var(--primary);
    text-decoration: underline;
    text-underline-offset: 2px;
  }

  &__info-icon {
    width: 14px;
    height: 14px;
    flex-shrink: 0;
    color: var(--muted-foreground);

    @media screen and (max-width: 768px){
      position: relative;
      top: 1px;
    }
  }

  &__min-invest-label {
    color: var(--color-text-meta);
    min-width: 141px;
  }

  &__min-invest-value {
    color: var(--primary);
  }

  &__min-invest {
    display: flex;
    flex-direction: column;
  }

  &__side-card-footer {
    padding: 20px;
    display: flex;
    align-items: center;
    gap: 12px;
    align-self: stretch;
    justify-content: space-between;
  }

  &__button {
    width: 100%;
    max-width: 170px;
  }

  &__share-icon {
    width: 16px;
  }

  &__document-icon {
    width: 15px;
  }
}
</style>
