<script setup lang="ts">
import { computed } from 'vue';

type LogoVariant = 'black' | 'white';

const props = withDefaults(defineProps<{
  disabled?: boolean;
  href?: string;
  brandName?: string;
  routeName?: string;
  showDesktop?: boolean;
  variant?: LogoVariant;
}>(), {
  showDesktop: true,
  brandName: 'Site',
  variant: 'black',
});

const componentName = computed(() => {
  if (props.href) return 'a';
  if (props.routeName) return 'router-link';
  return 'span';
});

const desktopLogo = computed(() => (
  props.variant === 'white' ? 'var(--ui-brand-logo-reversed)' : 'var(--ui-brand-logo)'
));

const mobileLogo = computed(() => (
  props.variant === 'white' ? 'var(--ui-brand-mark-reversed, var(--ui-brand-mark))' : 'var(--ui-brand-mark)'
));
</script>

<template>
  <component
    :is="componentName"
    class="VLogo v-logo"
    :href="href"
    :to="{ name: routeName }"
    :aria-label="`${brandName} logo`"
    :class="{ 'is--link': href || routeName }"
  >
    <span
      class="v-logo__desktop"
      :class="{ 'is--show-desktop': showDesktop }"
    >
      <span
        class="v-logo__full"
        :style="{ backgroundImage: desktopLogo }"
        aria-hidden="true"
      />
    </span>
    <span
      class="v-logo__mobile"
      :class="{ 'is--show-desktop': showDesktop }"
      :style="{ backgroundImage: mobileLogo }"
      aria-hidden="true"
    />
  </component>
</template>

<style lang="scss">
.v-logo {
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
  max-width: 100%;
  color: inherit;
  text-decoration: none;

  &.is--link {
    cursor: pointer;
  }

  &__desktop {
    display: inline-flex;
    align-items: center;
    max-width: 100%;
    height: 36px;

    &:not(.is--show-desktop) {
      @media screen and (width <= 1024px) {
        display: none;
      }
    }
  }

  &__full {
    width: auto;
    max-width: 100%;
    height: 36px;
    min-width: 120px;
    flex-shrink: 0;
    display: block;
    background-position: center;
    background-repeat: no-repeat;
    background-size: contain;
  }

  &__mobile {
    display: block;
    width: 36px;
    height: 36px;
    background-position: center;
    background-repeat: no-repeat;
    background-size: contain;

    &.is--show-desktop {
      display: none;
    }

    @media screen and (width > 1024px) {
      display: none;
    }
  }
}
</style>
