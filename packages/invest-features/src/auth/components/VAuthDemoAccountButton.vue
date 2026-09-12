<script setup lang="ts">
import { Button } from '@global-torque/ui-primitives/button';
import { Spinner } from '@global-torque/ui-primitives/spinner';

defineProps<{
  disabled?: boolean;
  loading?: boolean;
  visible: boolean;
}>();

const emit = defineEmits<{
  click: [];
}>();
</script>

<template>
  <Button
    v-if="visible"
    type="button"
    :disabled="disabled || loading"
    class="VAuthDemoAccountButton auth-demo-account-button w-full"
    data-testid="demo-account-button"
    @click.stop.prevent="emit('click')"
    variant="secondary"
    size="lg"
  >
      <Spinner v-if="loading" />
    Try Demo Account
  </Button>
</template>

<style lang="scss">
.auth-demo-account-button {
  margin-top: 12px;
}
</style>
