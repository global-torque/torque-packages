/* @vitest-environment jsdom */
/* eslint-disable vue/one-component-per-file */

import { mount, flushPromises } from '@vue/test-utils';
import {
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { defineComponent } from 'vue';
import { VFormSelect } from '@global-torque/ui-kit/form';
import VDialogContactUs from '../VDialogContactUs.vue';

vi.mock('@global-torque/ui-kit/query-dialog', () => ({
  VQueryDialog: defineComponent({
    name: 'VQueryDialog',
    props: {
      open: { type: Boolean, default: false },
    },
    template: '<div data-testid="dialog"><slot /></div>',
  }),
}));
vi.mock('@global-torque/ui-primitives/dialog', () => ({
  DialogClose: defineComponent({
    name: 'DialogClose',
    template: '<div><slot /></div>',
  }),
  DialogContent: defineComponent({
    name: 'DialogContent',
    template: '<section><slot /></section>',
  }),
  DialogHeader: defineComponent({
    name: 'DialogHeader',
    template: '<header><slot /></header>',
  }),
  DialogTitle: defineComponent({
    name: 'DialogTitle',
    template: '<h2><slot /></h2>',
  }),
}));

const brand = vi.hoisted(() => ({ email: 'invest@example.test' }));

vi.mock('@global-torque/invest-runtime/application-context', () => ({
  useInvestApplicationContext: () => ({
    appConfig: { brand },
  }),
}));

describe('VDialogContactUs', () => {
  it('uses the neutral popper placement by default', () => {
    const wrapper = mount(VDialogContactUs, { props: { open: true, submitContact: vi.fn() } });
    expect(wrapper.getComponent(VFormSelect).props('contentPosition')).toBe('popper');
    wrapper.unmount();
  });

  it('accepts a host-selected subject placement', () => {
    const wrapper = mount(VDialogContactUs, {
      props: { open: true, submitContact: vi.fn(), subjectPosition: 'item-aligned' },
    });
    expect(wrapper.getComponent(VFormSelect).props('contentPosition')).toBe('item-aligned');
    wrapper.unmount();
  });

  it('renders the shared contact form with the caller subject and support email', async () => {
    const wrapper = mount(VDialogContactUs, {
      props: {
        open: true,
        subject: 'investment',
        submitContact: vi.fn().mockResolvedValue(undefined),
      },
    });

    await flushPromises();
    expect(wrapper.find('form').exists()).toBe(true);
    expect(wrapper.find('input[name=\"name\"]').exists()).toBe(true);
    expect(wrapper.find('textarea[name=\"message\"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('Investment');
    expect(wrapper.text()).toContain('Submit');
    expect(wrapper.get('a').attributes('href')).toBe('mailto:invest@example.test');
  });
});
