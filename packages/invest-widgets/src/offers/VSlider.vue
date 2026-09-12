<script setup lang="ts">
import Autoplay from 'embla-carousel-autoplay';
import Fade from 'embla-carousel-fade';
import { computed } from 'vue';
import { Carousel, CarouselContent, CarouselNext, CarouselPrevious, type CarouselApi } from '@global-torque/ui-primitives/carousel';
import { ArrowLeft, ArrowRight } from '@lucide/vue';
import ArrowLeftApproved from '../icons/images/arrow-left.svg?component';
import ArrowRightApproved from '../icons/images/arrow-right.svg?component';

interface Props {
  variant?: 'default' | 'autoplay';
  autoplay?: boolean;
  fade?: boolean;
  autoplayChangeTime?: number;
  options?: object;
  showButtons?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  autoplayChangeTime: 6000,
  variant: 'default',
  showButtons: true,
});

const emit = defineEmits<{
  'init-api': [api: CarouselApi];
}>();

const isAutoplay = computed(() => props.variant === 'autoplay');
const shouldShowButtons = computed(() => props.showButtons && !isAutoplay.value);

type CarouselPlugin = NonNullable<InstanceType<typeof Carousel>['$props']['plugins']>;
const plugins: CarouselPlugin = [];
if (props.autoplay || isAutoplay.value) {
  plugins.push(Autoplay({
    delay: props.autoplayChangeTime,
    stopOnInteraction: false,
  }));
}
// Only use fade if explicitly enabled via fade prop
if (props.fade) {
  plugins.push(Fade());
}
</script>

<template>
  <Carousel
    class="v-slider"
    :opts="{
      align: 'start',
      ...props.options,
    }"
    :plugins="plugins"
    orientation="horizontal"
    :class="{ 'is--autoplay': isAutoplay, 'is--no-buttons': !shouldShowButtons }"
    @init-api="emit('init-api', $event)"
  >
    <CarouselPrevious
      v-if="shouldShowButtons"
      class="v-slider__prev"
    >
      <ArrowLeft class="v-slider__icon-outline" />
      <ArrowLeftApproved
        class="v-slider__icon-approved size-[18px]"
        aria-hidden="true"
      />
      <span class="sr-only">Previous Slide</span>
    </CarouselPrevious>
    <CarouselNext
      v-if="shouldShowButtons"
      class="v-slider__next"
    >
      <ArrowRight class="v-slider__icon-outline" />
      <ArrowRightApproved
        class="v-slider__icon-approved size-[18px]"
        aria-hidden="true"
      />
      <span class="sr-only">Next Slide</span>
    </CarouselNext>
    <CarouselContent class="v-slider__content">
      <slot />
    </CarouselContent>
  </Carousel>
</template>

<style lang="scss">
.v-slider {
  $root: &;

  width: 100%;

  &__content {
    margin-left: var(--ui-slider-track-margin, -1rem);
  }

  &__prev,
  &__next {
    width: var(--ui-slider-control-size, 2rem);
    height: var(--ui-slider-control-size, 2rem);
    padding: var(--ui-slider-control-padding, revert-layer);
    border-radius: var(--ui-slider-control-radius, revert-layer);
    border-color: var(--ui-slider-control-border, revert-layer);
    background: var(--ui-slider-control-background, revert-layer);
    color: var(--ui-slider-control-color, revert-layer);
    box-shadow: var(--ui-slider-control-shadow, revert-layer);
    translate: var(--ui-slider-control-translate, revert-layer);

    &:hover {
      background: var(--ui-slider-control-hover-background, revert-layer);
      color: var(--ui-slider-control-hover-color, revert-layer);
    }

    &:disabled {
      opacity: var(--ui-slider-control-disabled-opacity, revert-layer);
    }
  }

  &__icon-outline { display: var(--ui-slider-outline-icon-display, block); }

  &__icon-approved { display: var(--ui-slider-approved-icon-display, none); }

  &:not(.is--autoplay, .is--no-buttons) {
    margin-top: 10px;

    @media screen and (width <= 767px) {
      margin-top: 40px;
    }
  }

  &.is--autoplay,
  &.is--no-buttons {
    #{$root}__prev,
    #{$root}__next {
      display: none;
    }
  }

  &__prev {
    top: -95px;
    right: 70px;
    left: auto; // the primitive positions with `left`; the widget keeps the pair in the header row

    @media screen and (width <= 767px) {
     top: -75px;
    }
  }

  &__next {
    top: -95px;
    right: 15px;

    @media screen and (width <= 767px) {
      top: -75px;
    }
  }

  .with-default-distance #{$root},
  #{$root}.with-default-distance {
      margin-top: 60px;

      @media screen and (width <= 768px){
        margin-top: 100px;
      }
  }
}

</style>
