import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { mount } from '@vue/test-utils';
import { computed } from 'vue';
import ProfileSwitchMenuList from '../ProfileSwitchMenuList.vue';
import {
  resetInvestWidgetProvidersForTests,
  setInvestWidgetProviders,
} from '../../providers.ts';

describe('ProfileSwitchMenuList', () => {
  afterEach(() => {
    resetInvestWidgetProvidersForTests();
  });

  it('renders provider profile items and delegates selection', async () => {
    const onSelectProfile = vi.fn();

    setInvestWidgetProviders({
      profiles: {
        useProfileSwitchMenu: () => ({
          selectedProfileLabel: computed(() => 'EN2: Growth SPV'),
          profileItems: computed(() => [
            {
              id: '2',
              label: 'EN2: Growth SPV',
              statusLabel: 'Eligible',
              statusVariant: 'success',
              isActive: true,
            },
            {
              id: 'new',
              label: 'Add a new investment profile',
              isActive: false,
              isCreateAction: true,
            },
          ]),
          onSelectProfile,
        }),
      },
    });

    const wrapper = mount(ProfileSwitchMenuList);

    expect(wrapper.text()).toContain('EN2: Growth SPV');
    expect(wrapper.get('[data-slot="badge"]').text()).toBe('Eligible');
    expect(wrapper.get('[data-slot="badge"]').classes()).toContain('badge-tone-success-soft');

    await wrapper.findAll('button')[1]!.trigger('click');

    expect(onSelectProfile).toHaveBeenCalledWith('new');
    expect(wrapper.emitted('select')).toEqual([['new']]);
  });

  it('uses explicit items without calling the provider select action', async () => {
    const onSelectProfile = vi.fn();

    setInvestWidgetProviders({
      profiles: {
        useProfileSwitchMenu: () => ({
          selectedProfileLabel: computed(() => 'Provider Profile'),
          profileItems: computed(() => []),
          onSelectProfile,
        }),
      },
    });

    const wrapper = mount(ProfileSwitchMenuList, {
      props: {
        items: [
          {
            id: '7',
            label: 'TR7: Trust Profile',
            isActive: false,
          },
        ],
      },
    });

    await wrapper.find('button').trigger('click');

    expect(onSelectProfile).not.toHaveBeenCalled();
    expect(wrapper.emitted('select')).toEqual([['7']]);
  });
});
