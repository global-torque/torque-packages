<script setup lang="ts">
import VSlider from './VSlider.vue';
import VCardOffer from './VCardOffer.vue';
import { PropType } from 'vue';
import type { VOfferCardData } from '@webdevelop-pro/domain-types/offerCardTypes';
import { CarouselItem } from '@global-torque/ui-primitives/carousel';

defineProps({
  items: Array as PropType<VOfferCardData[]>,
});
</script>

<template>
  <VSlider
    class="VSliderCardOffer v-slider-offer"
  >
    <CarouselItem
      v-for="(offer, index) in items"
      :key="index"
      class="v-slider-offer__item"
    >
      <VCardOffer
        :offer="offer"
        funded
        :image-loading="(index < 7) ? 'eager' : 'lazy'"
      />
    </CarouselItem>
  </VSlider>
</template>

<style lang="scss">

.v-slider-offer {
  margin: 0 -15px;
  width: calc(100% + 30px);

    &__item {
      padding: 15px;
      flex: 0 0 33.33%;

      @media screen and (max-width: 1199px){
        flex: 0 0 36%;
      }

      @media screen and (max-width: 1024px){
        flex: 0 0 46%;
      }

      @media screen and (max-width: 768px){
        flex: 0 0 76%;
      }
    }
}
</style>
