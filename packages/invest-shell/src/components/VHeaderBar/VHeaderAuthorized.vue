<script setup lang="ts">
import VHeader from './VHeaderBar.vue';
import type { VHeaderVariantProps } from './types';

const props = withDefaults(defineProps<VHeaderVariantProps>(), {
  showNavigation: true,
  logoHref: '/',
  menu: undefined,
  isMobilePWA: false,
  showProfileLink: true,
  urlProfile: undefined,
  userLoggedIn: false,
  showMobileSidebar: true,
});

const emit = defineEmits<{
  click: [];
}>();

const isMobileSidebarOpen = defineModel<boolean>();
</script>

<template>
  <VHeader
    v-bind="props"
    v-model="isMobileSidebarOpen"
    variant="authorized"
    @click="emit('click')"
  >
    <template
      v-if="$slots.leading"
      #leading
    >
      <slot name="leading" />
    </template>

    <template
      v-if="$slots.logo"
      #logo
    >
      <slot name="logo" />
    </template>

    <slot />

    <template
      v-if="$slots.pwa"
      #pwa
    >
      <slot name="pwa" />
    </template>

    <template
      v-if="$slots.mobile"
      #mobile
    >
      <slot name="mobile" />
    </template>
  </VHeader>
</template>
