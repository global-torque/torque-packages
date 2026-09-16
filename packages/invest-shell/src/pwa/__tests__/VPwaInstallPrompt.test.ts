import {
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { shallowMount } from '@vue/test-utils';
import VPwaInstallPrompt from '../VPwaInstallPrompt.vue';

vi.mock('@global-torque/invest-runtime/application-context', () => ({
  useInvestApplicationContext: () => ({
    appConfig: { brand: { pwaName: 'Global Torque' } },
  }),
}));

const mountPrompt = (props: Record<string, unknown>) => shallowMount(VPwaInstallPrompt, {
  props: props as never,
  global: {
    stubs: {
      Alert: {
        template: '<section data-testid="alert"><slot /></section>',
      },
      AlertTitle: {
        template: '<h2><slot /></h2>',
      },
      AlertDescription: {
        template: '<p><slot /></p>',
      },
      Button: {
        props: ['loading', 'disabled', 'variant', 'color', 'size'],
        template: '<button :disabled="disabled" :data-variant="variant" :data-color="color" :data-loading="loading"><slot /></button>',
      },
    },
  },
});

describe('VPwaInstallPrompt', () => {
  it('hides itself when install state is hidden', () => {
    const wrapper = mountPrompt({
      canInstall: false,
      installState: 'hidden',
    });

    expect(wrapper.find('[data-testid="pwa-install-prompt"]').exists()).toBe(false);
  });

  it('renders the native install CTA and emits public events', async () => {
    const wrapper = mountPrompt({
      canInstall: true,
      installState: 'native',
    });

    expect(wrapper.text()).toContain('Install app');
    expect(wrapper.text()).toContain('Install Global Torque');

    const buttons = wrapper.findAll('button');
    expect(buttons).toHaveLength(2);
    expect(buttons[0].text()).toContain('Install');
    expect(buttons[1].text()).toContain('Not now');
    expect(buttons[1].attributes('data-variant')).toBe('link');

    await buttons[0].trigger('click');
    await buttons[1].trigger('click');

    expect(wrapper.emitted('install')).toHaveLength(1);
    expect(wrapper.emitted('dismiss')).toHaveLength(1);
  });

  it('renders manual iOS guidance when native install is unavailable', async () => {
    const wrapper = mountPrompt({
      canInstall: false,
      installState: 'manual-ios',
    });

    expect(wrapper.text()).toContain('Add to Home Screen');
    expect(wrapper.text()).toContain('Share menu in Safari');

    const buttons = wrapper.findAll('button');
    expect(buttons).toHaveLength(1);
    expect(buttons[0].text()).toContain('Got it');
    expect(buttons[0].attributes('data-variant')).toBe('link');

    await buttons[0].trigger('click');
    expect(wrapper.emitted('dismiss')).toHaveLength(1);
  });
});
