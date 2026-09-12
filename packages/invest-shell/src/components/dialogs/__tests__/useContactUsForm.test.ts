import { mount } from '@vue/test-utils';
import { defineComponent, nextTick, reactive } from 'vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { contactUsSubjects, useContactUsForm } from '../useContactUsForm';
import type { ContactUsSessionPrefill } from '../useContactUsForm';

const wrappers: ReturnType<typeof mount>[] = [];
function setup(overrides: { active?: boolean;
  subject?: string;
  session?: ContactUsSessionPrefill;
  surface?: 'dialog' | 'page'; } = {}) {
  const props = reactive({ active: true, subject: undefined as string | undefined, session: undefined as ContactUsSessionPrefill | undefined, surface: 'dialog' as 'dialog' | 'page', ...overrides });
  const request = vi.fn().mockResolvedValue(undefined);
  const accepted = vi.fn();
  let form!: ReturnType<typeof useContactUsForm>;
  const wrapper = mount(defineComponent({
    setup() {
      form = useContactUsForm({
        active: () => props.active,
        subject: () => props.subject,
        session: () => props.session,
        surface: props.surface,
        submit: request,
        accepted,
      });
      return () => null;
    },
  }));
  wrappers.push(wrapper);
  return { form, props, request, accepted, wrapper };
}
function fill(form: ReturnType<typeof useContactUsForm>) {
  Object.assign(form.model, { name: '  Ada   Lovelace  ', email: ' ada@example.test ', subject: 'Investment', message: '  Please provide investment details.  ' });
}
beforeEach(() => {
  window.history.replaceState({}, '', '/contact-us');
});
afterEach(() => {
  wrappers.splice(0).forEach(wrapper => wrapper.unmount());
});

