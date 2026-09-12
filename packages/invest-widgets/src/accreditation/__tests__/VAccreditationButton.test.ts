import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { mount } from '@vue/test-utils';
import { computed } from 'vue';
import VAccreditationButton from '../VAccreditationButton.vue';
import {
  resetInvestWidgetProvidersForTests,
  setInvestWidgetProviders,
} from '../../providers.ts';

describe('VAccreditationButton', () => {
  afterEach(() => {
    resetInvestWidgetProvidersForTests();
  });

  it('renders mocked provider button data and triggers the provider action', async () => {
    const onClick = vi.fn();

    setInvestWidgetProviders({
      accreditation: {
        useAlert: () => ({
          alertModel: computed(() => ({
            show: false,
            variant: 'error',
            isLoading: false,
            isDisabled: false,
          })),
          isDataLoading: computed(() => false),
          onPrimaryAction: vi.fn(),
          onDescriptionAction: vi.fn(),
        }),
        useButton: () => ({
          data: computed(() => ({
            text: 'Verify Accreditation',
            mobileText: 'Verify',
            class: 'new',
            button: true,
          })),
          tagBackground: computed(() => 'red'),
          onClick,
        }),
      },
    });

    const wrapper = mount(VAccreditationButton, {
      global: {
        stubs: {
          Button: {
            emits: ['click'],
            template: '<button class="button-stub" @click="$emit(\'click\')"><slot /></button>',
          },
          VBadge: true,
          VTooltip: {
            template: '<div><slot /><slot name="content" /></div>',
          },
          VSkeleton: true,
        },
      },
    });

    expect(wrapper.text()).toContain('Verify Accreditation');

    await wrapper.find('.button-stub').trigger('click');

    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
