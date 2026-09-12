<script setup lang="ts">
import { VImage } from '@global-torque/ui-kit/image';

withDefaults(defineProps<{
  src?: string; srcset?: string; sizes?: string; alt: string; eager?: boolean;
}>(), { eager: false });
</script>

<template>
  <VImage
    class="offer-media-image"
    data-testid="offer-media-image"
    :src="src"
    :srcset="srcset"
    :sizes="sizes"
    :alt="alt"
    :loading="eager ? 'eager' : 'lazy'"
    fit="cover"
  />
</template>

<style scoped>
.offer-media-image { width: 100%; height: 100%; }
.offer-media-image[data-fallback='true'] { display: flex; align-items: center; justify-content: center; }
.offer-media-image[data-fallback='true'] :deep(img) { width: 120px; height: 120px; max-width: 100%; max-height: 100%; }
</style>
