/* @vitest-environment jsdom */
/* eslint-disable vue/one-component-per-file */

import { mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import { defineComponent, type PropType } from 'vue';

vi.mock('@unovis/vue', () => ({
  VisTooltip: defineComponent({
    name: 'VisTooltip',
    props: {
      triggers: {
        type: Object as PropType<Record<string, TooltipTemplate>>,
        required: true,
      },
    },
    template: '<div data-testid="vis-tooltip" />',
  }),
}));

vi.mock('./VChartTooltip.vue', () => ({
  default: defineComponent({
    name: 'VChartTooltip',
    props: {
      title: String,
      data: {
        type: Array as PropType<{ value: string }[]>,
        required: true,
      },
    },
    template: `
      <div>
        <span data-testid="tooltip-title">{{ title }}</span>
        <span data-testid="tooltip-value">{{ data[0].value }}</span>
      </div>
    `,
  }),
}));

import VChartSingleTooltip from './VChartSingleTooltip.vue';

type TooltipTemplate = (
  datum: Record<string, unknown>,
  index: number,
  elements: HTMLElement[],
) => string;

describe('VChartSingleTooltip', () => {
  it('prefers the original datum when donut arc metadata also contains the category key', () => {
    const valueFormatter = vi.fn((value: number) => `$${value}`);
    const wrapper = mount(VChartSingleTooltip, {
      props: { selector: 'segment', index: 'value', valueFormatter },
    });
    const triggers = wrapper.getComponent({ name: 'VisTooltip' }).props('triggers') as Record<string, TooltipTemplate>;
    const segment = document.createElement('div');
    const tooltip = triggers.segment({
      value: 999,
      index: 1,
      startAngle: 0,
      data: { name: 'Investment', value: 20 },
    }, 0, [segment]);
    expect(valueFormatter).toHaveBeenCalledExactlyOnceWith(20);
    expect(tooltip).toContain('<span data-testid="tooltip-title">$20</span>');
    expect(tooltip).toContain('<span data-testid="tooltip-value">$20</span>');
    expect(tooltip).not.toContain('NaN');
    wrapper.unmount();
  });

  it('formats a nested chart value in both the title and detail row', () => {
    const valueFormatter = vi.fn((value: number) => `${Math.round(value)}%`);
    const wrapper = mount(VChartSingleTooltip, {
      props: {
        selector: 'segment',
        index: 'percent',
        valueFormatter,
      },
    });

    const triggers = wrapper.getComponent({ name: 'VisTooltip' }).props('triggers') as Record<string, TooltipTemplate>;
    const segment = document.createElement('div');
    segment.style.fill = 'rgb(0, 79, 255)';

    const tooltip = triggers.segment({
      data: {
        name: 'City of Springfield 2025',
        percent: 70.00299970003,
      },
    }, 0, [segment]);

    expect(valueFormatter).toHaveBeenCalledOnce();
    expect(valueFormatter).toHaveBeenCalledWith(70.00299970003);
    expect(tooltip).toContain('<span data-testid="tooltip-title">70%</span>');
    expect(tooltip).toContain('<span data-testid="tooltip-value">70%</span>');
    expect(tooltip).not.toContain('70.00299970003');
  });
});
