<script setup lang="ts">
import { VImage } from '@global-torque/ui-kit/image';
import { Button } from '@global-torque/ui-primitives/button';
import { Badge } from '@global-torque/ui-primitives/badge';
import { computed } from 'vue';
import VInfoSlot from '../info/VInfoSlot.vue';
import { Skeleton } from '@global-torque/ui-primitives/skeleton';
import { Card, CardContent } from '@global-torque/ui-primitives/card';
import type { VOfferCardData } from '@global-torque/domain-types/offerCardTypes';
import { badgeToneClass } from '@global-torque/ui-kit/badge-tone';

interface InfoItem {
  label: string;
  value: string | undefined;
  show: boolean;
}

const LOADING_INFO_ITEMS: InfoItem[] = Array.from({ length: 4 }, () => ({
  label: '',
  value: undefined,
  show: true,
}));

const props = withDefaults(defineProps<{
  offer?: VOfferCardData;
  funded?: boolean;
  href?: string;
  imageLoading?: 'lazy' | 'eager';
}>(), {
  imageLoading: 'lazy',
});

const offerImageSrc = computed(() => props.offer?.imageSrc ?? props.offer?.imageMedium);
const offerImageSrcset = computed(() => props.offer?.imageSrcset);
const offerImageSizes = computed(() => props.offer?.imageSizes);
const hasOfferImage = computed(() => Boolean(offerImageSrc.value));
const offerImageFetchpriority = computed(() => (
  props.imageLoading === 'eager' ? 'high' : 'auto'
));
const isLoading = computed(() => !props.offer);
// const infoTags = computed(() => ([
//   'Fintech',
//   'E-Commerce',
//   'Network Security',
// ]));

// Generate information items dynamically
const infoItems = computed((): InfoItem[] => {
  if (isLoading.value) return LOADING_INFO_ITEMS;

  const items: InfoItem[] = [
    {
      label: 'Min investment:',
      value: props.offer?.minInvestmentFormatted,
      show: true,
    },
    {
      label: 'Share Price:',
      value: props.offer?.pricePerShareFormatted,
      show: !!(props.offer?.isOpenEnded && props.offer?.pricePerShareFormatted),
    },
    {
      label: 'Funding Goal:',
      value: props.offer?.targetRaiseFormatted,
      show: !!(!props.offer?.isOpenEnded && props.offer?.targetRaiseFormatted
        && (props.offer?.isSecurityTypeDebt || props.offer?.isSecurityTypeConvertibleDebt
          || props.offer?.isSecurityTypeConvertibleNote)),
    },
    {
      label: 'Target Raise:',
      value: props.offer?.targetRaiseFormatted,
      show: !!(!props.offer?.isOpenEnded && props.offer?.targetRaiseFormatted
        && (props.offer?.isSecurityTypeEquity || props.offer?.isSecurityTypePreferredEquity)),
    },
    {
      label: 'Security Type:',
      value: props.offer?.securityTypeFormatted,
      show: true,
    },
    {
      label: 'Interest Rate:',
      value: props.offer?.interestRateFormatted,
      show: !!(props.offer?.interestRateFormatted
        && (props.offer?.isSecurityTypeDebt || props.offer?.isSecurityTypeConvertibleDebt
          || props.offer?.isSecurityTypeConvertibleNote)),
    },
    {
      label: 'Dividend Rate:',
      value: props.offer?.dividendRateFormatted,
      show: !!(props.offer?.dividendRateFormatted),
    },
    {
      label: 'Voting Rights:',
      value: props.offer?.votingRightsFormatted,
      show: !!(props.offer?.votingRightsFormatted
        && (props.offer?.isSecurityTypeEquity || props.offer?.isSecurityTypePreferredEquity)),
    },
  ];

  return items.filter(item => item.show);
});

// Group items into chunks of 2 for display
const infoItemGroups = computed(() => {
  const groups: InfoItem[][] = [];
  for (let i = 0; i < infoItems.value.length; i += 2) {
    groups.push(infoItems.value.slice(i, i + 2));
  }
  return groups;
});
</script>

