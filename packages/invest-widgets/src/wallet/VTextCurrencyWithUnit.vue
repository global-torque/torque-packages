<script setup lang="ts">
import { computed } from 'vue';
import { Skeleton } from '@global-torque/ui-primitives/skeleton';

const props = defineProps<{
  amount?: string | number | null;
  unit?: string | null;
  /**
   * Show loading skeleton instead of the text.
   */
  loading?: boolean;
  /**
   * Optional extra classes for the root amount element.
   * Defaults are typically typography utility classes like `is--h2__title`.
   */
  amountClass?: string;
  /**
   * Optional extra classes for the unit/coin span.
   * Defaults are typically typography utility classes like `is--small`.
   */
  unitClass?: string;
}>();

const amountText = computed(() => (props.amount ?? '').toString());
const unitText = computed(() => (props.unit ?? '').toString());
</script>

<template>
  <div
    class="VTextCurrencyWithUnit v-text-currency-with-unit"
    :class="amountClass"
  >
    <Skeleton
      v-if="loading"
      class="v-text-currency-with-unit__skeleton"
      :style="{ width: '100px', height: '64px' }"
    />
    <template v-else>
      {{ amountText }}
      <span
        v-if="unit"
        class="v-text-currency-with-unit__unit is--small"
        :class="unitClass"
      >
        {{ unitText }}
      </span>
    </template>
  </div>
</template>

<style lang="scss">
.v-text-currency-with-unit {
  display: inline-flex;
  align-items: baseline;
  color: var(--foreground);

  &__skeleton {
    flex: 1;
  }

  &__unit {
    margin-left: 2px;
  }
}
</style>

