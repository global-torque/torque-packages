<script setup lang="ts">
import { PropType } from 'vue';

const currentYear = new Date().getFullYear();

export interface IFooterBottom {
  href?: string,
  text: string,
}

defineProps({
  items: Array as PropType<IFooterBottom[]>,
  copyrightName: {
    type: String,
    required: true,
  },
});
</script>

<template>
  <div class="VFooterBottom v-footer-bottom">
    <p class="is--container is--small v-footer-bottom__container">
      <template
        v-for="(item, index) in items"
        :key="index"
      >
        <a :href="item.href">{{ item.text }}</a>
        <span>
          |
        </span>
      </template>
      © {{ currentYear }} {{ copyrightName }}.
    </p>
  </div>
</template>

<style lang="scss">
@use '@global-torque/ui-kit/styles/mixins' as *;

.v-footer-bottom {
    background-color: var(--ui-color-surface-inverse, var(--foreground));
    padding: 16px 0;

    @include media-lte(tablet) {
      padding-top: 51px;
    }

    p {
      // Preserve the 0.2.1 inverse-footer fallback; --ui-* remains the host
      // override for applications that provide an explicit semantic role.
      color: var(--ui-color-text-disabled, var(--foreground));
    }

    a {
      color: var(--ui-color-accent-inverse, var(--ui-color-accent, var(--primary)));
    }

    &__container {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 12px;
    }
}
</style>
