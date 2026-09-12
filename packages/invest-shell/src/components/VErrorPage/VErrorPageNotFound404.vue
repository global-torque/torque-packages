<script setup lang="ts">
import { VImage } from '@global-torque/ui-kit/image';
import { Button } from '@global-torque/ui-primitives/button';
import imageBg from './404.svg?url';
</script>

<template v-once>
  <div class="VErrorPageNotFound404 errors-404">
    <div class="is--container errors-404__container with-default-distance">
      <div class="errors-404__content">
        <h1
          class="errors-404__title"
        >
          Ooops.. Looks like you got lost
        </h1>
        <p class="errors-404__description is--subheading-1">
          It seems like you've encountered a broken link or perhaps there was a small typo in the
          address bar. Let's start fresh by navigating back to the Homepage.
        </p>
        <Button
          as="a"
          href="/"
          class="errors-404__btn"
          size="lg"
        >
          Back to Homepage
        </Button>
      </div>
      <VImage
        loading="lazy"
        :src="imageBg"
        alt="Products top background"
        class="errors-404__background "
      />
    </div>
  </div>
</template>

<style lang="scss">
@use '@global-torque/ui-kit/styles/mixins' as *;

.errors-404 {
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
    max-width: 457px;
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
