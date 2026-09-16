<script setup lang="ts">
import VLogo from './VLogo.vue';

defineProps({
  hide: Boolean,
});
</script>

<template>
  <div
    class="VLoader the-loader"
    data-testid="the-loader"
    :class="{ 'is--hidden': hide }"
  >
    <div class="the-loader__circle">
      <div class="the-loader__wrap">
        <VLogo
          class="the-loader__logo"
        />
      </div>
    </div>
  </div>
</template>

<style lang="scss">
.the-loader{
  position: fixed;
  top: 0;
  left: 0;
  z-index: 13000;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  background-color: var(--ui-color-surface, var(--card));

  &.is--hidden {
    display: none;
  }

  &__circle{
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    height: 120px;
  }

  &__wrap{
    position: relative;
    z-index: 1;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  &__logo {
    .v-logo__full {
      height: 60px;
    }

    .v-logo__desktop {
      height: auto;
    }
  }
}
</style>
