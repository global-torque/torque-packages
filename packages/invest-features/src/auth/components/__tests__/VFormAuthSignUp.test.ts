import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { mount } from '@vue/test-utils';
import { reactive, toRefs } from 'vue';
import VFormAuthSignUp from '../VFormAuthSignUp.vue';

const signupStore = reactive({
  checkbox: false,
  continuationError: '',
  continueWithProfileType: vi.fn(),
  demoAccountHandler: vi.fn(),
  disposeInvitationEntry: vi.fn(),
  getErrorText: vi.fn(() => ''),
  isDemoAccountAvailable: true,
  isDemoAccountLoading: false,
  isDisabledButton: true,
  isFieldRequired: vi.fn(() => false),
  isLoading: false,
  invitationPreview: null as null | {
    kind: 'investor';
    email: string;
    profileType: 'individual' | 'entity' | 'trust';
  },
  invitationEntry: { status: 'direct' } as any,
  invitationState: 'none' as 'none' | 'loading' | 'ready' | 'unavailable',
  isEmailFixed: false,
  isInvitationContinuation: false,
  isInvitationContinuationPending: false,
  loadInvitationPreview: vi.fn(),
  acceptCurrentInvitation: vi.fn(),
  logoutForCurrentInvitation: vi.fn(),
  goToDashboard: vi.fn(),
  returnHome: vi.fn(),
  model: reactive({
    create_password: '',
    email: '',
    first_name: '',
    last_name: '',
    repeat_password: '',
  }),
  onLogin: vi.fn(),
  onMountedHandler: vi.fn(),
  queryFlow: undefined as string | undefined,
  retryProfileContinuation: vi.fn(),
  selectedProfileType: '',
  setSignupState: {
    error: null,
  },
  signupPasswordHandler: vi.fn(),
  signupStep: 'registration',
  verifiedSessionEmail: '',
});

const globalLoaderStore = reactive({
  isLoading: false,
});

vi.mock('../../store/useSignup.ts', () => ({
  useSignupStore: () => signupStore,
}));

vi.mock('@global-torque/invest-runtime/loader', () => ({
  useGlobalLoader: () => globalLoaderStore,
}));

vi.mock('../../links.ts', () => ({
  getAuthLinks: () => ({
    terms: '/legal/terms-of-use',
    privacy: '/legal/privacy-policy',
    blog: '/resource-center',
  }),
}));

vi.mock('pinia', async () => {
  const actual = await vi.importActual<typeof import('pinia')>('pinia');

  return {
    ...actual,
    storeToRefs: (store: Record<string, unknown>) => toRefs(store),
  };
});

const mountComponent = () => mount(VFormAuthSignUp, {
  global: {
    stubs: {
      FormCol: {
        template: '<div><slot /></div>',
      },
      FormRow: {
        template: '<div><slot /></div>',
      },
      Button: {
        props: ['disabled', 'loading'],
        template: `
          <button
            v-bind="$attrs"
            :data-loading="String(loading)"
            :disabled="disabled || loading"
            @click="$emit('click', $event)"
          >
            <slot />
          </button>
        `,
      },
      VFormCheckbox: {
        template: '<label><slot /></label>',
      },
      VFormGroup: {
        template: '<div><slot :is-field-error="false" /></div>',
      },
      VFormInput: {
        props: ['disabled', 'isError', 'modelValue', 'name', 'placeholder', 'size', 'type'],
        template: '<input :type="type || \'text\'" :disabled="disabled" />',
      },
      VFormInputPassword: {
        props: ['isError', 'modelValue', 'name', 'placeholder', 'showStrength', 'size', 'revealTabbable'],
        template: '<input type="password" :data-reveal-tabbable="String(revealTabbable)" />',
      },
    },
  },
});

const mountComponentWithRealInputs = () => mount(VFormAuthSignUp, {
  global: {
    stubs: {
      FormCol: {
        template: '<div><slot /></div>',
      },
      FormRow: {
        template: '<div><slot /></div>',
      },
      Button: {
        props: ['disabled', 'loading'],
        template: `
          <button
            v-bind="$attrs"
            :data-loading="String(loading)"
            :disabled="disabled || loading"
            @click="$emit('click', $event)"
          >
            <slot />
          </button>
        `,
      },
      VFormCheckbox: {
        template: '<label><slot /></label>',
      },
      VFormGroup: {
        template: '<div><slot :is-field-error="false" /></div>',
      },
    },
  },
});

