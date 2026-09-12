/* eslint-disable vue/one-component-per-file */

import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';
import {
  defineComponent,
  h,
  onMounted,
  reactive,
} from 'vue';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import VPageTopInfoAndTabs from './VPageTopInfoAndTabs.vue';

const routeState = reactive({
  fullPath: '/profile/1032/portfolio',
});

const routerPush = vi.fn();
const routerResolve = vi.fn((target: { name?: string } | string) => (
  typeof target === 'string'
    ? { fullPath: target }
    : {
        fullPath: target.name === 'ROUTE_DASHBOARD_SUMMARY'
          ? '/profile/1032/summary'
          : '/profile/1032/portfolio',
      }
));

vi.mock('vue-router', async () => {
  const actual = await vi.importActual<typeof import('vue-router')>('vue-router');

  return {
    ...actual,
    useRoute: () => routeState,
    useRouter: () => ({
      push: routerPush,
      resolve: routerResolve,
    }),
  };
});

enableAutoUnmount(afterEach);
afterEach(() => vi.unstubAllGlobals());

class ObservedResize {
  static instances: ObservedResize[] = [];
  targets = new Set<Element>();
  disconnect = vi.fn(() => this.targets.clear());

  constructor(readonly callback: ResizeObserverCallback) {
    ObservedResize.instances.push(this);
  }

  observe(target: Element) { this.targets.add(target); }
  unobserve(target: Element) { this.targets.delete(target); }
  resize() {
    if (this.targets.size) this.callback([], this as unknown as ResizeObserver);
  }
}

