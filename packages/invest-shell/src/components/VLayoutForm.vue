<script setup lang="ts">
// @ts-nocheck
import { Button } from '@global-torque/ui-primitives/button';
import { useRouter, type RouteLocationRaw } from 'vue-router';
import { VBreadcrumbs, type IBreadcrumb } from '@global-torque/invest-widgets/navigation';
import { PropType } from 'vue';
import { ArrowLeftIcon as arrowLeft } from '@global-torque/invest-widgets/icons/navigation';
import { useMobileAppShell } from '../navigation/useMobileAppShell.ts';
import { navigateToRouteLocation } from '../navigation/navigation.ts';
import { Spinner } from '@global-torque/ui-primitives/spinner';

const props = defineProps({
  buttonText: String,
  buttonRoute: {
    type: [String, Object] as PropType<RouteLocationRaw>,
    default: undefined,
  },
  breadcrumbs: Object as PropType<IBreadcrumb[]>,
  isDisabledButton: {
    type: Boolean,
    default: false,
  },
  isLoading: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(['save']);

const router = useRouter();
const { usesMobileAppShell } = useMobileAppShell();

const onBackClick = () => {
  if (props.buttonRoute) {
    void navigateToRouteLocation(router, props.buttonRoute);
  }
  else {
    router.back();
  }
};

const saveHandler = () => {
  emit('save');
};
</script>

<template>
  <div
    class="VLayoutForm layout-back-button"
    :class="{ 'is--loading': isLoading, 'is--pwa': usesMobileAppShell }"
  >
    <div class="is--container layout-back-button__container">
      <div
        v-if="!usesMobileAppShell"
        class="layout-back-button__left"
      >
        <Button
          class="gap-[var(--ui-layout-back-gap,8px)]"
          variant="link"
          size="lg"
          @click.stop="onBackClick"
        >
          <arrowLeft
            alt="arrow left"
            class="layout-back-button__back-icon"
          />
          {{ buttonText }}
        </Button>
      </div>
      <div class="layout-back-button__right">
        <slot />
        <div class="layout-back-button__right-footer">
          <Button
            variant="outline"
            size="lg"
            @click="onBackClick"
          >
            Cancel
          </Button>
          <Button
            :disabled="isDisabledButton || isLoading"
            size="lg"
            @click="saveHandler"
          >
            <Spinner v-if="isLoading" />
            Save
          </Button>
        </div>
      </div>
    </div>
    <div class="is--container layout-back-button__footer">
      <VBreadcrumbs
        :data="breadcrumbs"
        class="layout-back-button__breadcrumbs"
      />
    </div>
  </div>
</template>

<style lang="scss">
.layout-back-button {
  $root: &;
  $content-width: 980px;

  width: 100%;
  margin-bottom: 60px;

  // @media screen and (max-width: 980px){
  //   padding-top: 64px;
  // }

  &.is--pwa {
    margin-bottom: 67px;

    // @media screen and (max-width: 980px){
    //   padding-top: calc(#{64px} + env(safe-area-inset-top));
    // }
  }

  &.is--loading {
    cursor: wait !important;
  }

  &__container {
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: stretch;
    padding-top: 40px;
    gap: 40px;
    margin-bottom: 130px;

    @media screen and (width <= 980px){
      gap: 24px;
      padding-top: 24px;
      margin-bottom: 100px;
    }
  }

  &__left {
    width: 100%;
    flex-shrink: 0;
  }

  &__right {
    width: 100%;
    max-width: $content-width;
    margin: 0 auto;

    #{$root}.is--loading & {
      opacity: 0.5;
      pointer-events: none;
    }
  }

  &__back-icon {
    width: var(--ui-layout-back-icon-size, 20px);
    height: var(--ui-layout-back-icon-size, revert-layer);
  }

  &__right-footer {
    display: flex;
    justify-content: flex-end;
    align-items: flex-start;
    gap: 12px;
    margin-top: 40px;

    @media screen and (width <= 980px){
      margin-top: 20px;
    }
  }

  &__footer {
    max-width: calc(#{$content-width} + 30px);
  }
}
</style>
