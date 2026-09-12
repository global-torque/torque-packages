import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { mount } from '@vue/test-utils';
import { defineComponent } from 'vue';
import VNotificationsSidebarButton from '../VNotificationsSidebarButton.vue';
import {
  resetInvestWidgetProvidersForTests,
  setInvestWidgetProviders,
} from '../../providers.ts';

describe('VNotificationsSidebarButton', () => {
  afterEach(() => {
    resetInvestWidgetProvidersForTests();
  });

  it('loads data, opens the provider sidebar, and renders the provider badge', async () => {
    const loadData = vi.fn();
    const onSidebarToggle = vi.fn();
    const BadgeComponent = defineComponent({
      props: ['position', 'customClass'],
      template: '<span class="badge-provider" :data-position="position">3</span>',
    });
    const SidebarComponent = defineComponent({
      props: ['isStaticSite'],
      template: '<aside class="sidebar-provider" :data-static="isStaticSite">sidebar</aside>',
    });

    setInvestWidgetProviders({
      notifications: {
        useSidebar: () => ({
          BadgeComponent,
          SidebarComponent,
          loadData,
          onSidebarToggle,
        }),
      },
    });

    const wrapper = mount(VNotificationsSidebarButton, {
      props: {
        showIcon: true,
        isStaticSite: '1',
      },
    });

    expect(wrapper.get('.badge-provider').attributes('data-position')).toBe('absolute');

    await wrapper.trigger('click');

    expect(loadData).toHaveBeenCalledTimes(1);
    expect(onSidebarToggle).toHaveBeenCalledWith(true);
    expect(wrapper.get('.sidebar-provider').attributes('data-static')).toBe('1');
  });
});
