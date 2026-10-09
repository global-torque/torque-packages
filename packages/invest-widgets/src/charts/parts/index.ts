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
    ...Array.from(new Array(primaryCount).keys()).map((i) => `color-mix(in srgb, var(--chart-1) ${(1 - (1 / primaryCount) * i) * 100}%, transparent)`),
    ...Array.from(new Array(secondaryCount).keys()).map((i) => `color-mix(in srgb, var(--chart-2) ${(1 - (1 / secondaryCount) * i) * 100}%, transparent)`),
  ];
}

export * from './interface';
