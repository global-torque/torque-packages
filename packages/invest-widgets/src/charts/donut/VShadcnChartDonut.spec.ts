/* @vitest-environment jsdom */
/* eslint-disable vue/one-component-per-file */

import { Donut } from '@unovis/ts';
import { mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import { defineComponent, nextTick } from 'vue';

vi.mock('@unovis/vue', () => ({
  VisSingleContainer: defineComponent({ name: 'VisSingleContainer', template: '<div><slot /></div>' }),
  VisDonut: defineComponent({ name: 'VisDonut', props: { events: Object }, template: '<div />' }),
}));

import DonutChart from './VShadcnChartDonut.vue';

describe('DonutChart', () => {
  it('shows the hovered segment in the donut center until the pointer leaves', async () => {
    const data = [{ name: 'Equity', value: 60 }, { name: 'Debt', value: 40 }];
    const wrapper = mount(DonutChart, {
      props: { data, index: 'name', category: 'value', valueFormatter: (value: number) => `$${value}` },
    });
    const segment = wrapper.getComponent({ name: 'VisDonut' }).props('events')[Donut.selectors.segment];

    segment.mouseover({ data: data[1] });
    await nextTick();
    expect(wrapper.get('.v-shadcn-chart-donut__readout').text()).toContain('$40');
    expect(wrapper.get('.v-shadcn-chart-donut__readout').text()).toContain('Debt');

    segment.mouseleave();
    await nextTick();
    expect(wrapper.find('.v-shadcn-chart-donut__readout').exists()).toBe(false);
  });
});
