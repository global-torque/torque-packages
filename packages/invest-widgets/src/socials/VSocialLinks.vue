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
      <img
        v-if="typeof item.icon === 'string'"
        :src="item.icon"
        alt=""
        class="social-links__icon"
      >
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
  color: var(--ui-color-text-inverse, var(--background));

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