<template>
  <Card
    v-bind="$attrs"
    :aria-label="offer?.name"
    class="VOfferCard v-offer-card with-default-distance gap-0 py-0"
  >
    <Badge
      v-if="offer?.showTag"
      :class="offer?.tagBackground"
      class="v-offer-card__tag"
      variant="outline"
    >
      {{ offer?.tagText }}
    </Badge>
    <div
      v-if="hasOfferImage"
      class="v-offer-card__img-wrap"
    >
      <div
        class="v-offer-card__image-frame v-offer-card__img is--margin-top-0"
        :class="{ 'is--default-image': offer?.isDefaultImage }"
      >
        <div class="v-offer-card__image-client">
          <VImage
            :src="offerImageSrc"
            :srcset="offerImageSrcset || undefined"
            :sizes="offerImageSizes || undefined"
            :alt="offer?.slug || 'offer image'"
            itemprop="image"
            :loading="imageLoading"
            :fetchpriority="offerImageFetchpriority"
            class="v-offer-card__img is--margin-top-0"
            :class="{ 'is--default-image': offer?.isDefaultImage }"
          />
        </div>
      </div>
    </div>
    <Skeleton
      v-else
      class="v-offer-card__img is--img-skeleton"
      :style="{ width: '100%', height: 'auto' }"
    />
    <CardContent class="v-offer-card__inner">
      <h2
        v-if="offer?.name"
        class="v-offer-card__title is--h3__title"
        data-testid="offer-title"
        itemprop="name"
      >
        {{ offer?.name }}
      </h2>
      <Skeleton
        v-else
        class="v-offer-card__title is--h3__title"
        :style="{ width: '100%', height: '72px' }"
      />
      <div class="v-offer-card__inner-bottom">
        <div class="v-offer-card__content">
          <div
            v-if="funded"
            class="v-offer-card__funded is--small-2"
          >
            Funded
          </div>
          <div
            v-if="offer?.seo_description"
            itemprop="description"
            class="v-offer-card__description is--small"
          >
            {{ offer?.seo_description }}
          </div>
          <template v-if="!funded">
            <VInfoSlot
              v-for="(group, groupIndex) in infoItemGroups"
              :key="groupIndex"
              size="small"
              class="v-offer-card__info"
            >
              <div class="v-offer-card__info-wrap">
                <div
                  v-for="(item, itemIndex) in group"
                  :key="itemIndex"
                  class="v-offer-card__details is--small-2"
                >
                  <span v-if="item.label">
                    {{ item.label }}
                  </span>
                  <Skeleton
                    v-else
                    :style="{ width: '50px', height: '17px' }"
                  />
                  <span
                    v-if="offer"
                    class="v-offer-card__details-number is--h6__title"
                  >
                    {{ item.value }}
                  </span>
                  <Skeleton
                    v-else
                    class="v-offer-card__details-number is--h6__title"
                    :style="{ width: '50px', height: '21px' }"
                  />
                </div>
              </div>
            </VInfoSlot>
          </template>
          <!-- <div
            v-if="props.offer"
            class="v-offer-card__tag-info-wrap"
          >
            <Badge
              v-for="(tagInfo, indexInfo) in infoTags"
              :key="indexInfo"
              round
              background="var(--ui-color-border-muted, var(--input))"
              itemprop="keywords"
              class="v-offer-card__tag-info"
              variant="outline"
              :class="badgeToneClass('default')"
            >
              {{ tagInfo }}
            </Badge>
          </div>
          <Skeleton
            v-else
            class="v-offer-card__tag-info-wrap"
            :style="{ width: '100%', height: '18px' }"
          /> -->
        </div>
        <Button
          v-if="!funded"
          class="v-offer-card__btn w-full bg-accent text-accent-foreground hover:bg-accent/80"
          variant="ghost"
        >
          {{ offer?.actionLabel || 'Invest Now' }}
        </Button>
      </div>
    </CardContent>
    <a
      v-if="href"
      :href="encodeURI(href)"
      class="v-offer-card__link"
      aria-label="card link"
    />
  </Card>
</template>

<style lang="scss">
.v-offer-card {
  position: relative;
  border-width: var(--ui-offer-card-border-width, 1px);

  &__link {
    position: absolute;
    inset: 0;
    z-index: 10;
  }

  display: flex;
  flex-direction: column;
  background: var(--ui-color-surface, var(--background));
  box-shadow: var(--ui-shadow-dialog, var(--shadow-dialog));
  transition: all .3s ease;
  width: 100%;
  cursor: pointer;
  text-decoration: none;

  &[data-slot='card'] {
    border-radius: var(--ui-offer-card-radius, 2px);
  }

  &:hover {
    box-shadow: var(--ui-shadow-raised, var(--shadow-raised));
  }

  &__img-wrap {
    width: 100%;
    aspect-ratio: 16 / 9;
    background-color: var(--accent);
    display: flex;
    justify-content: center;
    align-items: center;
  }

  &__image-frame {
    display: var(--ui-offer-image-frame-display, contents);
    overflow: var(--ui-offer-image-overflow, visible);
    align-items: center;
    justify-content: center;
  }

  &__image-client {
    display: var(--ui-offer-image-frame-display, contents);
    position: var(--ui-offer-image-position, static);
    width: 100%;
    height: 100%;
    min-height: inherit;
    align-items: center;
    justify-content: center;
  }

  &__img {
    height: auto;
    width: 100%;
    max-width: 100%;
    object-fit: cover;
    aspect-ratio: 16 / 9;

    &.is--default-image {
      max-width: 120px;
      max-height: 120px;
    }
  }

  &__inner {
    display: flex;
    padding: 40px;
    flex-direction: column;
    border-radius: 2px;
    color: var(--foreground);
    height: 100%;
    justify-content: space-between;
  }

  &__title {
    text-transform: capitalize;
  }

  &__funded {
    color: var(--ui-color-positive, var(--color-positive-strong));
    margin-bottom: 8px;
  }

  &__details {
    color: var(--ui-color-text-muted, var(--muted-foreground));
    width: 50%;
    display: flex;
    flex-direction: column;
  }

  &__details-number {
    color: var(--ui-color-text-secondary, var(--foreground));
    margin-top: 0 !important;
  }

  &__inner-bottom {
    display: flex;
    flex-direction: column;
  }

  &__description {
    margin-bottom: 16px;
    color: var(--ui-color-text-secondary, var(--foreground));
    max-height: 36px;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    display: -webkit-box;
  }

  &__btn {
    margin-top: 28px !important;
  }

  &__tag {
    color: var(--ui-badge-foreground, revert-layer);
    position: absolute;
    top: 12px;
    left: 12px;
  }

  &__info {
    &:first-of-type {
      border-top: 1px solid var(--ui-color-border-subtle, var(--border));
    }
  }

  &__info-wrap {
    margin: 0 -12px;
    display: flex;
    width: calc(100% + 24px);
  }

  &__tag-info-wrap {
    margin-top: 20px;
    display: flex;
    width: 100%;
    gap: 8px;
  }
}
</style>
