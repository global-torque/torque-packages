<script setup lang="ts">
import { PropType } from 'vue';
import VSliderAutoplay from './VSliderAutoplay.vue';

defineProps({
  data: {
    type: Array as PropType<unknown[]>,
    required: true,
  },
  autoplay: {
    type: Boolean,
    default: false,
  },
  fade: {
    type: Boolean,
    default: false,
  },
  showPagination: {
    type: Boolean,
    default: true,
  },
  activeColor: {
    type: String,
    default: 'var(--ui-color-accent, #004FFF)',
  },
  autoplayChangeTime: {
    type: Number,
    default: 6000,
  },
  options: {
    type: Object,
    default: () => ({}),
  },
});
</script>

<template>
  <div class="VSliderCards v-slider-cards">
    <VSliderAutoplay
      :data="data"
      :autoplay="autoplay"
      :fade="fade"
      :show-pagination="showPagination"
      :active-color="activeColor"
      :autoplay-change-time="autoplayChangeTime"
      :options="options"
      :pass-item-data="true"
      class="v-slider-cards__slider"
    >
      <template #default="{ active: slide }">
        <slot :slide="slide" />
      </template>
    </VSliderAutoplay>
  </div>
</template>

<style lang="scss">
.v-slider-cards {
  width: calc(100% + 30px);
  overflow: hidden;
  margin: 0 -15px;
  padding: 15px 15px 0;

  &__slider {
    .v-slider-autoplay {
      &__slider {
        margin: 0 -15px;
        width: calc(100% + 30px);
      }

      &__item {
        flex: 0 0 60%;

        &:first-child {
          padding-left: 15px;
        }

        &:last-child {
          padding-right: 15px;
        }
      }

      &__pagination {
        margin-top: 10px;
      }
    }

    .v-slider__content {
      gap: 8px;
    }
  }
}
</style>
