<script setup lang="ts">
import { Alert, AlertDescription, AlertTitle } from '@global-torque/ui-primitives/alert';
import { Button } from '@global-torque/ui-primitives/button';
import { Skeleton } from '@global-torque/ui-primitives/skeleton';
import { Spinner } from '@global-torque/ui-primitives/spinner';
import {  } from '@lucide/vue';
import { CircleAlertIcon, CircleCheckIcon, InfoIcon, TriangleAlertIcon } from '@lucide/vue';

/** Icon of an alert variant. */
const alertIcon = (variant?: string) => ({ error: CircleAlertIcon, success: CircleCheckIcon, warning: TriangleAlertIcon } as Record<string, unknown>)[variant ?? ''] ?? InfoIcon;

const props = withDefaults(defineProps<{
  variant?: 'error' | 'info';
  title?: string;
  description?: string;
  buttonText?: string;
  isLoading?: boolean;
  isDisabled?: boolean;
}>(), {
  variant: 'info',
  title: undefined,
  description: undefined,
  buttonText: undefined,
  isLoading: false,
  isDisabled: false,
});

const emit = defineEmits<{
  action: [];
  descriptionAction: [event: Event];
}>();

const handleDescriptionAction = (event: Event) => emit('descriptionAction', event);
</script>

<template>
  <Skeleton
    v-if="isLoading && !title"
    :style="{ width: '100%', height: '72px' }"
  />
  <Alert :variant="variant === 'error' ? 'destructive' : 'default'"
    v-else
    class="VKycAlert v-kyc-alert">
    <component :is="alertIcon(variant)" />
    <AlertTitle>{{ title }}</AlertTitle>
    <AlertDescription>
      <span v-dompurify-html="description" />
      {{ ' ' }}
      <Button
        v-if="buttonText"
        type="button"
        variant="link"
        :disabled="isDisabled || isLoading"
        class="v-kyc-alert__action"
        @click="emit('action')"
      >
        <Spinner v-if="isLoading" />
        {{ buttonText }}
      </Button>
    </AlertDescription>
  </Alert>
</template>

<style lang="scss">
.v-kyc-alert {
  margin: 0;

  &__action[data-slot='button'][data-variant='link'] {
    display: inline;
    min-height: 0;
    height: auto;
    margin: 0;
    padding: 0;
    border: 0;
    border-radius: 0;
    background: transparent;
    gap: 0;
    font: inherit;
    line-height: inherit;
    white-space: normal;
    text-decoration: underline;
    text-underline-offset: 0.2em;
    vertical-align: baseline;

    &:hover {
      background: transparent;
    }
  }
}
</style>
