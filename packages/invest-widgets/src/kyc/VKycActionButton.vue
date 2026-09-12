<script setup lang="ts">
import { useKycAlertViewModel } from './useKycAlertViewModel.ts';
import { Button } from '@global-torque/ui-primitives/button';
import { Spinner } from '@global-torque/ui-primitives/spinner';

withDefaults(defineProps<{
  size?: 'small' | 'large';
}>(), {
  size: 'small',
});

const {
  alertModel,
  onPrimaryAction,
} = useKycAlertViewModel();
</script>

<template>
  <Button
    v-if="alertModel.buttonText"
    :size="size === 'large' ? 'lg' : 'sm'"
    :disabled="alertModel.isDisabled || alertModel.isLoading"
    @click="onPrimaryAction"
  >
      <Spinner v-if="alertModel.isLoading" />
    {{ alertModel.buttonText }}
  </Button>
</template>
