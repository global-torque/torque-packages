/* @vitest-environment jsdom */
/* eslint-disable vue/one-component-per-file */

import { Donut } from '@unovis/ts';
import { mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import { defineComponent, nextTick, type PropType } from 'vue';

vi.mock('@unovis/vue', () => ({
  VisSingleContainer: defineComponent({
    name: 'VisSingleContainer',
    template: '<div><slot /></div>',
  }),
  VisDonut: defineComponent({
    name: 'VisDonut',
    props: {
      color: Array as PropType<string[]>,
      events: {
        type: Object as PropType<Record<string, Record<string, SegmentHandler>>>,
        required: true,
      },
      centralLabel: String,
      centralSubLabel: String,
    },
    setup: () => ({ Donut }),
    template: `
      <svg>
        <text :class="Donut.selectors.centralLabel">{{ centralLabel }}</text>
        <text :class="Donut.selectors.centralSubLabel">{{ centralSubLabel }}</text>
      </svg>
    `,
  }),
}));

import DonutChart from './VShadcnChartDonut.vue';

type Holding = { name: string; value: number };
type SegmentHandler = (datum: { data: Holding }) => void;
type FakeAnimation = {
  onfinish: (() => void) | null;
  cancel: ReturnType<typeof vi.fn>;
  finish: () => void;
};

describe('DonutChart', () => {
  it('shows the hovered segment in the center and keeps a clicked segment there with the others dimmed', async () => {
    const data: Holding[] = [
      { name: 'Equity', value: 60 },
      { name: 'Debt', value: 40 },
    ];
    const wrapper = mount(DonutChart, {
      props: {
        data,
        index: 'name',
        category: 'value',
        colors: ['var(--chart-1)', 'var(--chart-2)'],
        valueFormatter: (value: number) => `$${value}`,
        showCenter: false,
      },
    });
    const donut = () => wrapper.getComponent({ name: 'VisDonut' });
    const segment = donut().props('events')[Donut.selectors.segment];

    segment.mouseover({ data: data[1] });
    await nextTick();
    expect(donut().props('centralLabel')).toBe('$40');
    expect(donut().props('centralSubLabel')).toBe('Debt');

    segment.mouseleave({ data: data[1] });
    await nextTick();
    expect(donut().props('centralLabel')).toBe('');
    expect(donut().props('centralSubLabel')).toBe('');

    segment.mouseover({ data: data[0] });
    segment.click({ data: data[0] });
    segment.mouseleave({ data: data[0] });
    await nextTick();
    expect(donut().props('centralLabel')).toBe('$60');
    expect(donut().props('centralSubLabel')).toBe('Equity');
    expect(donut().props('color')).toEqual([
      'var(--chart-1)',
      'color-mix(in srgb, var(--chart-2) 20%, transparent)',
    ]);

    wrapper.unmount();
  });

  it('keeps the center text until its fade-out ends and cancels a pending fade-out on a new hover', async () => {
    const animations: FakeAnimation[] = [];
    const animate = vi.fn(() => {
      const animation: FakeAnimation = {
        onfinish: null,
        cancel: vi.fn(),
        finish: () => animation.onfinish?.(),
      };
      animations.push(animation);
      return animation;
    });
    const originalAnimate = Element.prototype.animate;
    Element.prototype.animate = animate as unknown as Element['animate'];

    try {
      const data: Holding[] = [
        { name: 'Equity', value: 60 },
        { name: 'Debt', value: 40 },
      ];
      const wrapper = mount(DonutChart, {
        props: {
          data,
          index: 'name',
          category: 'value',
          valueFormatter: (value: number) => `$${value}`,
          showCenter: false,
        },
      });
      const label = () => wrapper.get(`.${Donut.selectors.centralLabel}`).text();
      const segment = wrapper.getComponent({ name: 'VisDonut' }).props('events')[Donut.selectors.segment];

      segment.mouseover({ data: data[0] });
      await nextTick();
      let fadeOutStart = animations.length;
      segment.mouseleave({ data: data[0] });
      await nextTick();
      expect(label()).toBe('$60');

      animations.slice(fadeOutStart).forEach((animation) => animation.finish());
      await nextTick();
      expect(label()).toBe('');

      segment.mouseover({ data: data[0] });
      await nextTick();
      fadeOutStart = animations.length;
      segment.mouseleave({ data: data[0] });
      const pendingFadeOut = animations.slice(fadeOutStart);
      segment.mouseover({ data: data[1] });
      pendingFadeOut.forEach((animation) => animation.finish());
      await nextTick();
      expect(pendingFadeOut.length).toBeGreaterThan(0);
      pendingFadeOut.forEach((animation) => expect(animation.cancel).toHaveBeenCalled());
      expect(label()).toBe('$40');

      wrapper.unmount();
    } finally {
      if (originalAnimate) Element.prototype.animate = originalAnimate;
      else Reflect.deleteProperty(Element.prototype, 'animate');
    }
  });
});
