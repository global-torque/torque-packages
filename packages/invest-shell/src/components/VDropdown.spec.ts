/* @vitest-environment jsdom */

import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';
import { createMemoryHistory, createRouter } from 'vue-router';
import { defineComponent, h, ref } from 'vue';
import { afterEach, describe, expect, it, vi } from 'vitest';
import VDropdown from './VDropdown.vue';

const mountOpenDropdown = (menu: Array<{ text: string; href?: string; to?: string }>, router?: ReturnType<typeof createRouter>) => {
  const open = ref(true);
  const Host = defineComponent({
    setup() {
      return () => h(VDropdown, {
        menu,
        open: open.value,
        'onUpdate:open': (value: boolean) => { open.value = value; },
      }, {
        default: () => h('span', 'Open menu'),
      });
    },
  });

  const wrapper = mount(Host, {
    attachTo: document.body,
    global: router ? { plugins: [router] } : undefined,
  });

  return { open, wrapper };
};

afterEach(() => {
  document.body.innerHTML = '';
});
enableAutoUnmount(afterEach);

describe('VDropdown', () => {
  it.each(['Enter', ' '])('activates the full href menu item with %j and dismisses the menu', async (key) => {
    const { open } = mountOpenDropdown([{ text: 'Dashboard', href: '/dashboard' }]);
    await flushPromises();
    const item = document.body.querySelector('[role="menuitem"]');
    expect(item?.tagName).toBe('A');
    expect(item?.getAttribute('href')).toBe('/dashboard');

    const activated = vi.fn((event: Event) => event.preventDefault());
    item?.addEventListener('click', activated);
    await item?.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
    await flushPromises();

    expect(activated).toHaveBeenCalledTimes(1);
    expect(open.value).toBe(false);
    expect(document.body.querySelector('[role="menuitem"]')).toBeNull();
  });

  it('transitions a RouterLink destination and dismisses the menu', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', component: { render: () => h('div') } },
        { path: '/profile', component: { render: () => h('div') } },
      ],
    });
    await router.push('/');
    await router.isReady();

    const { open } = mountOpenDropdown([{ text: 'Profile', to: '/profile' }], router);
    await flushPromises();
    const item = document.body.querySelector('[role="menuitem"]');
    expect(item?.tagName).toBe('A');
    expect(item?.getAttribute('href')).toBe('/profile');

    await item?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    await flushPromises();

    expect(router.currentRoute.value.path).toBe('/profile');
    expect(open.value).toBe(false);
    expect(document.body.querySelector('[role="menuitem"]')).toBeNull();
  });
});
