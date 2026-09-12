import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, h, reactive } from 'vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ISession } from '@webdevelop-pro/domain-types/authTypes';
import type { IUserFormatted } from '@webdevelop-pro/domain-types/profilesTypes';
import { useContactUsSessionPrefill } from '../useContactUsSessionPrefill';
import VFormContactUs from '../VFormContactUs.vue';

const mocks = vi.hoisted(() => ({
  useSessionStore: vi.fn(),
  getStore: vi.fn(),
}));
vi.mock('@webdevelop-pro/invest-runtime/session', () => ({ useSessionStore: mocks.useSessionStore }));
vi.mock('@webdevelop-pro/invest-runtime/adapters', () => ({
  getRequiredInvestRuntimeAdapter: () => ({ getStore: mocks.getStore }),
}));

const session = reactive({
  userLoggedIn: true,
  userSession: undefined as { identity: Pick<ISession['identity'], 'id' | 'traits'> } | undefined,
});
const profiles = reactive({ getUserState: { data: undefined as Pick<IUserFormatted, 'fullName'> | undefined } });
const wrappers: ReturnType<typeof mount>[] = [];

function mountContact(surface: 'dialog' | 'page' = 'page') {
  const submitContact = vi.fn().mockResolvedValue(undefined);
  const wrapper = mount(defineComponent({
    setup() {
      const sessionPrefill = useContactUsSessionPrefill();
      return () => h(VFormContactUs, {
        sessionPrefill: sessionPrefill.value, surface, subject: 'wallet', submitContact, contactEmail: 'support@example.test',
      });
    },
  }));
  wrappers.push(wrapper);
  return { wrapper, submitContact };
}

beforeEach(() => {
  window.history.replaceState({}, '', '/contact-us');
  session.userLoggedIn = true;
  session.userSession = { identity: { id: 'identity-one', traits: { email: 'session@example.test' } } };
  profiles.getUserState.data = undefined;
  mocks.useSessionStore.mockReturnValue(session);
  mocks.getStore.mockReturnValue(profiles);
});
afterEach(() => wrappers.splice(0).forEach(wrapper => wrapper.unmount()));

describe('contact account prefill', () => {
  it('prefers the actual account full name and retains the authenticated email', () => {
    session.userSession!.identity.traits = {
      email: 'session@example.test', first_name: 'Flat', last_name: 'Name', name: { first: 'Legacy', last: 'Name' },
    };
    profiles.getUserState.data = { fullName: '  Account Person  ' };
    expect(useContactUsSessionPrefill().value).toEqual({
      identityId: 'identity-one', name: 'Account Person', email: 'session@example.test',
    });
  });

  it.each([
    [{ first_name: ' Flat ', last_name: ' Name ' }, 'Flat Name'],
    [{ first_name: 'Only' }, 'Only'],
    [{ name: { first: ' Legacy ', last: ' Name ' } }, 'Legacy Name'],
    [{ first_name: ' ', last_name: '', name: { first: 'Legacy', last: 'Name' } }, 'Legacy Name'],
    [{}, ''],
  ])('uses available session name traits without an email-as-name fallback: %j', (traits, expected) => {
    session.userSession!.identity.traits = { email: 'session@example.test', ...traits };
    profiles.getUserState.data = { fullName: ' ' };
    expect(useContactUsSessionPrefill().value.name).toBe(expected);
  });

  it('prefills the public form from already loaded account data', async () => {
    profiles.getUserState.data = { fullName: 'Account Person' };
    const { wrapper } = mountContact();
    await flushPromises();
    expect((wrapper.get('input[name="name"]').element as HTMLInputElement).value).toBe('Account Person');
    expect((wrapper.get('input[name="email"]').element as HTMLInputElement).value).toBe('session@example.test');
    expect(wrapper.get('input[name="name"]').attributes('type')).not.toBe('hidden');
  });

  it('fills an untouched empty public name when the existing account request completes', async () => {
    const { wrapper } = mountContact();
    await flushPromises();
    expect((wrapper.get('input[name="name"]').element as HTMLInputElement).value).toBe('');
    profiles.getUserState.data = { fullName: 'Account Person' };
    await flushPromises();
    expect((wrapper.get('input[name="name"]').element as HTMLInputElement).value).toBe('Account Person');
  });

  it.each([undefined, '', 'My Edited Name'])('updates only automatic public name prefill after account loading; edit=%s', async (edit) => {
    session.userSession!.identity.traits.first_name = 'Session';
    const { wrapper } = mountContact();
    await flushPromises();
    expect((wrapper.get('input[name="name"]').element as HTMLInputElement).value).toBe('Session');
    if (edit !== undefined) await wrapper.get('input[name="name"]').setValue(edit);
    profiles.getUserState.data = { fullName: 'Account Person' };
    await flushPromises();
    expect((wrapper.get('input[name="name"]').element as HTMLInputElement).value).toBe(edit ?? 'Account Person');
  });

  it('preserves a public query name when account data arrives', async () => {
    window.history.replaceState({}, '', '/contact-us?name=Query+Person');
    const { wrapper } = mountContact();
    await flushPromises();
    profiles.getUserState.data = { fullName: 'Account Person' };
    await flushPromises();
    expect((wrapper.get('input[name="name"]').element as HTMLInputElement).value).toBe('Query Person');
  });

  it('updates hidden dialog identity and submits the account name after delayed loading', async () => {
    session.userSession!.identity.traits.first_name = 'Session';
    const { wrapper, submitContact } = mountContact('dialog');
    await flushPromises();
    expect(wrapper.get('input[name="name"]').attributes('type')).toBe('hidden');
    expect((wrapper.get('input[name="name"]').element as HTMLInputElement).value).toBe('Session');
    profiles.getUserState.data = { fullName: 'Account Person' };
    await flushPromises();
    expect((wrapper.get('input[name="name"]').element as HTMLInputElement).value).toBe('Account Person');
    await wrapper.get('textarea').setValue('Please help with my wallet.');
    await wrapper.get('form').trigger('submit');
    expect(submitContact).toHaveBeenCalledWith(expect.objectContaining({ name: 'Account Person', email: 'session@example.test' }));
  });

  it('clears contact identity on logout and follows fresh account state after the runtime reset', async () => {
    profiles.getUserState.data = { fullName: 'Old Person' };
    const { wrapper } = mountContact('dialog');
    await flushPromises();
    session.userLoggedIn = false;
    session.userSession = undefined;
    await flushPromises();
    expect((wrapper.get('input[name="name"]').element as HTMLInputElement).value).toBe('');
    expect((wrapper.get('input[name="email"]').element as HTMLInputElement).value).toBe('');
    profiles.getUserState.data = undefined;
    session.userSession = { identity: { id: 'identity-two', traits: { email: 'new@example.test', first_name: 'New' } } };
    session.userLoggedIn = true;
    await flushPromises();
    expect((wrapper.get('input[name="name"]').element as HTMLInputElement).value).toBe('New');
    profiles.getUserState.data = { fullName: 'New Person' };
    await flushPromises();
    expect((wrapper.get('input[name="name"]').element as HTMLInputElement).value).toBe('New Person');
    expect((wrapper.get('input[name="email"]').element as HTMLInputElement).value).toBe('new@example.test');
  });
});
