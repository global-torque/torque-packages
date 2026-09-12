<script setup lang="ts">
import { Skeleton } from '@global-torque/ui-primitives/skeleton';

</script>

<template>
  <div class="VFormFooterSubscribe v-form-footer-subscribe">
    <Skeleton
      :style="{ width: '100px', height: '21px' }"
    />
    <form
      novalidate
    >
      <div class="v-form-footer-subscribe__group">
        <div class="v-form-footer-subscribe__control-row">
          <div class="v-form-footer-subscribe__input">
            <Skeleton
              :style="{ width: '100%', height: '48px' }"
            />
          </div>
          <Skeleton
            :style="{ width: '115px', height: '48px' }"
          />
        </div>
      </div>
    </form>
  </div>
</template>

<style lang="scss">
.v-form-footer-subscribe {
  &__group {
    width: 100%;
  }

  &__control-row {
    display: flex;
    align-items: flex-start;
    gap: 4px;
    width: 100%;
  }

  &__input {
    flex: 1 1 auto;
    min-width: 0;
  }
}
</style>
