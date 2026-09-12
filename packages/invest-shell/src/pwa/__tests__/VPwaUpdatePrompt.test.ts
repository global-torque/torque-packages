import {
  describe,
  expect,
  it,
} from 'vitest';
import { shallowMount } from '@vue/test-utils';
import VPwaUpdatePrompt from '../VPwaUpdatePrompt.vue';

const mountPrompt = (props: Record<string, unknown>) => shallowMount(VPwaUpdatePrompt, {
  props: props as never,
  global: {
    stubs: {
      Alert: {
        props: ['variant'],
        template: '<section data-testid="alert" :data-variant="variant"><slot /></section>',
      },
      AlertTitle: { template: '<h2><slot /></h2>' },
      AlertDescription: { template: '<p><slot /></p>' },
      Button: {
        props: ['loading', 'disabled', 'variant', 'color', 'size'],
        template: '<button :disabled="disabled" :data-loading="loading" :data-variant="variant" :data-color="color"><slot /></button>',
      },
    },
  },
});

describe('VPwaUpdatePrompt', () => {
  it('hides itself while idle', () => {
    const wrapper = mountPrompt({
      isUpdateReady: false,
      isOfflineReady: false,
      lifecycleState: 'idle',
      hasRegistrationError: false,
      appVersion: '',
      appBuildTimestamp: '',
    });

    expect(wrapper.find('[data-testid="pwa-update-prompt"]').exists()).toBe(false);
  });

  it('renders the update-ready state and emits reload and dismiss-update', async () => {
    const wrapper = mountPrompt({
      isUpdateReady: true,
      isOfflineReady: false,
      lifecycleState: 'updateReady',
      hasRegistrationError: false,
      appVersion: 'build-123',
      appBuildTimestamp: '2026-04-03T12:34:56.000Z',
    });

    expect(wrapper.text()).toContain('App update available');
    expect(wrapper.text()).toContain('Current build: build-123 (built at Apr 3, 2026, 12:34 PM UTC)');

    const buttons = wrapper.findAll('button');
    expect(buttons).toHaveLength(2);

    await buttons[0].trigger('click');
    await buttons[1].trigger('click');

    expect(wrapper.emitted('reload')).toHaveLength(1);
    expect(wrapper.emitted('dismissUpdate')).toHaveLength(1);
  });

  it('keeps the update prompt visible and loading while reloading', () => {
    const wrapper = mountPrompt({
      isUpdateReady: false,
      isOfflineReady: false,
      lifecycleState: 'reloading',
      hasRegistrationError: false,
      appVersion: '',
      appBuildTimestamp: '',
    });

    const buttons = wrapper.findAll('button');
    expect(wrapper.text()).toContain('App update available');
    expect(buttons[0].attributes('disabled')).toBeDefined();
    expect(buttons[1].attributes('disabled')).toBeDefined();
  });

  it('renders offline-ready state and emits dismiss-offline-ready', async () => {
    const wrapper = mountPrompt({
      isUpdateReady: false,
      isOfflineReady: true,
      lifecycleState: 'offlineReady',
      hasRegistrationError: false,
      appVersion: '',
      appBuildTimestamp: '',
    });

    expect(wrapper.text()).toContain('Offline mode ready');
    expect(wrapper.find('[data-testid="alert"]').attributes('data-variant')).toBeUndefined();

    const button = wrapper.get('button');
    await button.trigger('click');

    expect(wrapper.emitted('dismissOfflineReady')).toHaveLength(1);
  });

  it('renders registration errors without interactive actions', () => {
    const wrapper = mountPrompt({
      isUpdateReady: false,
      isOfflineReady: false,
      lifecycleState: 'registrationError',
      hasRegistrationError: true,
      appVersion: '',
      appBuildTimestamp: '',
    });

    expect(wrapper.text()).toContain('Offline features unavailable');
    expect(wrapper.find('[data-testid="alert"]').attributes('data-variant')).toBe('destructive');
    expect(wrapper.findAll('button')).toHaveLength(0);
  });
});
