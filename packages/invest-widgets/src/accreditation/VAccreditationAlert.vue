<script setup lang="ts">
import { computed } from 'vue';
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

const buttonVariant = computed(() => (props.variant === 'info' ? 'default' : 'destructive'));
const hasDescriptionAction = computed(() => !!props.description?.includes('data-action="contact-us"'));

const handleDescriptionAction = (event: Event) => {
  if (!hasDescriptionAction.value) return;
  emit('descriptionAction', event);
};
</script>

<template>
  <Skeleton
    v-if="isLoading && !title"
    :style="{ width: '100%', height: '72px' }"
  />
  <Alert :variant="variant === 'error' ? 'destructive' : 'default'"
    v-else
    class="VAccreditationAlert v-accreditation-alert">
    <component :is="alertIcon(variant)" />
    <AlertTitle>{{ title }}</AlertTitle>
    <AlertDescription><span v-dompurify-html="description" /></AlertDescription>
    <Button
          v-if="buttonText"
          :variant="buttonVariant"
          :disabled="isDisabled || isLoading"
          class="v-accreditation-alert__button is--margin-top-0"
          @click="emit('action')"
          size="sm"
        >
            <Spinner v-if="isLoading" />
          {{ buttonText }}
        </Button>
  </Alert>
</template>

<style lang="scss">
.v-accreditation-alert {
  margin: 0;
}
</style>
