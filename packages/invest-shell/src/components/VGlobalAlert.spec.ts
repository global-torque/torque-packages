/* @vitest-environment jsdom */

import { enableAutoUnmount, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { nextTick } from 'vue';
import { useGlobalAlert } from '@global-torque/invest-runtime/global-alert';
import VGlobalAlert from './VGlobalAlert.vue';

describe('VGlobalAlert', () => {
  enableAutoUnmount(afterEach);

  beforeEach(() => {
    setActivePinia(createPinia());
    useGlobalAlert().show({
      title: 'Technical issue',
      message: 'A server error occurred.',
    });
  });

  afterEach(() => vi.restoreAllMocks());

  it('renders an alert with a named native dismiss button', () => {
    const wrapper = mount(VGlobalAlert);

    expect(wrapper.get('[role="alert"]').text()).toContain('A server error occurred.');
    expect(wrapper.get('button[type="button"]').attributes('aria-label')).toBe('Dismiss notification');
  });

  it('dismisses once from the close button and still supports alert-surface dismissal', async () => {
    const store = useGlobalAlert();
    const hide = vi.spyOn(store, 'hide');
    const wrapper = mount(VGlobalAlert);

    await wrapper.get('button[aria-label="Dismiss notification"]').trigger('click');
    expect(hide).toHaveBeenCalledTimes(1);
    expect(wrapper.find('[role="alert"]').exists()).toBe(false);

    store.show({ message: 'A second server error occurred.' });
    await nextTick();
    await wrapper.get('[role="alert"]').trigger('click');
    expect(hide).toHaveBeenCalledTimes(2);
    expect(wrapper.find('[role="alert"]').exists()).toBe(false);
  });
});
