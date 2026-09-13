import { flushPromises, mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import { defineComponent, ref } from 'vue';
import VDialogContactUs from '../VDialogContactUs.vue';

vi.mock('@global-torque/invest-runtime/application-context', () => ({
  useInvestApplicationContext: () => ({
    appConfig: { brand: { email: 'invest@example.test' } },
  }),
}));

const Host = defineComponent({
  components: { VDialogContactUs },
  setup() {
    const open = ref(true);
    const submit = vi.fn();
    return { open, submit };
  },
  template: '<VDialogContactUs v-model:open="open" :submit-contact="submit" />',
});

describe('Contact dialog dismissal', () => {
  it.each(['close button', 'Escape'])('closes through the public dialog with %s without submitting', async (method) => {
    window.history.replaceState({}, '', '/dashboard/profile/1150/account?popup=contact-us');
    const wrapper = mount(Host, { attachTo: document.body });
    try {
      await flushPromises();
      const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
      expect(dialog).not.toBeNull();
      const close = dialog!.querySelector<HTMLButtonElement>('button[aria-label="Close"]');
      expect(close).not.toBeNull();
      expect(close!.getAttribute('data-slot')).toBe('dialog-close');
      expect(close!.getAttribute('type')).toBe('button');
      expect(dialog!.querySelectorAll('[data-slot="dialog-close"]')).toHaveLength(1);
      expect(close!.querySelector('.v-dialog-contact-us__close-approved path')?.getAttribute('d')).toBe('M15 5L5 15M5 5L15 15');
      expect(dialog!.contains(document.activeElement)).toBe(true);
      if (method === 'close button') close!.click();
      else document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await flushPromises();
      expect(wrapper.vm.open).toBe(false);
      expect(new URLSearchParams(window.location.search).has('popup')).toBe(false);
      expect(document.querySelector('[role="dialog"]')).toBeNull();
      expect(wrapper.vm.submit).not.toHaveBeenCalled();
    }
    finally {
      wrapper.unmount();
      window.history.replaceState({}, '', '/');
    }
  });
});
