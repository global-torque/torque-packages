<script setup lang="ts">
import { nextTick, ref, toRef, watch } from 'vue';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@global-torque/ui-primitives/carousel';
import { Skeleton } from '@global-torque/ui-primitives/skeleton';
import OfferMediaImage from './OfferMediaImage.vue';
import OfferMediaVideo from './OfferMediaVideo.vue';
import type { OfferMedia } from './logic/offerMedia';
import { useOfferMediaGallery } from './logic/useOfferMediaGallery';

const props = withDefaults(defineProps<{ files: readonly OfferMedia[]; name?: string; ready: boolean }>(), { name: 'Offer' });
const { selectedKey, selected, selectionReady, initialAutoplay, keys, select, setApi } = useOfferMediaGallery(toRef(props, 'files'), toRef(props, 'ready'));
const thumbnails = ref<HTMLElement>();
watch(selected, async () => {
  await nextTick();
  // Scroll only the thumbnail strip, never the page containing the offer.
  const strip = thumbnails.value;
  const button = strip?.children[selected.value] as HTMLElement | undefined;
  if (!strip || !button) return;
  if (button.offsetLeft < strip.scrollLeft) strip.scrollLeft = button.offsetLeft;
  else if (button.offsetLeft + button.offsetWidth > strip.scrollLeft + strip.clientWidth) {
    strip.scrollLeft = button.offsetLeft + button.offsetWidth - strip.clientWidth;
  }
});
</script>

<template>
  <section
    data-testid="offer-media-gallery"
    class="offer-media-gallery"
    :class="{ 'offer-media-gallery--multiple': files.length > 1 }"
    :data-selected-index="selected"
    :aria-label="`${name} media gallery`"
  >
    <Carousel
      data-testid="offer-media-main"
      class="offer-media-gallery__main"
      :inert="!selectionReady ? '' : undefined"
      :opts="{ align: 'start', watchSlides: false }"
      :aria-label="`${name} media`"
      @init-api="setApi"
    >
      <CarouselContent class="offer-media-gallery__track">
        <CarouselItem
          v-for="(file, index) in files"
          :key="keys[index]"
          data-testid="offer-media-slide"
          class="offer-media-gallery__slide"
          :data-media-index="index"
          :aria-label="`${index + 1} of ${files.length}`"
          :aria-hidden="index !== selected"
          :inert="index !== selected ? '' : undefined"
        >
          <OfferMediaVideo
            v-if="file.video"
            :source="file.video"
            :name="name"
            :active="selectionReady && index === selected && keys[index] === selectedKey"
            :autoplay="initialAutoplay && index === 0"
          />
          <OfferMediaImage
            v-else
            :src="file.image"
            :srcset="file.srcset"
            :sizes="file.sizes"
            :alt="`${name} image ${index + 1}`"
            :eager="index === 0 || index === selected"
          />
        </CarouselItem>
        <CarouselItem
          v-if="!files.length"
          class="offer-media-gallery__slide"
        >
          <Skeleton
            v-if="!ready"
            class="offer-media-gallery__empty-loading"
            aria-label="Loading media"
          />
          <OfferMediaImage
            v-else
            :alt="`${name} image unavailable`"
            eager
          />
        </CarouselItem>
      </CarouselContent>
      <template v-if="files.length > 1">
        <CarouselPrevious
          class="offer-media-gallery__previous"
          aria-label="Previous media"
        />
        <CarouselNext
          class="offer-media-gallery__next"
          aria-label="Next media"
        />
      </template>
    </Carousel>
    <div
      v-if="files.length > 1"
      ref="thumbnails"
      class="offer-media-gallery__thumbnails"
      aria-label="Choose media"
    >
      <button
        v-for="(file, index) in files"
        :key="keys[index]"
        type="button"
        class="offer-media-gallery__thumbnail"
        :disabled="!selectionReady"
        :aria-label="`Show ${file.video ? 'video' : 'image'} ${index + 1}`"
        :aria-current="index === selected ? 'true' : undefined"
        @click="select(index)"
      >
        <OfferMediaVideo
          v-if="file.video"
          :source="file.video"
          :name="name"
          thumbnail
        />
        <OfferMediaImage
          v-else
          :src="file.thumb || file.image"
          :srcset="file.thumbSrcset"
          :sizes="file.thumbSizes"
          :alt="''"
        />
      </button>
    </div>
  </section>
</template>

<style scoped>
.offer-media-gallery { width: 100%; height: 491px; min-width: 0; overflow: hidden; background: var(--accent); }
.offer-media-gallery__main { position: relative; width: 100%; height: 100%; overflow: hidden; }
.offer-media-gallery--multiple .offer-media-gallery__main { height: 80%; }
.offer-media-gallery__main :deep([data-slot='carousel-content']) { width: 100%; height: 100%; overflow: hidden; }
.offer-media-gallery__main :deep(.offer-media-gallery__track) { display: flex; width: 100%; height: 100%; margin: 0; touch-action: pan-y pinch-zoom; }
.offer-media-gallery__slide { flex: 0 0 100%; width: 100%; min-width: 0; height: 100%; padding: 0; overflow: hidden; }
.offer-media-gallery__empty-loading { width: 100%; height: 100%; }
.offer-media-gallery__previous { left: 12px; }
.offer-media-gallery__next { right: 12px; }
.offer-media-gallery__thumbnails { position: relative; display: flex; align-items: stretch; height: 20%; gap: 8px; padding: 8px 4px 4px; overflow-x: auto; box-sizing: border-box; }
.offer-media-gallery__thumbnail { flex: 0 0 120px; min-width: 0; height: 100%; padding: 2px; border: 2px solid transparent; border-radius: 4px; cursor: pointer; overflow: hidden; }
.offer-media-gallery__thumbnail[aria-current='true'] { border-color: var(--primary); }
.offer-media-gallery__thumbnail:focus-visible { outline: 2px solid var(--ring); outline-offset: -2px; }
@media (max-width: 980px) { .offer-media-gallery { height: 350px; } .offer-media-gallery__thumbnail { flex-basis: 90px; } }
</style>
