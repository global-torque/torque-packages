<script setup lang="ts" generic="T extends Record<string, any>">
import type { BaseChartProps } from './index';
import { VChartCrosshair, VChartLegend, defaultColors } from '../parts';
import { type BulletLegendItemInterface, CurveType } from '@unovis/ts';
import { Area, Line } from '@unovis/ts';
import {
  VisArea, VisAxis, VisLine, VisXYContainer,
} from '@unovis/vue';
import { useId } from 'reka-ui';
import { type Component, computed, ref } from 'vue';

// yarn add @unovis/ts
// yarn add @unovis/vue

const props = withDefaults(defineProps<BaseChartProps<T> & {
  /**
   * Render custom tooltip component.
   */
  customTooltip?: Component;
  /**
   * Type of curve
   */
  curveType?: CurveType;
  /**
   * Controls the visibility of gradient.
   * @default true
   */
  showGradiant?: boolean;
  title?: string;
}>(), {
  curveType: CurveType.MonotoneX,
  filterOpacity: 0.2,
  margin: () => ({
    top: 0, bottom: 0, left: 0, right: 0,
  }),
  showXAxis: true,
  showYAxis: true,
  showTooltip: true,
  showLegend: true,
  showGridLine: true,
  showGradiant: true,
});

const emits = defineEmits<{
  legendItemClick: [d: BulletLegendItemInterface, i: number];
}>();

type Data = typeof props.data[number]

const chartRef = useId();

const index = computed(() => props.index);
const colors = computed(() => (props.colors?.length ? props.colors : defaultColors(props.categories.length)));

const legendItems = ref<BulletLegendItemInterface[]>(props.categories.map((category, i) => ({
  name: category,
  color: colors.value[i],
  inactive: false,
})));

function handleLegendItemClick(d: BulletLegendItemInterface, i: number) {
  emits('legendItemClick', d, i);
}
</script>

<template>
  <div class="VShadcnChartArea v-shadcn-chart-area">
    <h3
      v-if="title"
      class="v-shadcn-chart-area__title"
    >
      {{ title }}
    </h3>
    <VChartLegend
      v-if="showLegend"
      v-model:items="legendItems"
      @legend-item-click="handleLegendItemClick"
    />

    <VisXYContainer
      :data="data"
      class="v-shadcn-chart-area__container"
    >
      <svg
        width="0"
        height="0"
      >
        <defs>
          <linearGradient
            v-for="(color, i) in colors"
            :id="`${chartRef}-color-${i}`"
            :key="i"
            x1="0"
            y1="0"
            x2="0"
            y2="1"
          >
            <template v-if="showGradiant">
              <stop
                offset="5%"
                :stop-color="color"
                stop-opacity="0.4"
              />
              <stop
                offset="95%"
                :stop-color="color"
                stop-opacity="0"
              />
            </template>
            <template v-else>
              <stop
                offset="0%"
                :stop-color="color"
              />
            </template>
          </linearGradient>
        </defs>
      </svg>

      <VChartCrosshair
        v-if="showTooltip"
        :colors="colors"
        :items="legendItems"
        :index="index"
        :custom-tooltip="customTooltip"
      />

      <template
        v-for="(category, i) in categories"
        :key="category"
      >
        <VisArea
          :x="(d: Data, i: number) => i"
          :y="(d: Data) => d[category]"
          color="auto"
          :curve-type="curveType"
          :attributes="{
            [Area.selectors.area]: {
              fill: `url(#${chartRef}-color-${i})`,
            },
          }"
          :opacity="legendItems.find(item => item.name === category)?.inactive ? filterOpacity : 1"
        />
      </template>

      <template
        v-for="(category, i) in categories"
        :key="category"
      >
        <VisLine
          :x="(d: Data, i: number) => i"
          :y="(d: Data) => d[category]"
          :color="colors[i]"
          :curve-type="curveType"
          :attributes="{
            [Line.selectors.line]: {
              opacity: legendItems.find(item => item.name === category)?.inactive ? filterOpacity : 1,
            },
          }"
        />
      </template>

      <VisAxis
        v-if="showXAxis"
        type="x"
        :tick-format="xFormatter ?? ((v: number) => data[v]?.[index])"
        :grid-line="false"
        :tick-line="false"
        tick-text-color="hsl(var(--vis-text-color))"
      />
      <VisAxis
        v-if="showYAxis"
        type="y"
        :tick-line="false"
        :tick-format="yFormatter"
        :domain-line="false"
        :grid-line="showGridLine"
        tick-text-color="hsl(var(--vis-text-color))"
      />

      <slot />
    </VisXYContainer>
  </div>
</template>

<style lang="scss">
.v-shadcn-chart-area {
  display: flex;
  flex-direction: column;
  width: 100%;

  &__container {
    width: 100%;
    height: 300px;
    display: flex !important;
  }
}
</style>
