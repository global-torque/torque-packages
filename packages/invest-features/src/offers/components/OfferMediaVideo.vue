<script setup lang="ts">
import { computed, toRef } from 'vue';
import { Play } from '@lucide/vue';
import OfferMediaImage from './OfferMediaImage.vue';
import { useOfferMediaVideo } from './logic/useOfferMediaVideo';

const props = withDefaults(defineProps<{
  source: string;
  name: string;
  active?: boolean;
  autoplay?: boolean;
  thumbnail?: boolean;
}>(), { active: false, autoplay: false, thumbnail: false });
const { video, poster } = useOfferMediaVideo(toRef(props, 'source'));
const playerSource = computed(() => {
  if (!video.value) return undefined;
  const url = new URL(video.value.embed);
  url.searchParams.set('controls', '1');
  if (props.autoplay) {
    url.searchParams.set('autoplay', '1');
    url.searchParams.set(video.value.provider === 'youtube' ? 'mute' : 'muted', '1');
  }
  return url.href;
});
</script>

<template>
  <div class="offer-media-video">
    <iframe
      v-if="active && video && !thumbnail"
      :key="playerSource"
      :src="playerSource"
      :title="`${name} video`"
      allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
      allowfullscreen
      referrerpolicy="strict-origin-when-cross-origin"
    />
    <template v-else>
      <OfferMediaImage
        :src="poster"
        :alt="`${name} video poster`"
      />
      <Play
        v-if="video"
        class="offer-media-video__play"
        aria-hidden="true"
      />
      <span
        v-else-if="!thumbnail"
        class="offer-media-video__unavailable"
      >Video unavailable</span>
    </template>
  </div>
</template>

<style scoped>
.offer-media-video { position: relative; width: 100%; height: 100%; }
.offer-media-video iframe { display: block; width: 100%; height: 100%; border: 0; }
.offer-media-video__play { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 32px; height: 32px; color: var(--primary); }
.offer-media-video__unavailable { position: absolute; bottom: 12px; left: 0; right: 0; text-align: center; }
</style>
