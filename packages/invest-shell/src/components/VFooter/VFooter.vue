<script setup lang="ts">
// @ts-nocheck
import {
  computed, defineAsyncComponent, hydrateOnVisible, PropType, ref,
} from 'vue';
import { toast } from '@global-torque/ui-primitives/sonner';
import VFormFooterSkeleton from './VFormFooterSkeleton.vue';
import { useInvestApplicationContext } from '@global-torque/invest-runtime/application-context';
import type { InvestStaticContactConfig } from '@global-torque/invest-core/app/config';
import { resolveSocialList } from '@global-torque/invest-widgets/socials';
import type { SocialLink } from '@global-torque/invest-widgets/socials';

const SocialLinks = defineAsyncComponent({
  loader: () => import('@global-torque/invest-widgets/socials').then(mod => mod.VSocialLinks),
  hydrate: hydrateOnVisible(),
});

const VFooterText = defineAsyncComponent({
  loader: () => import('./VFooterText.vue'),
  hydrate: hydrateOnVisible(),
});

const VFooterMenu = defineAsyncComponent({
  loader: () => import('./VFooterMenu.vue'),
});

const VFormFooterSubscribe = defineAsyncComponent({
  loader: () => import('./VFormFooterSubscribe.vue'),
  loadingComponent: VFormFooterSkeleton,
  hydrate: hydrateOnVisible(),
});

const VFooterBottom = defineAsyncComponent({
  loader: () => import('./VFooterBottom.vue'),
  hydrate: hydrateOnVisible(),
});

type MenuItem = {
  to?: string;
  link?: string;
  active?: boolean;
  text: string;
  children?: MenuItem[];
}

type NewsletterSubmitter = (email: string) => Promise<void> | void;

const props = defineProps({
  socialList: {
    type: Array as PropType<SocialLink[]>,
    required: true,
  },
  contact: {
    type: Object as PropType<InvestStaticContactConfig>,
    required: true,
  },
  submitForm: {
    type: Function as PropType<NewsletterSubmitter>,
    required: true,
  },
  menu: Array as PropType<MenuItem[]>,
  path: String,
  legalItems: Array,
  isColumnMenu: {
    type: Boolean,
    default: false,
  },
});

const resolvedSocialList = computed(() => resolveSocialList(props.socialList));

const brand = useInvestApplicationContext().appConfig.brand;

const loadingSubmitting = ref(false);
const onSubmit = async (email: string) => {
  if (loadingSubmitting.value) return;

  loadingSubmitting.value = true;
  try {
    await props.submitForm(email);
    toast.success('Subscribed', { description: 'You will receive our latest news by email.' });
  } catch {
    toast.error('Not subscribed', { description: 'Please try again.' });
  } finally {
    loadingSubmitting.value = false;
  }
};

const contactList = computed(() => ([props.contact]));
</script>

<template>
  <!-- eslint-disable vue/no-multiple-template-root -->
  <div class="VFooter v-footer is--no-margin">
    <div class="is--container">
      <div class="v-footer__wrap">
        <div class="v-footer__form-wrap">
          <VFormFooterSubscribe
            label="Receive latest news:"
            :loading="loadingSubmitting"
            class="v-footer__form"
            @submit="onSubmit"
          />

          <div class="social-links desktop-social">
            <SocialLinks
              :social-list="resolvedSocialList"
              class="wd-layout-default-footer__socials"
            />
          </div>
        </div>

        <div
          v-for="(item, index) in contactList"
          :key="index"
          class="v-footer__contact"
        >
          <div class="is--h5__title">
            {{ item.address1 }}
          </div>
          <div>
            {{ item.address2 }}
          </div>
          <div>
            {{ item.phone }}
          </div>
          <div>
            {{ item.email }}
          </div>
        </div>
        <VFooterMenu
          :menu="menu"
          :is-column="isColumnMenu"
          class="v-footer__menu"
        />
      </div>
    </div>
  </div>
  <VFooterText
    class="v-footer__text"
    :brand-name="brand.title"
  />
  <VFooterBottom
    :items="legalItems"
    :copyright-name="brand.title"
  />
</template>

<style lang="scss">
@use '@global-torque/ui-kit/styles/mixins' as *;

.v-footer {
  $root: &;

  background-color: var(--ui-color-surface-inverse, #12161f);
  padding: 48px 0;
  color: var(--ui-color-text-inverse, #fff);

  @include media-lte(desktop-lg) {
    padding-bottom: 5px;
    padding-top: 50px;
  }

  @include media-lte(tablet) {
    padding-bottom: 5px;
    padding-top: 50px;
  }

  .v-form-group {
    width: 100%;
  }

  &__wrap {
    display: flex;
    gap: 80px;
    justify-content: space-between;

    @include media-lte(desktop-lg) {
      gap: 40px;
    }

    @include media-lte(desktop) {
      max-width: 100%;
      gap: 40px;
      margin: 0 auto;
      flex-wrap: wrap;
    }

    @include media-lte(tablet) {
      max-width: 100%;
      gap: 40px;
      margin: 0 auto;
      flex-wrap: wrap;
    }
  }

  &__group {
    width: 100%;
  }

  &__form-wrap {
    width: 48%;

    @include media-lte(tablet) {
      width: 100%;
    }
  }

  &__form {
    margin-bottom: 32px;
  }

  &__title {
    margin-bottom: 8px;
  }

  &__contact {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 30px;

    a {
      display: block;
      color: var(--ui-color-text-inverse, #fff);

      &:hover {
        text-decoration: underline;
      }
    }

    @include media-lte(tablet) {
      margin-bottom: 0;
    }
  }

  &__menu {
    @include media-lte(desktop) {
      width: 100%;
    }
  }

  &__text {
    @include media-lte(tablet) {
      padding-top: 40px;
    }
  }
}

.footer-bottom {
  background-color: var(--ui-color-surface-inverse, #12161f);
  padding: 10px 0 16px;

  @include media-lte(tablet) {
    padding-top: 51px;
  }

  p {
    color: var(--ui-color-text-inverse, #fff);
  }
}

.social-links {
  display: flex;
  align-items: center;

  a {
    margin-right: 24px;

    &:last-child {
      margin-right: 0;
    }

    &:hover {
      opacity: .8;
    }

    @include media-lte(tablet) {
      margin-right: 32px;
    }
  }
}
</style>