describe('VFormAuthSignUp', () => {
  beforeEach(() => {
    signupStore.checkbox = false;
    signupStore.continuationError = '';
    signupStore.continueWithProfileType.mockReset();
    signupStore.demoAccountHandler.mockReset();
    signupStore.disposeInvitationEntry.mockReset();
    signupStore.getErrorText.mockClear();
    signupStore.isDemoAccountAvailable = true;
    signupStore.isDemoAccountLoading = false;
    signupStore.isDisabledButton = true;
    signupStore.isFieldRequired.mockClear();
    signupStore.isLoading = false;
    signupStore.invitationPreview = null;
    signupStore.invitationEntry = { status: 'direct' };
    signupStore.acceptCurrentInvitation.mockReset();
    signupStore.logoutForCurrentInvitation.mockReset();
    signupStore.goToDashboard.mockReset();
    signupStore.returnHome.mockReset();
    signupStore.invitationState = 'none';
    signupStore.isInvitationContinuation = false;
    signupStore.isInvitationContinuationPending = false;
    signupStore.isEmailFixed = false;
    signupStore.loadInvitationPreview.mockReset();
    signupStore.onLogin.mockReset();
    signupStore.onMountedHandler.mockReset();
    signupStore.queryFlow = undefined;
    signupStore.retryProfileContinuation.mockReset();
    signupStore.selectedProfileType = '';
    signupStore.signupPasswordHandler.mockReset();
    signupStore.signupStep = 'registration';
    signupStore.verifiedSessionEmail = '';
    signupStore.model.create_password = '';
    signupStore.model.email = '';
    signupStore.model.first_name = '';
    signupStore.model.last_name = '';
    signupStore.model.repeat_password = '';
    globalLoaderStore.isLoading = false;
  });

  it('synchronizes every signup field from a single browser input event', async () => {
    const wrapper = mountComponentWithRealInputs();
    const values = {
      'first-name': 'Playwright',
      'last-name': 'Wallet E2E',
      email: 'single-event@example.test',
      'create-password': 'StrongPassword123!',
      'repeat-password': 'StrongPassword123!',
    } as const;

    for (const [testId, value] of Object.entries(values)) {
      const input = wrapper.get(`[data-testid="${testId}"]`);
      input.element.value = value;
      await input.trigger('input');
    }

    expect(signupStore.model).toMatchObject({
      create_password: values['create-password'],
      email: values.email,
      first_name: values['first-name'],
      last_name: values['last-name'],
      repeat_password: values['repeat-password'],
    });
  });

  it('renders the demo CTA and delegates clicks to the signup store', async () => {
    const wrapper = mountComponent();
    const demoButton = wrapper.get('[data-testid="demo-account-button"]');

    expect(demoButton.text()).toContain('Try Demo Account');

    await demoButton.trigger('click');

    expect(signupStore.demoAccountHandler).toHaveBeenCalled();
  });

  it('hides the demo CTA when the snapshot is unavailable', () => {
    signupStore.isDemoAccountAvailable = false;

    const wrapper = mountComponent();

    expect(wrapper.find('[data-testid="demo-account-button"]').exists()).toBe(false);
  });

  it('passes the demo loading state through to the CTA button', () => {
    signupStore.isDemoAccountLoading = true;

    const wrapper = mountComponent();

    expect(wrapper.get('[data-testid="demo-account-button"]').attributes('disabled')).toBeDefined();
  });

  it('submits through the native form submit event', async () => {
    signupStore.isDisabledButton = false;
    const wrapper = mountComponent();

    await wrapper.get('form').trigger('submit');

    expect(signupStore.signupPasswordHandler).toHaveBeenCalledOnce();
    expect(wrapper.get('[data-testid="button"]').attributes('type')).toBe('submit');
  });

  it('renders invitation loading and unavailable states without the signup form', async () => {
    signupStore.invitationEntry = { status: 'checking' };
    const loadingWrapper = mountComponent();
    expect(loadingWrapper.get('[data-testid="invitation-loading"]').text()).toContain(
      'Checking your invitation',
    );
    expect(loadingWrapper.find('form').exists()).toBe(false);

    signupStore.invitationEntry = { status: 'unavailable' };
    await loadingWrapper.vm.$nextTick();
    expect(loadingWrapper.get('[data-testid="invitation-unavailable"]').text()).toContain(
      'This invitation is unavailable',
    );

    signupStore.returnHome.mockClear();
    await loadingWrapper.get('[data-testid="invitation-unavailable"] button').trigger('click');
    expect(signupStore.returnHome).toHaveBeenCalled();
  });

  it('fixes only the invited email while keeping invited names editable', () => {
    signupStore.invitationState = 'ready';
    signupStore.invitationEntry = { status: 'anonymous' };
    signupStore.isEmailFixed = true;
    signupStore.model.email = 'invitee@example.test';
    signupStore.model.first_name = 'Invite';
    signupStore.model.last_name = 'Recipient';

    const wrapper = mountComponent();
    const email = wrapper.get('input[type="email"]');
    const textInputs = wrapper.findAll('input[type="text"]');

    expect(email.attributes('disabled')).toBeDefined();
    expect(textInputs).toHaveLength(2);
    expect(textInputs.every(input => input.attributes('disabled') === undefined)).toBe(true);
  });

  it('renders one explicit confirmation heading and no registration controls for a match', async () => {
    signupStore.invitationPreview = {
      kind: 'investor',
      email: 'invited@example.test',
      profileType: 'individual',
    };
    signupStore.model.email = 'invited@example.test';
    signupStore.verifiedSessionEmail = 'invited@example.test';
    signupStore.invitationEntry = { status: 'match' };
    const wrapper = mountComponent();

    expect(wrapper.findAll('h1')).toHaveLength(1);
    expect(wrapper.findAll('input')).toHaveLength(0);
    expect(wrapper.text()).toContain('Accept invitation');

    await wrapper.get('[data-testid="invitation-match"]').trigger('submit');
    expect(signupStore.acceptCurrentInvitation).toHaveBeenCalledOnce();
  });

  it('makes logout the sole authentication action for a mismatch', async () => {
    signupStore.invitationPreview = {
      kind: 'investor',
      email: 'invited@example.test',
      profileType: 'individual',
    };
    signupStore.invitationEntry = { status: 'mismatch' };
    const wrapper = mountComponent();

    expect(wrapper.findAll('h1')).toHaveLength(1);
    expect(wrapper.findAll('input')).toHaveLength(0);
    expect(wrapper.text()).toContain('Log out');
    expect(wrapper.text()).not.toContain('Accept invitation');

    const logout = wrapper.findAll('button').find(button => button.text().includes('Log out'))!;
    await logout.trigger('click');
    expect(signupStore.logoutForCurrentInvitation).toHaveBeenCalled();
  });

  it('keeps the mismatch screen busy and logout disabled while logging out', () => {
    signupStore.invitationPreview = {
      kind: 'investor',
      email: 'invited@example.test',
      profileType: 'individual',
    };
    signupStore.invitationEntry = { status: 'logging-out' };
    const wrapper = mountComponent();
    const section = wrapper.get('[data-testid="invitation-mismatch"]');
    const logout = wrapper.findAll('button').find(button => button.text().includes('Log out'))!;

    expect(section.attributes('aria-busy')).toBe('true');
    expect(section.text()).toContain('Logging out…');
    expect(logout.attributes('disabled')).toBeDefined();
  });

  it('removes auth password reveal controls from Tab order', () => {
    const wrapper = mountComponent();
    const passwordInputs = wrapper.findAll('input[type="password"]');

    expect(passwordInputs).toHaveLength(2);
    expect(passwordInputs.every((input) => input.attributes('data-reveal-tabbable') === 'false')).toBe(true);
  });

  it('requires an explicit single profile choice after registration', async () => {
    signupStore.signupStep = 'choose-profile';
    const wrapper = mountComponent();
    const options = wrapper.findAll('[data-slot="toggle-group-item"]');
    const heading = wrapper.get('#signup-profile-choice-title');

    expect(heading.element.tagName).toBe('H1');
    expect(heading.classes()).toContain('signup-profile-choice__title');
    expect(options).toHaveLength(3);
    expect(options.every(option => option.attributes('aria-pressed') === 'false')).toBe(true);

    await options[1].trigger('click');
    const continueButton = wrapper.findAll('button')
      .find(button => button.text().includes('Continue'));
    expect(continueButton?.classes()).toContain('signup-profile-choice__continue');
    expect(continueButton?.attributes('block')).toBeUndefined();
    expect(continueButton?.element.closest('.signup-profile-choice__actions')).not.toBeNull();
    await continueButton?.trigger('click');

    expect(signupStore.selectedProfileType).toBe('entity');
    expect(signupStore.continueWithProfileType).toHaveBeenCalled();
  });

  it('keeps the form in place while an invitation is being completed', async () => {
    // The invited type is fixed, so the chooser must not flash between account
    // creation and the redirect. Nothing else may take its place either: a
    // progress panel that shows for an instant reads as breakage.
    signupStore.isInvitationContinuation = true;
    signupStore.isInvitationContinuationPending = true;
    signupStore.signupStep = 'resolving';
    const wrapper = mountComponent();

    expect(wrapper.find('.signup-profile-choice').exists()).toBe(false);
    expect(wrapper.findAll('[role="radio"]')).toHaveLength(0);
    expect(wrapper.find('[data-testid="invitation-continuation-error"]').exists()).toBe(false);
    // The page simply does not change until it navigates.
    expect(wrapper.find('form.signup-form').exists()).toBe(true);
  });

  it('blocks a second submission while the redirect is in flight', async () => {
    signupStore.isInvitationContinuation = true;
    signupStore.isInvitationContinuationPending = true;
    signupStore.signupStep = 'resolving';
    // isLoading is already false by this point: the signup request finished.
    signupStore.isLoading = false;
    signupStore.isDisabledButton = false;
    const wrapper = mountComponent();

    const button = wrapper.get('[data-testid="button"]');
    expect(button.attributes('disabled')).toBeDefined();
  });

  it('offers a retry instead of the chooser when an invitation fails to complete', async () => {
    signupStore.isInvitationContinuation = true;
    signupStore.isInvitationContinuationPending = false;
    signupStore.signupStep = 'error';
    signupStore.continuationError = 'The invitation could not be completed.';
    const wrapper = mountComponent();

    expect(wrapper.find('.signup-profile-choice').exists()).toBe(false);
    const block = wrapper.get('[data-testid="invitation-continuation-error"]');
    expect(block.text()).toContain('The invitation could not be completed.');

    await block.get('button').trigger('click');
    expect(signupStore.retryProfileContinuation).toHaveBeenCalled();
  });
});
