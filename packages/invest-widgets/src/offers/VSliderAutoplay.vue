<script setup lang="ts">
import VSlider from './VSlider.vue';
import { PropType, ref, watch } from 'vue';
import type { CarouselApi } from '@global-torque/ui-primitives/carousel';
import { CarouselItem } from '@global-torque/ui-primitives/carousel';

// yarn add embla-carousel-autoplay
// yarn add embla-carousel-fade

const props = defineProps({
  dataInterface: Object,
  data: Array as PropType<unknown[]>,
  autoplay: {
    type: Boolean,
    default: true,
  },
  activeColor: {
    type: String,
    default: 'var(--ui-color-warning, var(--color-status-warning))',
  },
  showPagination: {
    type: Boolean,
    default: true,
  },
  autoplayChangeTime: {
    type: Number,
    default: 6000,
  },
  fade: {
    type: Boolean,
    default: true,
  },
  options: {
    type: Object,
    default: () => ({}),
  },
  passItemData: {
    type: Boolean,
    default: false,
  },
});

const api = ref<CarouselApi>();
const active = ref(props.data?.[0]);

function setApi(val: CarouselApi) {
  api.value = val;
}
const activeElementId = ref(0);

const setActiveElement = () => {
  if (props.data && props.data[activeElementId.value]) {
    active.value = props.data[activeElementId.value];
  }
};

const changeSlide = (index: number) => {
  api.value?.scrollTo(index);
  api.value?.plugins()?.autoplay.reset();
};

watch(api, (value) => {
  if (!value) return;

  activeElementId.value = value.selectedScrollSnap();

  value.on('select', () => {
    activeElementId.value = value.selectedScrollSnap();
    setActiveElement();
  });
});
</script>

<template>
  <div class="VSliderAutpoplay v-slider-autoplay">
    <VSlider
      variant="autoplay"
      :autoplay="autoplay"
      :fade="fade"
      :autoplay-change-time="autoplayChangeTime"
      :options="{
        align: 'start',
        containScroll: 'trimSnaps',
        ...options,
      }"
      class="v-slider-autoplay__slider"
      @init-api="setApi"
    >
      <CarouselItem
        v-for="(item, index) in data"
        :key="index"
        class="v-slider-autoplay__item"
      >
        <slot :active="passItemData ? item : active" />
      </CarouselItem>
    </VSlider>
    <div
      v-if="showPagination"
      class="v-slider-autoplay__pagination"
    >
      <button
        v-for="(_, indexp) in data"
        :key="indexp"
        :aria-label="'Go to slide ' + (indexp + 1)"
        class="v-slider-autoplay__pagination-item-wrap"
        @click="changeSlide(indexp)"
      >
        <span
          class="v-slider-autoplay__pagination-item"
          :class="{ 'is--active': indexp === activeElementId }"
        />
      </button>
    </div>
  </div>
</template>

<style lang="scss">

.v-slider-autoplay {
  width: 100%;

  &__slider {
    margin: 0;
  }

  &__item {
    flex: 0 0 100%;
    padding-left: var(--ui-slider-item-padding, 1rem);
  }

  &__pagination {
    display: flex;
    flex-direction: row;
    gap: 4px;
    justify-content: center;
    margin-top: 25px;
  }

  &__pagination-item {
    width: 31px;
    height: 2px;
    background-color: var(--input);
    display: block;

    &.is--active {
      /* stylelint-disable-next-line value-keyword-case */
      background-color: v-bind(activeColor);
    }
  }

  &__pagination-item-wrap {
    padding: 9px 0;
    cursor: pointer;
  }
}
</style>
