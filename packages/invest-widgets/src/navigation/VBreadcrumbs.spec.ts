import { mount, RouterLinkStub } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import VBreadcrumbs from './VBreadcrumbs.vue';

describe('VBreadcrumbs', () => {
  it('retains host routes, encoded external links and the current-page contract', () => {
    const to = { name: 'profile', params: { id: 1150 } };
    const wrapper = mount(VBreadcrumbs, {
      props: { data: [
        { text: 'Profile', to },
        { text: 'Guide', href: '/investing guide' },
        { text: 'Personal information' },
      ] },
      global: { stubs: { RouterLink: RouterLinkStub } },
    });
    expect(wrapper.getComponent(RouterLinkStub).props('to')).toEqual(to);
    expect(wrapper.get('a[href="/investing%20guide"]').text()).toBe('Guide');
    expect(wrapper.get('[aria-current="page"]').text()).toBe('Personal information');
    expect(wrapper.get('[aria-current="page"]').attributes('aria-disabled')).toBe('true');
    const separators = wrapper.findAll('[data-slot="breadcrumb-separator"]');
    expect(separators).toHaveLength(2);
    expect(separators.every(separator => separator.attributes('aria-hidden') === 'true')).toBe(true);
    expect(separators.every(separator => separator.attributes('role') === 'presentation')).toBe(true);
  });

  it('keeps a caller-provided separator instead of the default decoration', () => {
    const wrapper = mount(VBreadcrumbs, {
      props: { data: [{ text: 'Start', href: '/' }, { text: 'Current' }] },
      slots: { default: '<span data-test="custom-separator">→</span>' },
    });
    expect(wrapper.get('[data-slot="breadcrumb-separator"] [data-test="custom-separator"]').text()).toBe('→');
    expect(wrapper.find('.v-breadcrumb__default-separator').exists()).toBe(false);
  });
});
