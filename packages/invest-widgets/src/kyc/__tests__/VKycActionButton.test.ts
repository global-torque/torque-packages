import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { mount } from '@vue/test-utils';
import { computed } from 'vue';
import VKycActionButton from '../VKycActionButton.vue';
import {
  resetInvestWidgetProvidersForTests,
  setInvestWidgetProviders,
} from '../../providers.ts';

describe('VKycActionButton', () => {
  afterEach(() => {
    resetInvestWidgetProvidersForTests();
  });

  it('renders the mocked KYC CTA and delegates clicks to the provider', async () => {
    const onPrimaryAction = vi.fn();

    setInvestWidgetProviders({
      kyc: {
        useAlert: () => ({
          alertModel: computed(() => ({
            show: true,
            variant: 'error',
            title: 'Finish Your KYC',
            description: 'Complete verification.',
            buttonText: 'Continue',
            isLoading: false,
            isDisabled: false,
          })),
          isDataLoading: computed(() => false),
          onPrimaryAction,
          onDescriptionAction: vi.fn(),
        }),
      },
    });

    const wrapper = mount(VKycActionButton, {
      props: {
        size: 'large',
      },
      global: {
        stubs: {
          Button: {
            props: ['size', 'loading', 'disabled'],
            emits: ['click'],
            template: '<button class="kyc-button-stub" :data-size="size" @click="$emit(\'click\')"><slot /></button>',
          },
        },
      },
    });

    expect(wrapper.text()).toContain('Continue');
    expect(wrapper.get('.kyc-button-stub').attributes('data-size')).toBe('lg');

    await wrapper.get('.kyc-button-stub').trigger('click');

    expect(onPrimaryAction).toHaveBeenCalledTimes(1);
  });
});
