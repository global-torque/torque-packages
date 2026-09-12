<script setup lang="ts">
import {
  Card, CardContent, CardHeader, CardTitle,
} from '@global-torque/ui-primitives/card';

defineProps<{
  title?: string;
  data: {
    name: string;
    color: string;
    value: unknown;
  }[];
}>();
</script>

<template>
  <Card class="VChartTooltip v-chart-tooltip is--small">
    <CardHeader
      v-if="title"
      class="v-chart-tooltip__header"
    >
      <CardTitle>
        {{ title }}
      </CardTitle>
    </CardHeader>
    <CardContent class="v-chart-tooltip__content">
      <div
        v-for="(item, key) in data"
        :key="key"
        class="v-chart-tooltip__item"
      >
        <div class="v-chart-tooltip__left">
          <span class="v-chart-tooltip__icon">
            <svg
              width="100%"
              height="100%"
              viewBox="0 0 30 30"
            >
              <path
                d=" M 15 15 m -14, 0 a 14,14 0 1,1 28,0 a 14,14 0 1,1 -28,0"
                :stroke="item.color"
                :fill="item.color"
                stroke-width="1"
              />
            </svg>
          </span>
          <span>{{ item.name }}</span>
        </div>
        <span class="v-chart-tooltip__right">{{ item.value }}</span>
      </div>
    </CardContent>
  </Card>
</template>

<style lang="scss">
.v-chart-tooltip {
  display: var(--ui-chart-tooltip-display, revert-layer);
  position: var(--ui-chart-tooltip-position, revert-layer);
  background: var(--ui-chart-tooltip-background, revert-layer);
  padding: var(--ui-chart-tooltip-padding, revert-layer);
  border-width: var(--ui-chart-tooltip-border-width, revert-layer);

  &__header {
    display: var(--ui-chart-tooltip-display, revert-layer);
    padding: var(--ui-chart-tooltip-padding, revert-layer);
  }

  &__content {
    padding: var(--ui-chart-tooltip-padding, revert-layer);
    width: var(--ui-chart-tooltip-content-width, revert-layer);
    min-width: 180px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  &__item {
    display: flex;
    justify-content: space-between;
  }

  &__left {
    display: flex;
    align-items: center;
  }

  &__icon {
    width: 10px;
    height: 10px;
    margin-right: 4px;
    display: inline-block;

    svg {
      display: block;
    }
  }

  &__right {
    margin-left: 4px;
  }
}
</style>
