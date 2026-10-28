import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import VKycAlert from '../VKycAlert.vue';

describe('VKycAlert', () => {
  it('emits the description action event when Contact support is activated', async () => {
    const wrapper = mount(VKycAlert, {
      props: {
        description: 'Need help? <a href="#" data-action="contact-us">Contact support</a>',
      },
      global: {
        directives: {
          'dompurify-html': (element, binding) => {
            element.innerHTML = binding.value ?? '';
          },
        },
      },
    });
    const contactSupport = wrapper.get('a[data-action="contact-us"]');

    await contactSupport.trigger('click');

    const descriptionAction = wrapper.emitted('descriptionAction');
    expect(descriptionAction).toHaveLength(1);
    expect(descriptionAction?.[0]?.[0]).toBeInstanceOf(Event);
    expect((descriptionAction?.[0]?.[0] as Event).target).toBe(contactSupport.element);
  });
});