describe('VPageTopInfoAndTabs', () => {
  beforeEach(() => {
    routeState.fullPath = '/profile/1032/portfolio';
    routerPush.mockReset();
    routerResolve.mockClear();
  });

  it('tracks actual tab overflow edges without replacing public tab controls', async () => {
    const wrapper = mount(VPageTopInfoAndTabs, {
      props: {
        tab: 'portfolio',
        tabs: {
          portfolio: { value: 'portfolio', label: 'Portfolio' },
          summary: { value: 'summary', label: 'Summary' },
        },
      },
    });
    await flushPromises();
    const list = wrapper.get('[role="tablist"]');
    const element = list.element as HTMLElement;
    expect(element.style.getPropertyValue('--page-tabs-underline-width')).toBe('');
    Object.defineProperties(element, {
      clientWidth: { configurable: true, value: 200, writable: true },
      scrollWidth: { configurable: true, value: 600, writable: true },
    });
    await list.trigger('scroll');
    expect(wrapper.findAll('[role="tab"]')).toHaveLength(2);
    expect(wrapper.find('.v-page-top-info-and-tabs__edge--left').exists()).toBe(false);
    expect(wrapper.get('.v-page-top-info-and-tabs__edge--right').attributes('aria-hidden')).toBe('true');

    element.scrollLeft = 200;
    await list.trigger('scroll');
    expect(wrapper.findAll('.v-page-top-info-and-tabs__edge')).toHaveLength(2);

    element.scrollLeft = 400;
    await list.trigger('scroll');
    expect(wrapper.find('.v-page-top-info-and-tabs__edge--right').exists()).toBe(false);
    expect(wrapper.find('.v-page-top-info-and-tabs__edge--left').exists()).toBe(true);

    Object.defineProperty(element, 'clientWidth', { value: 600 });
    element.scrollLeft = 0;
    await list.trigger('scroll');
    expect(wrapper.findAll('.v-page-top-info-and-tabs__edge')).toHaveLength(0);
    wrapper.unmount();
  });

  it('retains the measured underline through viewport shrink and restores fitting edges on expansion', async () => {
    ObservedResize.instances = [];
    vi.stubGlobal('ResizeObserver', ObservedResize);
    const wrapper = mount(VPageTopInfoAndTabs, {
      props: {
        tab: 'summary',
        retainUnderlineExtent: true,
        tabs: { summary: { value: 'summary', label: 'Summary' } },
      },
    });
    await flushPromises();
    const list = wrapper.get('[role="tablist"]');
    const element = list.element as HTMLElement;
    let viewportWidth = 1250;
    // Model the browser's scroll bounds: the absolutely positioned underline
    // contributes its width even when all tab labels fit the smaller viewport.
    Object.defineProperties(element, {
      clientWidth: { configurable: true, get: () => viewportWidth },
      scrollWidth: {
        configurable: true,
        get: () => Math.max(viewportWidth,
          Number.parseFloat(element.style.getPropertyValue('--page-tabs-underline-width')) || 0),
      },
    });
    const resize = async () => {
      ObservedResize.instances.forEach(observer => observer.resize());
      await flushPromises();
    };
    await resize();
    expect(element.style.getPropertyValue('--page-tabs-underline-width')).toBe('1250px');
    expect(wrapper.findAll('.v-page-top-info-and-tabs__edge')).toHaveLength(0);

    viewportWidth = 1122;
    await resize();
    expect(element.scrollWidth).toBe(1250);
    expect(wrapper.find('.v-page-top-info-and-tabs__edge--right').exists()).toBe(true);
    element.scrollLeft = 128;
    await list.trigger('scroll');
    await flushPromises();
    expect(wrapper.find('.v-page-top-info-and-tabs__edge--right').exists()).toBe(false);
    expect(wrapper.find('.v-page-top-info-and-tabs__edge--left').exists()).toBe(true);

    viewportWidth = 1250;
    element.scrollLeft = 0;
    await resize();
    expect(wrapper.findAll('.v-page-top-info-and-tabs__edge')).toHaveLength(0);
    await wrapper.setProps({ retainUnderlineExtent: false });
    expect(element.style.getPropertyValue('--page-tabs-underline-width')).toBe('');
    expect(list.classes()).not.toContain('v-page-top-info-and-tabs__retained-underline');
    const observers = ObservedResize.instances.filter(observer => observer.targets.has(element));
    wrapper.unmount();
    expect(observers.every(observer => observer.disconnect.mock.calls.length > 0)).toBe(true);
    await resize();
  });

  it('centers only when opted in, follows selection and resize, and disconnects on unmount', async () => {
    ObservedResize.instances = [];
    vi.stubGlobal('ResizeObserver', ObservedResize);
    const wrapper = mount(VPageTopInfoAndTabs, {
      props: {
        tab: 'summary',
        tabs: {
          portfolio: { value: 'portfolio', label: 'Portfolio' },
          summary: { value: 'summary', label: 'Summary' },
          settings: { value: 'settings', label: 'Settings' },
        },
      },
    });
    await flushPromises();
    const list = wrapper.get('[role="tablist"]').element as HTMLElement;
    Object.defineProperties(list, {
      clientWidth: { configurable: true, value: 200, writable: true },
      scrollWidth: { configurable: true, value: 600 },
    });
    vi.spyOn(list, 'getBoundingClientRect').mockImplementation(() => ({ left: 15 } as DOMRect));
    const scrollTo = vi.fn((options: ScrollToOptions) => {
      list.scrollLeft = options.left ?? 0;
    });
    list.scrollTo = scrollTo;
    const offsets = [0, 300, 550];
    wrapper.findAll('[role="tab"]').forEach((tab, index) => {
      vi.spyOn(tab.element, 'getBoundingClientRect').mockImplementation(() => ({
        left: 15 + offsets[index]! - list.scrollLeft, width: 100,
      } as DOMRect));
    });
    const resize = () => ObservedResize.instances.forEach(observer => observer.resize());
    resize();
    await wrapper.setProps({ tab: 'settings' });
    expect(scrollTo).not.toHaveBeenCalled();

    await wrapper.setProps({ centerActiveTab: true, retainUnderlineExtent: true, tab: 'summary' });
    await flushPromises();
    expect(scrollTo).toHaveBeenLastCalledWith({ left: 250, behavior: 'smooth' });
    await wrapper.setProps({ tab: 'settings' });
    await flushPromises();
    expect(scrollTo).toHaveBeenLastCalledWith({ left: 400, behavior: 'smooth' });
    await wrapper.setProps({ tab: 'portfolio' });
    await flushPromises();
    expect(scrollTo).toHaveBeenLastCalledWith({ left: 0, behavior: 'smooth' });

    await wrapper.setProps({ tab: 'summary' });
    await flushPromises();
    Object.defineProperty(list, 'clientWidth', { value: 400 });
    resize();
    expect(scrollTo).toHaveBeenLastCalledWith({ left: 150, behavior: 'smooth' });
    scrollTo.mockClear();
    resize();
    expect(scrollTo).not.toHaveBeenCalled();
    expect(routerPush).not.toHaveBeenCalled();

    const observers = ObservedResize.instances.filter(observer => observer.targets.has(list));
    expect(observers.length).toBeGreaterThan(0);
    wrapper.unmount();
    expect(observers.every(observer => observer.disconnect.mock.calls.length > 0)).toBe(true);
    resize();
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('pushes the tab route when the selected tab changes', async () => {
    const wrapper = mount(VPageTopInfoAndTabs, {
      props: {
        tab: 'portfolio',
        tabs: {
          portfolio: {
            value: 'portfolio',
            label: 'Portfolio',
            to: '/profile/1032/account?tab=portfolio',
          },
          summary: {
            value: 'summary',
            label: 'Summary',
            to: '/profile/1032/account?tab=summary',
          },
        },
      },
      slots: {
        'top-info': '<div data-testid="top-info" />',
        'tabs-content': '<div data-testid="tabs-content" />',
      },
      global: {
        stubs: {
          Tabs: defineComponent({
            emits: ['update:modelValue'],
            template: `
              <div data-testid="tabs-root">
                <button
                  data-testid="switch-summary"
                  type="button"
                  @click="$emit('update:modelValue', 'summary')"
                >
                  Switch
                </button>
                <slot />
              </div>
            `,
          }),
          TabsList: defineComponent({
            template: '<div data-testid="tabs-list"><slot /></div>',
          }),
          TabsTrigger: defineComponent({
            props: {
              value: { type: String, required: false, default: '' },
            },
            template: '<button type="button"><slot /><slot name="subtitle" /></button>',
          }),
        },
      },
    });

    await wrapper.get('[data-testid="switch-summary"]').trigger('click');

    expect(routerPush).toHaveBeenCalledWith('/profile/1032/account?tab=summary');
  });

  it('does not push when the resolved route already matches the current URL', async () => {
    routeState.fullPath = '/profile/1032/account?tab=summary';

    const wrapper = mount(VPageTopInfoAndTabs, {
      props: {
        tab: 'summary',
        tabs: {
          summary: {
            value: 'summary',
            label: 'Summary',
            to: '/profile/1032/account?tab=summary',
          },
        },
      },
      slots: {
        'tabs-content': '<div data-testid="tabs-content" />',
      },
      global: {
        stubs: {
          Tabs: defineComponent({
            emits: ['update:modelValue'],
            template: `
              <div data-testid="tabs-root">
                <button
                  data-testid="switch-summary"
                  type="button"
                  @click="$emit('update:modelValue', 'summary')"
                >
                  Switch
                </button>
                <slot />
              </div>
            `,
          }),
          TabsList: defineComponent({
            template: '<div data-testid="tabs-list"><slot /></div>',
          }),
          TabsTrigger: defineComponent({
            props: {
              value: { type: String, required: false, default: '' },
            },
            template: '<button type="button"><slot /><slot name="subtitle" /></button>',
          }),
        },
      },
    });

    await wrapper.get('[data-testid="switch-summary"]').trigger('click');

    expect(routerPush).not.toHaveBeenCalled();
  });

  it('ignores the initial same-tab emit from Tabs', async () => {
    mount(VPageTopInfoAndTabs, {
      props: {
        tab: 'summary',
        tabs: {
          summary: {
            value: 'summary',
            label: 'Summary',
            to: '/profile/1032/account?tab=summary',
          },
        },
      },
      slots: {
        'tabs-content': '<div data-testid="tabs-content" />',
      },
      global: {
        stubs: {
          Tabs: defineComponent({
            emits: ['update:modelValue'],
            setup(_, { emit, slots }) {
              onMounted(() => {
                emit('update:modelValue', 'summary');
              });

              return () => h('div', { 'data-testid': 'tabs-root' }, slots.default?.());
            },
          }),
          TabsList: defineComponent({
            template: '<div data-testid="tabs-list"><slot /></div>',
          }),
          TabsTrigger: defineComponent({
            props: {
              value: { type: String, required: false, default: '' },
            },
            template: '<button type="button"><slot /><slot name="subtitle" /></button>',
          }),
        },
      },
    });

    expect(routerPush).not.toHaveBeenCalled();
  });
});
