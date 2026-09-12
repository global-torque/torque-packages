<script setup lang="ts">
import { VImage } from '@global-torque/ui-kit/image';
import imageBg from './500.svg?url';
</script>

<template v-once>
  <div class="VErrorPageServer500 errors-500">
    <div class="errors-500__container is--container with-default-distance">
      <div class="errors-500__content">
        <h1 class="errors-500__title">
          Ooops... Our server taking a break
        </h1>
        <p class="errors-500__description is--subheading-1">
          It looks like our server decided to take a coffee break ☕. Don't worry,
          it's just recharging and will be back in action soon! In
          the meantime, feel free to refresh or come back in a bit
        </p>
        <p class="errors-500__description is--subheading-1">
          Server promises not to snooze for long! 
        </p>
      </div>
      <VImage
        loading="lazy"
        :src="imageBg"
        alt="Server error illustration"
        class="errors-500__background"
      />
    </div>
  </div>
</template>

<style lang="scss">
@use '@global-torque/ui-kit/styles/mixins' as *;

.errors-500 {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background-color: var(--background);
  min-height: 100vh;
  padding: 190px 0 140px;

  @include media-lt(desktop) {
    padding: 120px 0 110px;
  }

  &__content {
    width: 100%;
    color: var(--foreground);
    max-width: 490px;
    flex-shrink: 0;
  }

  &__background {
    max-width: 698.181px;
    max-height: 357.305px;
    width: 100%;
    height: auto;

    @include media-lte(desktop) {
      width: 100%;
      max-width: 100%;
      margin-top: 60px;
    }
  }

  &__container {
    display: flex;
    position: relative;
    justify-content: space-between;

    @include media-lte(desktop) {
      flex-direction: column;
    }
  }
}
</style>

