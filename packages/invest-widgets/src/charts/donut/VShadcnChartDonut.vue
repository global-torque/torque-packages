<script setup lang="ts" generic="T extends Record<string, any>">
import type { BaseChartProps } from './index';
import { defaultColors } from '../parts';
import { Donut } from '@unovis/ts';
import { VisDonut, VisSingleContainer } from '@unovis/vue';
import { useMounted } from '@vueuse/core';
import {
  computed,
  onBeforeUnmount,
  onMounted,
  ref,
} from 'vue';

// yarn add @unovis/ts
// yarn add @unovis/vue

const props = withDefaults(defineProps<Pick<BaseChartProps<T>, 'data' | 'colors' | 'index' | 'margin' | 'showLegend' | 'showTooltip' | 'filterOpacity'> & {
  /**
   * Sets the name of the key containing the quantitative chart values.
   */
  category: KeyOfT;
  /**
   * Change the type of the chart
   * @default "donut"
   */
  type?: 'donut' | 'pie';
  /**
   * Function to sort the segment
   */
  sortFunction?:(a: unknown, b: unknown) => number | undefined;
  /**
   * Controls the formatting for the label.
   */
  valueFormatter?: (tick: number, i?: number, ticks?: number[]) => string;
  showCenter?: boolean;
  title?: string;
  subtitle?: string;
}>(), {
  margin: () => ({
    top: 0, bottom: 0, left: 0, right: 0,
  }),
  sortFunction: () => undefined,
  valueFormatter: (tick: number) => `${tick}`,
  type: 'donut',
  filterOpacity: 0.2,
  showTooltip: true,
  showLegend: true,
});

type KeyOfT = Extract<keyof T, string>
type Data = typeof props.data[number]

const valueFormatter = props.valueFormatter ?? ((tick: number) => `${tick}`)
const category = computed(() => props.category as KeyOfT)
const index = computed(() => props.index as KeyOfT)

const isMounted = useMounted();
const rootElement = ref<HTMLElement | null>(null);
const chartRenderKey = ref(0);
const activeSegmentKey = ref<string>();
const hoveredSegment = ref<Data>();
let resizeObserver: ResizeObserver | undefined;
let intersectionObserver: IntersectionObserver | undefined;
let visibilityFrame: number | undefined;
let wasRenderable = false;
const colors = computed(() => (
  props.colors?.length
  ? props.colors
  : defaultColors(props.data.filter((d) => d[props.category]).filter(Boolean).length)
));

const totalValue = computed(() => props.data.reduce((prev, curr) => prev + curr[props.category], 0));
const noData = computed(() => props.data.length === 0)

const readout = computed(() => {
  if (props.type !== 'donut') return undefined;

  const hovered = hoveredSegment.value;
  if (hovered) {
    return {
      key: hovered[index.value],
      value: valueFormatter(hovered[category.value]),
      name: String(hovered[index.value]),
    };
  }

  return props.showCenter ? { key: 'total', value: valueFormatter(totalValue.value), name: '' } : undefined;
});

// VisDonut redraws the ring whenever a prop gets a new identity, and a redraw
// resets the click emphasis. So the accessor and the events stay stable.
const valueAccessor = (d: Data) => d[category.value];
const events = {
  [Donut.selectors.segment]: {
    mouseover: (d: { data: Data }) => {
      hoveredSegment.value = d.data;
    },
    mouseleave: () => {
      hoveredSegment.value = undefined;
    },
    click: (d: { data: Data }, ev: MouseEvent, i: number, elements: (SVGElement | HTMLElement)[]) => {
      if (d?.data?.[index.value] === activeSegmentKey.value) {
        activeSegmentKey.value = undefined;
        elements.forEach((el) => { el.style.opacity = '1'; });
      } else {
        activeSegmentKey.value = d?.data?.[index.value];
        elements.forEach((el) => { el.style.opacity = `${props.filterOpacity}`; });
        elements[i].style.opacity = '1';
      }
    },
  },
};

const hasDom = () => typeof window !== 'undefined';

const isRenderable = () => {
  const element = rootElement.value;
  if (!element) return false;

  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
};

const syncRenderableState = () => {
  const nextRenderable = isRenderable();

  if (nextRenderable && !wasRenderable) {
    chartRenderKey.value += 1;
  }

  wasRenderable = nextRenderable;
};

const scheduleRenderableSync = () => {
  if (!hasDom()) return;

  if (visibilityFrame !== undefined) {
    window.cancelAnimationFrame(visibilityFrame);
  }

  visibilityFrame = window.requestAnimationFrame(() => {
    visibilityFrame = undefined;
    syncRenderableState();
  });
};

onMounted(() => {
  scheduleRenderableSync();

  const element = rootElement.value;
  if (!element || !hasDom()) return;

  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(scheduleRenderableSync);
    resizeObserver.observe(element);
  }

  if (typeof IntersectionObserver !== 'undefined') {
    intersectionObserver = new IntersectionObserver(scheduleRenderableSync);
    intersectionObserver.observe(element);
  }
});

onBeforeUnmount(() => {
  if (visibilityFrame !== undefined && hasDom()) {
    window.cancelAnimationFrame(visibilityFrame);
  }

  resizeObserver?.disconnect();
  intersectionObserver?.disconnect();
});
</script>

<template>
  <div
    ref="rootElement"
    class="VShadcnChartDonut v-shadcn-chart-donut"
  >
    <h3
      v-if="title"
      class="v-shadcn-chart-donut__title"
    >
      {{ title }}
    </h3>
    <p v-if="subtitle">
      {{ subtitle }}
    </p>
    <VisSingleContainer
      v-if="!noData"
      :key="chartRenderKey"
      :style="{ height: isMounted ? '100%' : 'auto' }"
      :margin="{ left: 20, right: 20 }"
      :data="data"
      class="is--margin-top-10"
    >
      <VisDonut
        :value="valueAccessor"
        :sort-function="sortFunction"
        :color="colors"
        :arc-width="type === 'donut' ? 20 : 0"
        :show-background="false"
        :events="events"
      />

      <Transition name="v-shadcn-chart-donut-readout">
        <div
          v-if="readout"
          :key="readout.key"
          class="v-shadcn-chart-donut__readout"
        >
          <span class="v-shadcn-chart-donut__readout-value">{{ readout.value }}</span>
          <span
            v-if="readout.name"
            class="v-shadcn-chart-donut__readout-name"
          >{{ readout.name }}</span>
        </div>
      </Transition>

      <slot />
    </VisSingleContainer>
    <p
      v-else
      class="is--no-data"
    >
      <slot name="no-data">
        No data available
      </slot>
    </p>
  </div>
</template>

<style lang="scss">
.v-shadcn-chart-donut {
  display: flex;
  flex-direction: column;
  width: 100%;
  min-height: 0;

  .unovis-single-container {
    position: relative;
  }

  &__readout {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    text-align: center;
    pointer-events: none;
  }

  &__readout-value {
    color: var(--foreground);
    font-size: 24px;
    font-weight: 700;
    line-height: 1.2;
  }

  &__readout-name {
    max-width: 50%;
    color: var(--muted-foreground);
    font-size: 14px;
    line-height: 1.3;
  }
}

.v-shadcn-chart-donut-readout-enter-active,
.v-shadcn-chart-donut-readout-leave-active {
  transition: opacity 0.2s ease;
}

.v-shadcn-chart-donut-readout-enter-from,
.v-shadcn-chart-donut-readout-leave-to {
  opacity: 0;
}
</style>
