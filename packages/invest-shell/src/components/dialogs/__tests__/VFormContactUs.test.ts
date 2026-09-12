import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import VFormContactUs from '../VFormContactUs.vue';

const wrappers: ReturnType<typeof mount>[] = [];
beforeEach(() => window.history.replaceState({}, '', '/contact-us'));
afterEach(() => wrappers.splice(0).forEach(wrapper => wrapper.unmount()));

describe('contact field interactions', () => {
  it('hides authenticated dialog identity fields and submits session values instead of query prefill', async () => {
    window.history.replaceState({}, '', '/contact-us?popup=contact-us&name=Query+Person&email=query%40example.test&subject=wallet');
    const submitContact = vi.fn().mockResolvedValue(undefined);
    const wrapper = mount(VFormContactUs, { props: {
      submitContact, contactEmail: 'support@example.test', surface: 'dialog',
      sessionPrefill: { identityId: '1', name: ' Session Person ', email: ' session@example.test ' },
    } });
    wrappers.push(wrapper);
    await flushPromises();
    expect(wrapper.find('input[name="name"]:not([type="hidden"])').exists()).toBe(false);
    expect(wrapper.find('input[name="email"]:not([type="hidden"])').exists()).toBe(false);
    expect(wrapper.findAll('label').some(label => /^(Name|Email)\b/u.test(label.text()))).toBe(false);
    expect((wrapper.get('input[name="name"]').element as HTMLInputElement).value).toBe('Session Person');
    expect((wrapper.get('input[name="email"]').element as HTMLInputElement).value).toBe('session@example.test');
    await wrapper.get('textarea').setValue('Please help with my wallet.');
    expect((wrapper.get('button[type="submit"]').element as HTMLButtonElement).disabled).toBe(false);
    await wrapper.get('form').trigger('submit');
    await flushPromises();
    expect(submitContact).toHaveBeenCalledWith({
      name: 'Session Person', email: 'session@example.test', subject: 'wallet', message: 'Please help with my wallet.',
    });
    expect(wrapper.emitted('accepted')).toHaveLength(1);
  });

  it('updates hidden values on hydration and replacement, then restores empty editable fields on logout', async () => {
    const wrapper = mount(VFormContactUs, { props: {
      submitContact: vi.fn(), contactEmail: 'support@example.test', surface: 'dialog', subject: 'wallet',
    } });
    wrappers.push(wrapper);
    await flushPromises();
    await wrapper.get('input[name="name"]').setValue('Guest Draft');
    await wrapper.get('input[name="email"]').setValue('guest@example.test');
    await wrapper.get('textarea').setValue('Please help with my wallet.');
    await wrapper.setProps({ sessionPrefill: { identityId: '1', email: 'session@example.test' } });
    expect(wrapper.get('input[name="name"]').attributes('type')).toBe('hidden');
    expect((wrapper.get('input[name="name"]').element as HTMLInputElement).value).toBe('');
    expect((wrapper.get('input[name="email"]').element as HTMLInputElement).value).toBe('session@example.test');
    expect((wrapper.get('textarea').element as HTMLTextAreaElement).value).toBe('Please help with my wallet.');
    expect((wrapper.get('button[type="submit"]').element as HTMLButtonElement).disabled).toBe(false);
    await wrapper.setProps({ sessionPrefill: { identityId: '2', name: 'New Person', email: 'new@example.test' } });
    expect((wrapper.get('input[name="name"]').element as HTMLInputElement).value).toBe('New Person');
    expect((wrapper.get('input[name="email"]').element as HTMLInputElement).value).toBe('new@example.test');
    expect((wrapper.get('textarea').element as HTMLTextAreaElement).value).toBe('');
    await wrapper.setProps({ sessionPrefill: undefined });
    expect(wrapper.get('input[name="name"]').attributes('type')).not.toBe('hidden');
    expect(wrapper.get('input[name="email"]').attributes('type')).toBe('email');
    expect((wrapper.get('input[name="name"]').element as HTMLInputElement).value).toBe('');
    expect((wrapper.get('input[name="email"]').element as HTMLInputElement).value).toBe('');
  });

  it('explains invalid hidden account details without requiring a submission attempt', async () => {
    const submitContact = vi.fn();
    const wrapper = mount(VFormContactUs, { props: {
      submitContact, contactEmail: 'support@example.test', surface: 'dialog', subject: 'wallet',
      sessionPrefill: { identityId: '1', email: 'invalid' },
    } });
    wrappers.push(wrapper);
    await flushPromises();
    await wrapper.get('textarea').setValue('Please help with my wallet.');
    expect(wrapper.get('[role="alert"]').text()).toContain('account contact details are missing or invalid');
    expect((wrapper.get('button[type="submit"]').element as HTMLButtonElement).disabled).toBe(true);
    expect(wrapper.get('a').attributes('href')).toBe('mailto:support@example.test');
    await wrapper.get('form').trigger('submit');
    expect(submitContact).not.toHaveBeenCalled();
    await wrapper.setProps({ sessionPrefill: { identityId: '1', email: 'session@example.test' } });
    expect(wrapper.find('[role="alert"]').exists()).toBe(false);
    expect((wrapper.get('button[type="submit"]').element as HTMLButtonElement).disabled).toBe(false);
    await wrapper.get('form').trigger('submit');
    expect(submitContact).toHaveBeenCalledWith(expect.objectContaining({ name: '', email: 'session@example.test' }));
  });

  it.each([
    { surface: 'page' as const, sessionPrefill: { identityId: '1', name: 'Session Person', email: 'session@example.test' } },
    { surface: 'dialog' as const, sessionPrefill: undefined },
  ])('keeps name/email visible and editable for $surface without an authenticated dialog', async (props) => {
    window.history.replaceState({}, '', '/contact-us?name=Query+Person&email=query%40example.test&subject=wallet');
    const submitContact = vi.fn().mockResolvedValue(undefined);
    const wrapper = mount(VFormContactUs, { props: { submitContact, contactEmail: 'support@example.test', ...props } });
    wrappers.push(wrapper);
    await flushPromises();
    expect(wrapper.get('input[name="name"]').attributes('type')).not.toBe('hidden');
    expect(wrapper.get('input[name="email"]').attributes('type')).toBe('email');
    expect((wrapper.get('input[name="name"]').element as HTMLInputElement).value).toBe('Query Person');
    expect((wrapper.get('input[name="email"]').element as HTMLInputElement).value).toBe('query@example.test');
    await wrapper.get('input[name="name"]').setValue('Edited Person');
    await wrapper.get('input[name="email"]').setValue('edited@example.test');
    await wrapper.get('textarea').setValue('Please help with my wallet.');
    await wrapper.get('form').trigger('submit');
    expect(submitContact).toHaveBeenCalledWith(expect.objectContaining({ name: 'Edited Person', email: 'edited@example.test' }));
  });

  it('preserves an intentionally cleared query-prefilled field during session hydration', async () => {
    window.history.replaceState({}, '', '/contact-us?name=Query+Person&email=query%40example.test');
    const wrapper = mount(VFormContactUs, { props: { submitContact: vi.fn(), contactEmail: 'support@example.test' } });
    wrappers.push(wrapper);
    await flushPromises();
    await wrapper.get('input[name="name"]').setValue('');
    await wrapper.get('input[name="email"]').setValue('');
    await wrapper.setProps({ sessionPrefill: { identityId: '1', name: 'Session Person', email: 'session@example.test' } });
    expect((wrapper.get('input[name="name"]').element as HTMLInputElement).value).toBe('');
    expect((wrapper.get('input[name="email"]').element as HTMLInputElement).value).toBe('');
  });

  it('renders accessible failure feedback and preserves a retryable draft', async () => {
    const submitContact = vi.fn().mockRejectedValueOnce(new Error('unavailable')).mockResolvedValue(undefined);
    const wrapper = mount(VFormContactUs, { props: { submitContact, subject: 'wallet', contactEmail: 'support@example.test' } });
    wrappers.push(wrapper);
    await flushPromises();
    await wrapper.get('input[name="name"]').setValue('Test Person');
    await wrapper.get('input[name="email"]').setValue('test@example.test');
    await wrapper.get('textarea').setValue('Please help with my wallet.');
    await wrapper.get('form').trigger('submit');
    await flushPromises();
    expect(wrapper.get('[role="alert"]').text()).toContain('could not be submitted');
    expect((wrapper.get('textarea').element as HTMLTextAreaElement).value).toBe('Please help with my wallet.');
    expect(wrapper.get('a').attributes('href')).toBe('mailto:support@example.test');
    await wrapper.get('form').trigger('submit');
    await flushPromises();
    expect(wrapper.get('[role="status"]').text()).toBe('Your message has been submitted.');
    expect(wrapper.emitted('accepted')).toHaveLength(1);
  });
});
