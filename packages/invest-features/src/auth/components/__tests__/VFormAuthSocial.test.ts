import { mount } from '@vue/test-utils';
import {
  describe,
  expect,
  it,
} from 'vitest';
import { defineComponent } from 'vue';
import VFormAuthSocial from '../VFormAuthSocial.vue';

const hostIcon = defineComponent({ template: '<svg aria-hidden="true" />' });
const socialIcons = {
  google: { icon: hostIcon, iconHover: hostIcon },
  github: { icon: hostIcon, iconHover: hostIcon },
  linkedin: { icon: hostIcon, iconHover: hostIcon },
} as const;

describe('VFormAuthSocial', () => {
  it('names icon-only social buttons and emits the selected provider', async () => {
    const wrapper = mount(VFormAuthSocial, { props: { socialIcons } });
    const buttons = wrapper.findAll('button');

    expect(buttons.map((button) => button.attributes('aria-label'))).toEqual([
      'Continue with Google',
      'Continue with GitHub',
      'Continue with LinkedIn',
    ]);
    expect(buttons.every((button) => button.attributes('type') === 'button')).toBe(true);

    await buttons[0]?.trigger('click');

    expect(wrapper.emitted('click')?.[0]).toEqual(['google']);
  });

  it.each([
    ['missing map', undefined],
    ['missing provider', { google: socialIcons.google, github: socialIcons.github }],
    ['missing normal icon', {
      ...socialIcons,
      linkedin: { iconHover: hostIcon },
    }],
    ['missing hover icon', {
      ...socialIcons,
      linkedin: { icon: hostIcon },
    }],
    ['empty icon pair', {
      ...socialIcons,
      linkedin: { icon: undefined, iconHover: undefined },
    }],
  ])('shows provider text for %s', (_caseName, icons) => {
    const wrapper = mount(VFormAuthSocial, {
      props: { socialIcons: icons } as never,
    });

    const linkedin = wrapper.findAll('button')[2];
    expect(linkedin?.text()).toBe('LinkedIn');
    expect(linkedin?.find('.social-form__item-icon').exists()).toBe(false);
    expect(linkedin?.find('.social-form__item-icon-hover').exists()).toBe(false);
  });
});
