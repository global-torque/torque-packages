<script setup lang="ts">
import { Button } from '@global-torque/ui-primitives/button';
import { Skeleton } from '@global-torque/ui-primitives/skeleton';
import InfoSlot from './VInfoSlot.vue';
import { Spinner } from '@global-torque/ui-primitives/spinner';

defineProps<{
  bankName?: string;
  name?: string;
  last4?: string | number;
  loading?: boolean;
}>();

const emit = defineEmits<{
  (e: 'delete'): void;
}>();
</script>

<template>
  <InfoSlot>
    <div class="VInfoBankAccountItem v-info-bank-account-item">
      <div class="v-info-bank-account-item__text">
        <template v-if="loading">
          <Skeleton
            :style="{ width: '40%', height: '21px' }"
          />
          <Skeleton
            :style="{ width: '30%', height: '26px' }"
          />
        </template>
        <template v-else>
          <span
            v-if="bankName || name"
            class="is--h6__title is--color-gray-70"
          >
            {{ bankName }}: {{ name }}
          </span>
          <span
            v-if="last4"
            class="is--body is--color-gray-80"
          >
            **** {{ last4 }}
          </span>
        </template>
      </div>

      <Button
        class="v-info-bank-account-item__button text-destructive"
        @click="emit('delete')"
        variant="link"
        size="sm"
        :disabled="loading"
      >
          <Spinner v-if="loading" />
        Delete
      </Button>
    </div>
  </InfoSlot>
</template>

<style lang="scss">
.v-info-bank-account-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;

  &__text {
    display: flex;
    flex-direction: column;
    gap: 8px;
    flex: 1 0 0;
  }
}
</style>

