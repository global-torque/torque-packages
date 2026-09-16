<script setup lang="ts">
import { computed, useSlots } from 'vue';
import VTextCurrencyWithUnit from '../wallet/VTextCurrencyWithUnit.vue';
import { Skeleton } from '@global-torque/ui-primitives/skeleton';

const SECONDARY_VALUE_NUMBER_RE = /[%$,\s]/g;

export type VCardInfoAction = {
  label: string;
  href: string;
  iconPre?: string;
  iconPost?: string;
  /** Optional extra classes for the leading icon. */
  iconPreClass?: string | string[] | Record<string, unknown>;
  /** Optional extra classes for the trailing icon. */
  iconPostClass?: string | string[] | Record<string, unknown>;
};

const props = withDefaults(
  defineProps<{
    minWidth?: string;
    amount?: string | number | null;
    unit?: string | null;
    valueProps?: Record<string, unknown>;
    title?: string;
    loading?: boolean;
    secondaryText?: string;
    secondaryValue?: string;
    action?: VCardInfoAction;
  }>(),
  {
    valueProps: () => ({}),
    loading: false,
  },
);

const slots = useSlots();

const mergedValueProps = computed(() => ({
  amount: props.amount,
  unit: props.unit,
  ...props.valueProps,
}));

const showTitle = computed(() => !!slots.title || props.title);
const hasSecondaryFromProps = computed(() => !!(props.secondaryText ?? props.secondaryValue));
const showSecondary = computed(() => !!slots.secondary || hasSecondaryFromProps.value);
const showAction = computed(() => !!slots.action || props.action);

/** 'positive' | 'negative' | null; null means no color (e.g. zero). */
const secondaryValueSign = computed(() => {
  const v = props.secondaryValue;
  if (!v) return null;
  const num = Number.parseFloat(v.replace(SECONDARY_VALUE_NUMBER_RE, ''));
  if (!Number.isNaN(num) && num === 0) return null;
  if (v.startsWith('-')) return 'negative';
  if (v.startsWith('+') || num > 0) return 'positive';
  if (num < 0) return 'negative';
  return null;
});
</script>

<template>
  <div
    class="VCardInfo v-card-info"
    :style="minWidth ? { minWidth } : undefined"
  >
    <div class="v-card-info__wrap">
      <div
        v-if="showTitle"
        class="v-card-info__title is--h6__title"
      >
        <slot name="title">
          {{ title }}
        </slot>
      </div>

      <div class="v-card-info__value">
        <Skeleton
          v-if="loading"
          height="28px"
          width="100px"
          class="v-card-info__skeleton"
        />
        <template v-else>
          <slot v-bind="mergedValueProps">
            <VTextCurrencyWithUnit v-bind="mergedValueProps" />
          </slot>
        </template>
      </div>

      <div
        v-if="showSecondary"
        class="v-card-info__secondary is--small"
      >
        <Skeleton
          v-if="loading"
          height="12px"
          width="150px"
          class="v-card-info__skeleton"
        />
        <template v-else>
          <slot name="secondary">
            <template v-if="hasSecondaryFromProps">
              <span
                v-if="secondaryValue"
                class="v-card-info__secondary-value"
                :class="secondaryValueSign && `is--${secondaryValueSign}`"
              >
                {{ secondaryValue }}
              </span>
              <span class="v-card-info__secondary-text">{{ secondaryText }}</span>
            </template>
          </slot>
        </template>
      </div>
    </div>
    <div
      v-if="showAction || loading"
      class="v-card-info__action"
    >
      <Skeleton
        v-if="loading"
        height="14px"
        width="100px"
        class="v-card-info__skeleton"
      />
      <template v-else>
        <slot name="action">
          <a
            v-if="action && action.href"
            :href="action.href"
            target="_blank"
            rel="noopener noreferrer"
            class="v-card-info__action-link is--link-2"
          >
            <component
              :is="action.iconPre"
              v-if="action?.iconPre"
              :class="['v-card-info__action-icon', action.iconPreClass]"
            />  
            {{ action.label }}
            <component
              :is="action.iconPost"
              v-if="action?.iconPost"
              :class="['v-card-info__action-icon', action.iconPostClass]"
            />
          </a>
        </slot>
      </template>
    </div>
  </div>
</template>

<style lang="scss">

.v-card-info {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: space-between;
  width: 100%;
  padding: 20px 24px;
  background-color: var(--ui-color-surface, var(--background));
  box-shadow: var(--ui-shadow-dialog, var(--shadow-dialog));
  border-radius: 2px;

  &__wrap {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
  }

  &__title {
    color: var(--muted-foreground);
  }

  &__value {
    color: var(--foreground);
    margin-top: 4px;
  }

  &__secondary {
    color: var(--muted-foreground);
    margin-top: 2px;
  }

  &__secondary-value {
      margin-right: 4px;

      &.is--positive {
        color: var(--ui-color-positive, var(--color-positive-strong));
      }

      &.is--negative {
        color: var(--destructive);
      }
    }

  &__action {
    margin-top: 20px;
  }

  &__action-link {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  &__action-icon {
    width: 16px;
    height: 16px;
  }

  &__skeleton {
    display: block;
  }
}
</style>
