<script setup lang="ts">
import { PropType } from 'vue';
import type { SocialLink } from './socials';

defineProps({
  socialList: {
    type: Array as PropType<SocialLink[]>,
    required: true,
  },
});
</script>

<template>
  <div class="SocialLinks social-links">
    <!-- eslint-disable-next-line vuejs-accessibility/anchor-has-content -->
    <a
      v-for="item in socialList"
      :key="item.iconName"
      :href="item.href"
      target="_blank"
      class="social-links__item "
      rel="noopener noreferrer"
      :aria-label="item.name"
    >
      <span
        v-if="typeof item.icon === 'string'"
        class="social-links__icon"
        aria-hidden="true"
        :style="{ maskImage: `url(${JSON.stringify(item.icon)})` }"
      />
      <component
        :is="item.icon"
        v-else
        class="social-links__icon"
      />
    </a>
  </div>
</template>

<style lang="scss">
.social-links{
  display: flex;
  flex-direction: row;
  align-items: center;
  width: 100%;

  @media screen and (max-width: 768px){
    flex-wrap: wrap;
    justify-content: center;
  }

  @media screen and (max-width: 575px){
    justify-content: flex-start;
  }

  &__icon{
    height: 24px;
    width: 24px;
  }

  // A string icon is a mask, so it paints the inherited text color.
  span.social-links__icon{
    background-color: currentColor;
    mask-repeat: no-repeat;
    mask-position: center;
    mask-size: contain;
  }

  &__item{
    display: flex;
    align-items: center;
    padding-bottom: 0;
    margin-right: 0;
    margin-bottom: 0;
    color: inherit;
    opacity: 1;

    &:last-child{
      margin-right: 0;
    }

    @media screen and (max-width: 768px){
      margin-right: 28px;
      margin-bottom: 10px;
    }

    &:hover{
      color: var(--primary);
    }

    @media screen and (min-width: 768px){
      margin-right: 24px;
    }
  }
}
</style>
