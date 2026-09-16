<script setup lang="ts">
import type { BulletLegendItemInterface } from '@unovis/ts';
import { VisTooltip } from '@unovis/vue';
import { type Component, createApp } from 'vue';
import VChartTooltip from './VChartTooltip.vue';

const props = withDefaults(defineProps<{
  selector: string;
  index: string;
  items?: BulletLegendItemInterface[];
  valueFormatter?:(tick: number, i?: number, ticks?: number[]) => string;
  customTooltip?: Component;
}>(), {
  valueFormatter: (tick: number) => `${tick}`,
});

// Use weakmap to store reference to each datapoint for Tooltip
type ChartDatum = Record<string, unknown>;
type NestedChartDatum = {
  data: ChartDatum & {
    name?: string;
  };
};

const wm = new WeakMap<object, string>();
function isNestedChartDatum(value: unknown): value is NestedChartDatum {
  return typeof value === 'object'
    && value !== null
    && 'data' in value
    && (value as NestedChartDatum).data !== null
    && typeof (value as NestedChartDatum).data === 'object';
}

function template(d: ChartDatum | NestedChartDatum, i: number, elements: (HTMLElement | SVGElement)[]) {
  const valueFormatter = props.valueFormatter ?? ((tick: number) => `${tick}`);
  // Donut arcs carry a `value` field as well as the original nested datum.
  const hasNestedValue = isNestedChartDatum(d)
    && Object.prototype.hasOwnProperty.call(d.data, props.index);
  if (!hasNestedValue && Object.prototype.hasOwnProperty.call(d, props.index)) {
    const datum = d as ChartDatum;

    if (wm.has(datum)) {
      return wm.get(datum);
    }

    const componentDiv = document.createElement('div');
    const omittedData = Object.entries(datum)
      .filter(([key]) => key !== props.index)
      .map(([key, value]) => {
      const legendReference = props.items?.find((item) => item.name === key);
      return { ...legendReference, value: valueFormatter(Number(value)) };
    });
    const TooltipComponent = props.customTooltip ?? VChartTooltip;
    // eslint-disable-next-line vue/one-component-per-file
    createApp(TooltipComponent, { title: datum[props.index], data: omittedData }).mount(componentDiv);
    wm.set(datum, componentDiv.innerHTML);
    return componentDiv.innerHTML;
  }

  else {
    if (!isNestedChartDatum(d)) {
      return '';
    }

    const { data } = d;

    if (wm.has(data)) {
      return wm.get(data)
    }
    else {
      const style = getComputedStyle(elements[i])
      const formattedValue = valueFormatter(Number(data[props.index]))
      const omittedData = [{ name: data.name, value: formattedValue, color: style.fill }]
      const componentDiv = document.createElement("div")
      const TooltipComponent = props.customTooltip ?? VChartTooltip
      // eslint-disable-next-line vue/one-component-per-file
      createApp(TooltipComponent, { title: formattedValue, data: omittedData }).mount(componentDiv)
      wm.set(data, componentDiv.innerHTML)
      return componentDiv.innerHTML
    }
  }
}
</script>

<template>
  <VisTooltip
    :horizontal-shift="20"
    :vertical-shift="20"
    :triggers="{
      [selector]: template,
    }"
    class="VChartSingleTooltip v-chart-single-tooltip"
  />
</template>