describe('contact form command', () => {
  it.each(contactUsSubjects)('accepts and canonicalizes $value', async ({ value }) => {
    const { form, request } = setup();
    fill(form);
    form.model.subject = value.toUpperCase();
    await form.submit();
    expect(request).toHaveBeenCalledWith({ name: 'Ada   Lovelace', email: 'ada@example.test', subject: value, message: 'Please provide investment details.' });
    expect(Object.isFrozen(request.mock.calls[0][0])).toBe(true);
    expect(form.submitted.value).toBe(true);
    expect(form.model.name).toBe('');
  });

  it.each([
    ['name', ' A '], ['name', 'A'.repeat(101)], ['name', `A ${'B'.repeat(101)}`],
    ['email', 'invalid'], ['email', `${'a'.repeat(250)}@b.com`], ['subject', 'unknown'], ['message', ' short '],
  ])('rejects invalid %s', async (field, value) => {
    const { form, request } = setup();
    fill(form);
    Object.assign(form.model, { [field]: value });
    await form.submit();
    expect(request).not.toHaveBeenCalled();
    expect(form.valid.value).toBe(false);
  });

  it('validates the serialized first/last name rather than original whitespace', async () => {
    const { form, request } = setup();
    fill(form);
    form.model.name = `${'A'.repeat(100)}     ${'B'.repeat(100)}`;
    await form.submit();
    expect(request).toHaveBeenCalledOnce();
  });

  it('uses current session identity for an authenticated dialog despite query or draft values', async () => {
    window.history.replaceState({}, '', '/contact-us?popup=contact-us&name=Query+Person&email=query%40example.test');
    const { form, request } = setup({ session: { identityId: '1', name: ' Session   Person ', email: ' session@example.test ' } });
    fill(form);
    await form.submit();
    expect(request).toHaveBeenCalledWith({
      name: 'Session   Person', email: 'session@example.test', subject: 'investment', message: 'Please provide investment details.',
    });
    expect(form.hideIdentityFields.value).toBe(true);
    expect(window.location.search).toBe('?popup=contact-us');
  });

  it.each([undefined, '', ' A '])('permits an authenticated dialog session name of %s', async (name) => {
    const { form, request } = setup({ session: { identityId: '1', name, email: 'session@example.test' } });
    fill(form);
    await form.submit();
    expect(request).toHaveBeenCalledWith(expect.objectContaining({ name: name?.trim() ?? '', email: 'session@example.test' }));
    expect(form.identityError.value).toBe('');
  });

  it.each([
    { name: 'A'.repeat(101), email: 'session@example.test' },
    { name: `A ${'B'.repeat(101)}`, email: 'session@example.test' },
    { name: 'Session Person', email: undefined },
    { name: 'Session Person', email: 'invalid' },
    { name: 'Session Person', email: `${'a'.repeat(250)}@b.com` },
  ])('rejects invalid hidden session contact details with visible feedback: %j', async (session) => {
    const { form, request } = setup({ session: { identityId: '1', ...session } });
    fill(form);
    await form.submit();
    expect(request).not.toHaveBeenCalled();
    expect(form.valid.value).toBe(false);
    expect(form.identityError.value).toContain('account contact details');
  });

  it('accepts serialized session first/last name limits and later trait updates', async () => {
    const { form, props, request } = setup({ session: { identityId: '1', name: 'Old Name', email: 'old@example.test' } });
    fill(form);
    props.session = { identityId: '1', name: `${'A'.repeat(100)}     ${'B'.repeat(100)}`, email: 'new@example.test' };
    await form.submit();
    expect(request).toHaveBeenCalledWith(expect.objectContaining({ name: props.session.name, email: 'new@example.test' }));
  });

  it.each([
    { surface: 'page' as const, session: { identityId: '1', name: 'Session Person', email: 'session@example.test' } },
    { surface: 'dialog' as const, session: undefined },
  ])('retains editable identity validation on $surface without an authenticated dialog', async (options) => {
    const { form, request } = setup(options);
    fill(form);
    form.model.name = '';
    await form.submit();
    expect(request).not.toHaveBeenCalled();
    expect(form.hideIdentityFields.value).toBe(false);
    expect(form.errors.value.name).toContain('at least two');
    expect(form.identityError.value).toBe('');
    form.model.name = 'Draft Person';
    await form.submit();
    expect(request).toHaveBeenCalledWith(expect.objectContaining({ name: 'Draft Person', email: 'ada@example.test' }));
  });

  it('consumes legacy prefill once, preserves unrelated URL and caller precedence', async () => {
    window.history.replaceState({ test: 1 }, '', '/contact-us?popup=contact-us&name=Query+Name&email=query%40example.test&subject=other&message=Legacy+message&tab=timeline#history');
    const { form } = setup({ subject: 'WALLET', session: { identityId: '1', name: 'Session', email: 'session@example.test' } });
    expect(form.model).toEqual({ name: 'Query Name', email: 'query@example.test', subject: 'wallet', message: 'Legacy message' });
    expect(window.location.search).toBe('?popup=contact-us&tab=timeline');
    expect(window.location.hash).toBe('#history');
    expect(window.history.state).toEqual({ test: 1 });
    form.model.message = 'private typing';
    await nextTick();
    expect(window.location.href).not.toContain('private');
  });

  it('ignores empty query traits and unrecognized caller subjects', () => {
    window.history.replaceState({}, '', '/contact-us?name=++&email=&subject=OFFERS');
    const { form } = setup({ subject: 'invalid', session: { name: 'Session Name', email: 'session@example.test' } });
    expect(form.model.name).toBe('Session Name');
    expect(form.model.email).toBe('session@example.test');
    expect(form.model.subject).toBe('offers');
  });

  it('requires selection for unknown subjects', () => {
    window.history.replaceState({}, '', '/contact-us?subject=unknown');
    expect(setup({ subject: 'unknown' }).form.model.subject).toBe('');
  });

  it('closed dialogs and pages behind a query dialog do not consume prefill', () => {
    window.history.replaceState({}, '', '/contact-us?popup=contact-us&name=Keep');
    setup({ active: false });
    setup({ surface: 'page' });
    expect(window.location.search).toContain('name=Keep');
  });

  it('fills delayed session hydration only into untouched empty fields', async () => {
    const { form, props } = setup({ surface: 'page' });
    form.touched.name = true;
    form.model.name = '';
    props.session = { identityId: '1', name: 'Session Name', email: 'session@example.test' };
    await nextTick();
    expect(form.model.name).toBe('');
    expect(form.model.email).toBe('session@example.test');
    form.model.email = 'my-edit@example.test';
    props.session = { ...props.session, email: 'changed@example.test' };
    await nextTick();
    expect(form.model.email).toBe('my-edit@example.test');
  });

  it.each(['resolve', 'reject'])('ignores stale guest %s on auth hydration while retaining subject and message', async (result) => {
    const { form, props, request, accepted } = setup();
    fill(form);
    let finish!: () => void;
    request.mockImplementationOnce(() => new Promise<void>((resolve, reject) => {
      finish = () => result === 'resolve' ? resolve() : reject(new Error('offline'));
    }));
    const pending = form.submit();
    props.session = { identityId: '1', email: 'session@example.test' };
    finish();
    await pending;
    expect(accepted).not.toHaveBeenCalled();
    expect(form.pending.value).toBe(false);
    expect(form.error.value).toBe('');
    expect(form.model.subject).toBe('Investment');
    expect(form.model.message).toContain('investment details');
    expect(form.hideIdentityFields.value).toBe(true);
    await form.submit();
    expect(request).toHaveBeenLastCalledWith(expect.objectContaining({ name: '', email: 'session@example.test', subject: 'investment' }));
    expect(accepted).toHaveBeenCalledOnce();
  });

  it.each([undefined, { identityId: '2', name: 'New Person', email: 'new@example.test' }])('resets a previous identity draft on logout or replacement', async (session) => {
    const { form, props, request, accepted } = setup({ session: { identityId: '1', name: 'Old Person', email: 'old@example.test' } });
    fill(form);
    let resolve!: () => void;
    request.mockImplementation(() => new Promise<void>((done) => {
      resolve = done;
    }));
    const pending = form.submit();
    props.session = session;
    resolve();
    await pending;
    expect(accepted).not.toHaveBeenCalled();
    expect(form.model.message).toBe('');
    expect(form.model.name).toBe(session?.name ?? '');
    expect(form.model.email).toBe(session?.email ?? '');
    expect(form.hideIdentityFields.value).toBe(Boolean(session?.identityId));
    expect(form.pending.value).toBe(false);
  });

  it('guards double submission and freezes the in-flight snapshot', async () => {
    const { form, request } = setup();
    fill(form);
    let resolve!: () => void;
    request.mockImplementation(() => new Promise<void>((done) => {
      resolve = done;
    }));
    const pending = form.submit();
    await form.submit();
    form.model.message = 'new text';
    expect(request).toHaveBeenCalledOnce();
    expect(request.mock.calls[0][0].message).toBe('Please provide investment details.');
    resolve();
    await pending;
  });

  it('preserves values on failure and allows explicit retry', async () => {
    const { form, request, accepted } = setup();
    fill(form);
    request.mockRejectedValueOnce(new Error('offline'));
    await form.submit();
    expect(form.error.value).toContain('could not');
    expect(form.model.message).toContain('investment');
    expect(accepted).not.toHaveBeenCalled();
    await form.submit();
    expect(accepted).toHaveBeenCalledOnce();
    expect(form.error.value).toBe('');
  });

  it.each(['resolve', 'reject'])('ignores stale %s after close and reopen', async (result) => {
    const { form, props, request, accepted } = setup();
    fill(form);
    let finish!: () => void;
    request.mockImplementation(() => new Promise<void>((resolve, reject) => {
      finish = () => result === 'resolve' ? resolve() : reject(new Error('offline'));
    }));
    const pending = form.submit();
    props.active = false;
    props.active = true;
    form.model.message = 'new draft';
    finish();
    await pending;
    expect(form.model.message).toBe('new draft');
    expect(form.error.value).toBe('');
    expect(accepted).not.toHaveBeenCalled();
  });

  it('ignores accepted responses after unmount', async () => {
    const { form, request, accepted, wrapper } = setup();
    fill(form);
    let resolve!: () => void;
    request.mockImplementation(() => new Promise<void>((done) => {
      resolve = done;
    }));
    const pending = form.submit();
    wrapper.unmount();
    resolve();
    await pending;
    expect(accepted).not.toHaveBeenCalled();
  });
});
