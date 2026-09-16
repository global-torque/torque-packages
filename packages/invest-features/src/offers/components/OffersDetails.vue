<script setup lang="ts">
import { IOfferFormatted } from '@global-torque/domain-types/offerTypes';
import { PropType, computed, defineAsyncComponent, hydrateOnVisible } from 'vue';
import type {
  SocialIconMap,
  SocialLink,
  SocialLinkDestination,
  SocialNetworkName,
} from '@global-torque/invest-widgets/socials';
import { Skeleton } from '@global-torque/ui-primitives/skeleton';
import OfferDetailsSide from './OffersDetailsSide.vue';
import OffersDetailsContent from './OffersDetailsContent.vue';
import { useOffersDetails } from './logic/useOffersDetails.ts';
import OfferMediaGallery from './OfferMediaGallery.vue';
import { useGlobalLoader } from '@global-torque/invest-runtime/loader';
import { badgeToneClass } from '@global-torque/ui-kit/badge-tone';

const VBreadcrumbs = defineAsyncComponent({
  loader: () => import('@global-torque/invest-widgets/navigation').then(mod => mod.VBreadcrumbs),
  hydrate: hydrateOnVisible(),
});

const VSocialLinks = defineAsyncComponent({
  loader: () => import('@global-torque/invest-widgets/socials').then(mod => mod.VSocialLinks),
});

const props = defineProps({
  offer: {
    type: Object as PropType<IOfferFormatted> | undefined,
  },
  loading: {
    type: Boolean,
    default: true,
  },
  transactional: {
    type: Boolean,
    default: false,
  },
  socialIcons: {
    type: Object as PropType<SocialIconMap>,
    required: true,
  },
});
const emit = defineEmits(['invest']);

const offerRef = computed(() => props.offer);
const {
  breadcrumbsList,
  carouselFiles,
  frontmatter,
  socialLinks: socialLinkDestinations,
  mediaReady,
} = useOffersDetails(offerRef);
const socialLinks = computed<SocialLink[]>(() => socialLinkDestinations.value.flatMap((link: SocialLinkDestination) => {
  const networkName = link.iconName as SocialNetworkName;
  const icon = props.socialIcons?.[networkName];
  return icon ? [{ ...link, icon }] : [];
}));

useGlobalLoader().hide();
</script>

<template>
  <div class="OffersDetails offer-details is--no-margin">
    <div class="offer-details__wrap">
      <div class="offer-details__main is--left">
        <Skeleton
          v-if="loading"
          class="offer-details__title"
          :style="{ width: '100px', height: '75px' }"
        />
        <h1
          v-else
          class="offer-details__title"
          itemprop="name"
        >
          {{ offer?.name }}
        </h1>
        <div class="offer-details__img-wrap">
          <OfferMediaGallery
            :key="offer?.id ?? 'loading'"
            :name="offer?.name"
            :files="carouselFiles"
            :ready="!loading && mediaReady"
          />
        </div>
        <Skeleton
          v-if="!(offer?.website || offer?.city || offer?.state || socialLinks.length > 0)"
          class="offer-details__additional-info-wrap"
          :style="{ width: '100%', height: '45px' }"
        />
        <div
          v-else
          class="offer-details__additional-info-wrap"
        >
          <div
            v-if="offer?.website || offer?.city || offer?.state"
            class="offer-details__additional-info"
          >
            <div
              v-if="offer?.city || offer?.state"
              class="offer-details__city is--small"
            >
              {{ offer?.city ? `${offer.city},` : '' }} {{ offer?.state }}
            </div>
            <a
              v-if="offer?.website"
              :href="offer?.website"
              class="offer-details__website is--link-2"
              target="_blank"
              rel="noopener noreferrer"
            >
              {{ offer?.website?.replace('https://', '')?.replace('/', '') }}
            </a>
          </div>
          <!-- <ul class="offer-details__tags-wrap">
            <Badge
              v-for="(tag, index) in tags"
              :key="index"
              as="li"
              itemprop="keywords"
              variant="outline"
              :class="badgeToneClass('default')"
            >
              {{ tag }}
            </Badge>
          </ul> -->
          <VSocialLinks
            v-if="socialLinks.length > 0"
            :social-list="socialLinks"
            class="offer-details__social-links"
          />
        </div>
        <OfferDetailsSide
          :loading="loading"
          :offer="offer"
          :transactional="transactional"
          class="is--lt-desktop-show is--margin-top-40"
          @invest="emit('invest')"
        />
        <OffersDetailsContent
          v-if="offer"
          :offer="offer"
          :loading="loading"
          :transactional="transactional"
          class="offer-details__content"
        />
      </div>
      <div class="offer-details__side is--right is--gt-desktop-show">
        <OfferDetailsSide
          :loading="loading"
          :offer="offer"
          :transactional="transactional"
          class="offer-details__side-scroll is--sticky"
          @invest="emit('invest')"
        />
      </div>
    </div>
    <VBreadcrumbs
      v-if="breadcrumbsList"
      :data="breadcrumbsList"
      :slug="frontmatter.slug"
      class="offer-details__breadcrumbs is--margin-top-80"
    />
  </div>
</template>

<style lang="scss">
.offer-details {
  min-height: 100vh;

  &__wrap {
    display: flex;
    gap: 30px;

    @media screen and (max-width: 980px){
      flex-direction: column-reverse;
    }
  }

  &__additional-info-wrap {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 12px;
    border-bottom: 1px solid var(--border);

    @media screen and (max-width: 980px){
      flex-direction: column;
    }
  }

  &__additional-info {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  &__tags-wrap {
    display: flex;
    align-items: center;
    gap: 12px;
    padding-left: 0;
  }

  .is--left {
    width: 66%;

    @media screen and (max-width: 980px){
      width: 100%;
    }
  }

  .is--right {
    width: 32%;

    @media screen and (max-width: 980px){
      width: 100%;
    }
  }

  &__img-wrap {
    height: 491px;
    background-color: var(--accent);
    display: flex;
    justify-content: center;
    align-items: center;
    overflow: hidden;
    margin-top: 0;

    @media screen and (max-width: 980px){
      height: 350px;
    }
  }

  &__img {
    width: 100%;
    height: 100%;
    max-width: 100%;
    object-fit: cover;

    &.is--default-image {
      max-width: 120px;
      max-height: 120px !important;
    }
  }

  &__city {
    color: var(--color-text-strong);
    flex-shrink: 0;
  }

  & &__social-links {
      color: var(--color-text-meta);
      gap: 10px;
      width: auto;

      &__item {
        &:hover {
          color: var(--primary);
        }
      }

      svg {
        width: 20px;
        height: 20px;
      }

      a {
        margin-right: 0;
      }
  }

  &__breadcrumbs {
    margin-top: 90px;
  }

  &__title {
    margin-bottom: 12px;
  }

  &__side {
    position: relative;
  }

  .offer-details-side {
    @media screen and (width < 768px) {
      margin-top: 24px !important;
    }
  }
}
</style>
