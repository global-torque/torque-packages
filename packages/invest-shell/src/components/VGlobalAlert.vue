<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { useGlobalAlert } from '@global-torque/invest-runtime/global-alert';
import { Alert, AlertDescription, AlertTitle } from '@global-torque/ui-primitives/alert';
import { CircleAlert, CircleCheck, Info, TriangleAlert, X } from '@lucide/vue';
import { computed } from 'vue';

const globalAlertStore = useGlobalAlert();
const {
  isVisible,
  variant,
  title,
  message,
} = storeToRefs(globalAlertStore);
const icons: Record<string, typeof CircleAlert> = { success: CircleCheck, info: Info, warning: TriangleAlert };
const icon = computed(() => icons[variant.value ?? 'error'] ?? CircleAlert);
const alertTones: Record<string, 'default' | 'success' | 'warning' | 'destructive'> = { error: 'destructive', success: 'success', warning: 'warning' };
const alertVariant = computed(() => alertTones[variant.value ?? 'error'] ?? 'default');
</script>

<template>
  <div
    v-if="isVisible && message"
    class="VGlobalAlert v-global-alert"
  >
    <Alert
      :variant="alertVariant"
      class="v-global-alert__alert cursor-pointer"
      @click="globalAlertStore.hide()"
    >
      <component :is="icon" />
      <AlertTitle v-if="title">
        {{ title }}
      </AlertTitle>
      <AlertDescription>
        {{ message }}
      </AlertDescription>
      <button
        type="button"
        class="v-global-alert__close"
        aria-label="Dismiss notification"
        @click.stop="globalAlertStore.hide()"
      >
        <X aria-hidden="true" />
      </button>
    </Alert>
  </div>
</template>

<style lang="scss">
.v-global-alert {
  width: 100%;
  display: flex;
  justify-content: center;
  position: fixed;
  bottom: 0;
  z-index: 11;

  &__alert {
    width: calc(100% - 32px);
    max-width: 1280px;
    margin-bottom: 16px;
    padding-right: 48px;
  }

  &__close {
    position: absolute;
    top: 8px;
    right: 8px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    padding: 0;
    border: 0;
    border-radius: 9999px;
    color: inherit;
    background: transparent;
    cursor: pointer;

    &:hover {
      background: color-mix(in srgb, currentColor 10%, transparent);
    }

    &:focus-visible {
      outline: 2px solid currentColor;
      outline-offset: 2px;
    }

    svg {
      width: 16px;
      height: 16px;
    }
  }
}
</style>
