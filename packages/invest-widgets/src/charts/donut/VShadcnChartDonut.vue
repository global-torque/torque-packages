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
  watch,
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
const hoveredSegmentKey = ref<string>();
const activeSegmentKey = ref<string>();
let resizeObserver: ResizeObserver | undefined;
let intersectionObserver: IntersectionObserver | undefined;
let visibilityFrame: number | undefined;
let wasRenderable = false;
let readoutFadeOut: Animation[] = [];
const colors = computed(() => (
  props.colors?.length
  ? props.colors
  : defaultColors(props.data.filter((d) => d[props.category]).filter(Boolean).length)
));
const findSegment = (key?: string) => (
  key === undefined ? undefined : props.data.find((item) => item[index.value] === key)
);
// Unovis resets segment opacity on every donut re-render, such as a center label
// change, so the click emphasis dims the other segments through their fill.
const segmentColors = computed(() => {
  const activeKey = activeSegmentKey.value;
  if (!findSegment(activeKey)) return colors.value;

  return props.data.map((item, i) => {
    const color = colors.value[i % colors.value.length];
    return item[index.value] === activeKey
      ? color
      : `color-mix(in srgb, ${color} ${props.filterOpacity * 100}%, transparent)`;
  });
});

const totalValue = computed(() => props.data.reduce((prev, curr) => prev + curr[props.category], 0));
const noData = computed(() => props.data.length === 0)

// The hovered segment leads. While nothing is hovered, the clicked segment shows.
const readoutSegment = computed(() => findSegment(hoveredSegmentKey.value) ?? findSegment(activeSegmentKey.value));
const centralLabel = computed(() => {
  if (props.type !== 'donut') return '';
  if (readoutSegment.value) return valueFormatter(readoutSegment.value[category.value]);
  return props.showCenter ? valueFormatter(totalValue.value) : '';
});
const centralSubLabel = computed(() => (
  props.type === 'donut' && readoutSegment.value ? String(readoutSegment.value[index.value]) : ''
));

const hasDom = () => typeof window !== 'undefined';
const prefersReducedMotion = () => hasDom() && window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches === true;
const readoutLabels = () => Array.from(rootElement.value?.querySelectorAll(
  `.${Donut.selectors.centralLabel}, .${Donut.selectors.centralSubLabel}`,
) ?? []);
const stopReadoutFadeOut = () => {
  readoutFadeOut.forEach((animation) => {
    animation.onfinish = null;
    animation.cancel();
  });
  readoutFadeOut = [];
};

const events = {
  [Donut.selectors.segment]: {
    mouseover: (d: { data: Data }) => {
      stopReadoutFadeOut();
      hoveredSegmentKey.value = d.data[index.value];
    },
    // Unovis clears the center text in the same render, so the hovered key stays
    // until the text has faded out.
    mouseleave: () => {
      stopReadoutFadeOut();
      const labels = readoutLabels();
      const fallbackKey = findSegment(activeSegmentKey.value)?.[index.value];
      if (
        fallbackKey === readoutSegment.value?.[index.value]
        || !labels.length
        || prefersReducedMotion()
        || labels.some((label) => typeof label.animate !== 'function')
      ) {
        hoveredSegmentKey.value = undefined;
        return;
      }

      readoutFadeOut = labels.map((label) => label.animate(
        [{ opacity: 1 }, { opacity: 0 }],
        { duration: 200, easing: 'ease-in', fill: 'forwards' },
      ));
      readoutFadeOut[0].onfinish = () => {
        hoveredSegmentKey.value = undefined;
      };
    },
    click: (d: { data: Data }) => {
      const key = d.data[index.value];
      activeSegmentKey.value = key === activeSegmentKey.value ? undefined : key;
    },
  },
};

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

// The center text fades in, so a new readout does not pop in.
watch(() => readoutSegment.value?.[index.value], () => {
  // The new text is in the DOM now, so drop a finished fill-forwards fade-out.
  stopReadoutFadeOut();
  if (!centralLabel.value || !hasDom() || prefersReducedMotion()) return;

  readoutLabels().forEach((label) => {
    label.animate?.([{ opacity: 0 }, { opacity: 1 }], { duration: 200, easing: 'ease-out' });
  });
}, { flush: 'post' });

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
  stopReadoutFadeOut();
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
        :value="(d: Data) => d[category]"
        :sort-function="sortFunction"
        :color="segmentColors"
        :arc-width="type === 'donut' ? 20 : 0"
        :show-background="false"
        :central-label="centralLabel"
        :central-sub-label="centralSubLabel"
        :events="events"
      />

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
  --vis-font-family: var(--font-sans);
  --vis-donut-central-label-text-color: var(--foreground);
  --vis-donut-central-label-font-size: 24px;
  --vis-donut-central-label-font-weight: 700;
  --vis-donut-central-sub-label-text-color: var(--muted-foreground);
  --vis-donut-central-sub-label-font-size: 14px;

  display: flex;
  flex-direction: column;
  width: 100%;
  min-height: 0;
}
</style>
