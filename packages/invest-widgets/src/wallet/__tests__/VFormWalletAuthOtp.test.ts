import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import VFormWalletAuthOtp from '../VFormWalletAuthOtp.vue';

const mountForm = (codeValue = '') => mount(VFormWalletAuthOtp, {
  props: {
    codeValue,
    isBusy: false,
    isOtpStep: true,
    'onUpdate:codeValue': () => undefined,
  },
  global: {
    stubs: {
      VFormGroup: {
        template: '<div><slot :is-field-error="false" /></div>',
      },
      VFormInputOtp: true,
      VButton: {
        inheritAttrs: false,
        props: ['disabled', 'type'],
        template: '<button :type="type" :disabled="disabled"><slot /></button>',
      },
    },
  },
});

describe('VFormWalletAuthOtp', () => {
  it('keeps OTP verification disabled until all six digits are present', async () => {
    const wrapper = mountForm();
    const button = wrapper.get('button');

    expect(button.attributes('disabled')).toBeDefined();
    expect(button.text()).toBe('Continue');

    await wrapper.setProps({ codeValue: '12345' });
    expect(button.attributes('disabled')).toBeDefined();

    await wrapper.setProps({ codeValue: '123456' });
    expect(button.attributes('disabled')).toBeUndefined();
  });

  it('does not submit an incomplete OTP', async () => {
    const wrapper = mountForm('12345');

    await wrapper.get('form').trigger('submit');

    expect(wrapper.emitted('submit')).toBeUndefined();
  });

  it('submits a complete OTP', async () => {
    const wrapper = mountForm('123456');

    await wrapper.get('form').trigger('submit');

    expect(wrapper.emitted('submit')).toHaveLength(1);
  });
});
