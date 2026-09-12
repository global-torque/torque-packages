export { default as VChartCrosshair } from './VChartCrosshair.vue';
export { default as VChartLegend } from './VChartLegend.vue';
export { default as VChartSingleTooltip } from './VChartSingleTooltip.vue';
export { default as VChartTooltip } from './VChartTooltip.vue';

export function defaultColors(count: number = 3) {
  const quotient = Math.floor(count / 2);
  const remainder = count % 2;

  const primaryCount = quotient + remainder;
  const secondaryCount = quotient;
  return [
    ...Array.from(new Array(primaryCount).keys()).map((i) => `hsl(var(--vis-primary-color) / ${1 - (1 / primaryCount) * i})`),
    ...Array.from(new Array(secondaryCount).keys()).map((i) => `hsl(var(--vis-secondary-color) / ${1 - (1 / secondaryCount) * i})`),
  ];
}

export * from './interface';
