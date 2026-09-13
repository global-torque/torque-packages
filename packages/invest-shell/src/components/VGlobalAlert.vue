<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { useGlobalAlert } from '@global-torque/invest-runtime/global-alert';
import { Alert, AlertDescription, AlertTitle } from '@global-torque/ui-primitives/alert';
import { CircleAlert, CircleCheck, Info, TriangleAlert } from '@lucide/vue';
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
    </Alert>
  </div>
</template>

<style lang="scss">
.v-global-alert {
  width: 100%;
  display: flex;
  justify-content: center;
  position: fixed;
  bottom: -20px;
  z-index: 11;
  background: color-mix(in srgb, var(--background) 60%, transparent);

  &__alert {
    width: 100%;
    max-width: 1280px;
  }
}
</style>
