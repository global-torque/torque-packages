import {
  describe, it, expect, vi, beforeEach, afterEach,
} from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useRepositoryAuth } from '../../data/auth.repository.ts';
import { ref } from 'vue';
// use real form validation; no mock import needed
import { useSignupStore } from '../useSignup.ts';
import { rememberInvitationReturnForFlow } from '../../navigation/invitationReturn.ts';

const appConfig = vi.hoisted(() => ({
  urls: { dashboard: '', static: '' },
}));

vi.mock('@global-torque/invest-runtime/application-context', () => ({
  useInvestApplicationContext: () => ({ appConfig }),
}));

const mockDemoAccountAuthenticate = vi.fn().mockResolvedValue(true);
const mockIsDemoAccountAvailable = ref(true);
const mockIsDemoAccountLoading = ref(false);
const {
  mockLogoutHandler,
  mockResetAllData,
  mockResetDataForIdentityChange,
  mockShouldAutoAuthenticateDemoAccount,
} = vi.hoisted(() => ({
  mockLogoutHandler: vi.fn().mockResolvedValue({ status: 'navigation-started' }),
  mockResetAllData: vi.fn().mockResolvedValue(undefined),
  mockResetDataForIdentityChange: vi.fn().mockResolvedValue(undefined),
  mockShouldAutoAuthenticateDemoAccount: vi.fn().mockReturnValue(false),
}));
const mockGetSchemaState = ref({ data: {} });
const mockSetSignupState = ref({ error: null, data: null });
const mockGetSignupState = ref({ data: null });
const mockGetAuthFlowState = ref({ error: null });
const mockFlowId = { value: 'test-flow-id' };
const mockCsrfToken = { value: 'test-csrf-token' };
const mockGetAuthFlow = vi.fn().mockResolvedValue({ id: 'test-flow-id', ui: {} });
const mockSetSignup = vi.fn().mockResolvedValue(undefined);
const mockGetSignup = vi.fn().mockResolvedValue(undefined);
const mockGetSession = vi.fn().mockResolvedValue(null);
const sendEventMock = vi.fn().mockResolvedValue(undefined);
const mockUpdateSession = vi.fn();
const mockUserSession = ref<any>(undefined);
const mockProfilesInit = vi.fn().mockResolvedValue(undefined);
const mockUserProfiles: Array<{ id: number; type: string }> = [];
const mockInvitationPreviewState = ref({ loading: false, error: null, data: undefined as any });
const mockInvitationAcceptState = ref({ loading: false, error: null, data: undefined as any });
const mockPreviewInvitation = vi.fn();
const mockAcceptInvitation = vi.fn();
const mockResetInvitations = vi.fn();
const { mockNavigateWithQueryParams } = vi.hoisted(() => ({
  mockNavigateWithQueryParams: vi.fn(),
}));

// Mock the dependencies
vi.mock('../../data/auth.repository.ts', () => ({
  useRepositoryAuth: vi.fn(() => ({
    getSchemaState: mockGetSchemaState,
    setSignupState: mockSetSignupState,
    getSignupState: mockGetSignupState,
    getAuthFlowState: mockGetAuthFlowState,
    flowId: mockFlowId,
    csrfToken: mockCsrfToken,
    getAuthFlow: mockGetAuthFlow,
    setSignup: mockSetSignup,
    getSignup: mockGetSignup,
    getSession: mockGetSession,
  })),
}));

vi.mock('@global-torque/invest-runtime/session', () => ({
  useSessionStore: vi.fn(() => ({
    updateSession: mockUpdateSession,
    get userSession() {
      return mockUserSession.value;
    },
  })),
}));

vi.mock('@global-torque/invest-runtime/reset', () => ({
  resetDataForIdentityChange: mockResetDataForIdentityChange,
  resetAllData: mockResetAllData,
}));

vi.mock('../useLogout.ts', () => ({
  useLogoutStore: () => ({ logoutHandler: mockLogoutHandler }),
}));

vi.mock('@global-torque/invest-runtime/adapters', () => ({
  getRequiredInvestRuntimeAdapter: () => ({
    init: mockProfilesInit,
    getUserProfiles: () => mockUserProfiles,
  }),
}));

vi.mock('../../invitations/invitations.repository.ts', () => ({
  useRepositoryInvitations: () => ({
    previewState: mockInvitationPreviewState,
    acceptState: mockInvitationAcceptState,
    preview: mockPreviewInvitation,
    accept: mockAcceptInvitation,
    resetAll: mockResetInvitations,
  }),
}));

vi.mock('@global-torque/invest-runtime/navigation', () => ({
  navigateWithQueryParams: mockNavigateWithQueryParams,
}));

// no mock for useFormValidation – use the real implementation


vi.mock('@global-torque/invest-runtime/analytics/useSendAnalyticsEvent', () => ({
  useSendAnalyticsEvent: () => ({
    sendEvent: sendEventMock,
  }),
}));

vi.mock('@global-torque/invest-runtime/error/oryResponseHandling', () => ({
  oryResponseHandling: vi.fn(),
}));

vi.mock('@global-torque/invest-runtime/error/oryErrorHandling', () => ({
  oryErrorHandling: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../composables/useDemoAccountAuth.ts', () => ({
  useDemoAccountAuth: () => ({
    authenticate: mockDemoAccountAuthenticate,
    isAvailable: mockIsDemoAccountAvailable,
    isLoading: mockIsDemoAccountLoading,
  }),
  shouldAutoAuthenticateDemoAccount: mockShouldAutoAuthenticateDemoAccount,
}));

const originalWindowLocation = window.location;

// jsdom refuses cross-document navigation, so the profile handoff needs a stand
// in for `window.location` before it can be asserted.
function stubWindowLocation(search: string): void {
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: {
      assign: vi.fn(),
      hash: '',
      hostname: originalWindowLocation.hostname,
      href: `${originalWindowLocation.origin}/signup${search}`,
      origin: originalWindowLocation.origin,
      pathname: '/signup',
      search,
    },
  });
}

describe('useSignup Store', () => {
  afterEach(() => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalWindowLocation,
    });
    appConfig.urls.dashboard = '';
  });

  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    const authRepository = useRepositoryAuth() as any;
    authRepository.getSchemaState.value = { data: {} };
    authRepository.setSignupState.value = { error: null, data: null };
    authRepository.getSignupState.value = { data: null };
    authRepository.getAuthFlowState.value = { error: null };
    authRepository.flowId.value = 'test-flow-id';
    authRepository.csrfToken.value = 'test-csrf-token';
    authRepository.getAuthFlow.mockReset().mockResolvedValue(undefined);
    authRepository.setSignup.mockReset().mockResolvedValue(undefined);
    authRepository.getSignup.mockReset().mockResolvedValue(undefined);
    authRepository.getSession.mockReset().mockResolvedValue(null);
    sendEventMock.mockReset().mockResolvedValue(undefined);
    mockUpdateSession.mockReset().mockImplementation((session) => {
      mockUserSession.value = session;
    });
    mockUserSession.value = undefined;
    mockResetAllData.mockReset().mockResolvedValue(undefined);
    mockLogoutHandler.mockReset().mockResolvedValue({ status: 'navigation-started' });
    mockResetDataForIdentityChange.mockReset().mockResolvedValue(undefined);
    mockProfilesInit.mockReset().mockResolvedValue(undefined);
    mockUserProfiles.splice(0);
    mockInvitationPreviewState.value = { loading: false, error: null, data: undefined };
    mockInvitationAcceptState.value = { loading: false, error: null, data: undefined };
    mockPreviewInvitation.mockReset();
    mockAcceptInvitation.mockReset();
    mockResetInvitations.mockReset().mockImplementation(() => {
      mockInvitationPreviewState.value = { loading: false, error: null, data: undefined };
      mockInvitationAcceptState.value = { loading: false, error: null, data: undefined };
    });
    mockNavigateWithQueryParams.mockReset();
    mockDemoAccountAuthenticate.mockReset().mockResolvedValue(true);
    mockShouldAutoAuthenticateDemoAccount.mockReset().mockReturnValue(false);
    mockIsDemoAccountAvailable.value = true;
    mockIsDemoAccountLoading.value = false;
    sessionStorage.clear();
    window.history.replaceState({}, '', '/signup');
  });

  describe('Initial State', () => {
    it('should initialize with default values', () => {
      const store = useSignupStore();
      expect(store.isLoading).toBe(false);
      expect(store.checkbox).toBe(false);
      expect(store.isDisabledButton).toBe(true);
    });
  });

  describe('Form Validation', () => {
    it('should validate form successfully', () => {
      const store = useSignupStore();
      store.model.first_name = 'John';
      store.model.last_name = 'Doe';
      store.model.email = 'john@example.com';
      store.model.create_password = 'Password123!';
      store.model.repeat_password = 'Password123!';

      const result = store.validateForm();
      expect(result).toBe(true);
    });

    it('should handle invalid form validation', () => {
      const store = useSignupStore();
      store.model.first_name = '';
      store.model.last_name = '';
      store.model.email = 'invalid';
      store.model.create_password = 'short';
      store.model.repeat_password = 'mismatch';
      const result = store.validateForm();
      expect(result).toBe(false);
    });
  });

  describe('Signup Handlers', () => {
    it('should handle password signup successfully', async () => {
      const store = useSignupStore();
      const authRepository = useRepositoryAuth() as any;
      store.checkbox = true;
      store.model.email = 'test@example.com';
      store.model.first_name = 'John';
      store.model.last_name = 'Doe';
      store.model.create_password = 'password123';
      store.model.repeat_password = 'password123';

      const mockSession: any = {
        id: 'test-session',
        identity: {
          id: 'identity-456',
          traits: {
            email: 'test@example.com',
          },
        },
      };
      authRepository.getAuthFlow.mockImplementationOnce(async () => {
        authRepository.csrfToken.value = 'fresh-signup-csrf-token';
      });
      authRepository.setSignupState.value = {
        error: null,
        data: { session: mockSession, session_token: 'token' },
      };

      await store.signupPasswordHandler();
      expect(store.isLoading).toBe(false);
      expect(authRepository.setSignup).toHaveBeenCalledWith(
        'test-flow-id',
        expect.objectContaining({
          csrf_token: 'fresh-signup-csrf-token',
          password: 'password123',
        }),
      );
      expect(mockUpdateSession).toHaveBeenCalledWith(mockSession);
      expect(mockResetDataForIdentityChange).toHaveBeenCalledTimes(1);
      expect(sendEventMock).toHaveBeenCalledWith(expect.objectContaining({
        status_code: 200,
        request_id: 'test-flow-id',
      }));
      expect(store.signupStep).toBe('choose-profile');
      expect(mockNavigateWithQueryParams).not.toHaveBeenCalled();
      expect(mockResetDataForIdentityChange.mock.invocationCallOrder[0]).toBeLessThan(
        mockUpdateSession.mock.invocationCallOrder[0],
      );
      expect(mockUpdateSession.mock.invocationCallOrder[0]).toBeLessThan(
        sendEventMock.mock.invocationCallOrder[0],
      );
    });

    it('should handle social signup successfully', async () => {
      const store = useSignupStore();
      const authRepository = useRepositoryAuth() as any;

      await store.signupSocialHandler('google');

      expect(store.isLoading).toBe(false);
      expect(authRepository.setSignup).toHaveBeenCalledWith(
        'test-flow-id',
        expect.objectContaining({
          csrf_token: 'test-csrf-token',
          provider: 'google',
          method: 'oidc',
          transient_payload: {
            site_domain: window.location.hostname,
          },
        }),
      );
    });

    it('should handle signup errors', async () => {
      const store = useSignupStore();
      const authRepository = useRepositoryAuth() as any;
      store.checkbox = true;

      authRepository.getAuthFlowState.value = {
        data: undefined,
        loading: false,
        error: new Error('Test error'),
      };

      await store.signupPasswordHandler();
      expect(store.isLoading).toBe(false);
    });

    it('should delegate demo account signup to the shared demo auth helper without requiring form validation', async () => {
      const store = useSignupStore();

      await store.demoAccountHandler();

      expect(mockDemoAccountAuthenticate).toHaveBeenCalledTimes(1);
      expect(store.checkbox).toBe(false);
      expect(store.isDemoAccountAvailable).toBe(true);
      expect(store.isDemoAccountLoading).toBe(false);
    });
  });

  describe('Form Field Mapping', () => {
    it('should map form fields correctly', () => {
      const store = useSignupStore();
      const nodes = [
        {
          attributes: {
            name: 'traits.email',
            value: 'test@example.com',
          },
        },
        {
          attributes: {
            name: 'traits.first_name',
            value: 'John',
          },
        },
        {
          attributes: {
            name: 'traits.last_name',
            value: 'Doe',
          },
        },
      ];

      store.mapFormFields(nodes);
      expect(store.model.email).toBe('test@example.com');
      expect(store.model.first_name).toBe('John');
      expect(store.model.last_name).toBe('Doe');
    });

    it('should handle full name splitting', () => {
      const store = useSignupStore();
      const nodes = [
        {
          attributes: {
            name: 'traits.name',
            value: 'John Doe',
          },
        },
      ];

      store.mapFormFields(nodes);
      expect(store.model.first_name).toBe('John');
      expect(store.model.last_name).toBe('Doe');
    });
  });

  describe('Query Parameters', () => {
    it('should handle query parameters correctly', () => {
      window.history.replaceState({}, '', '/signup?flow=test-flow&redirect=/profile');

      // Create a new pinia instance for this test
      const pinia = createPinia();
      setActivePinia(pinia);

      // Create the store after mocking
      const store = useSignupStore();

      // Test the query parameters
      expect(store.queryFlow).toBe('test-flow');
      expect(store.title).toBe('Finish Registration');
    });

    it('preserves the redirect query when sending signup users to wallet otp', async () => {
      window.history.replaceState({}, '', '/signup?redirect=/profile/123/wallet');

      const pinia = createPinia();
      setActivePinia(pinia);

      const store = useSignupStore();
      store.checkbox = true;
      store.model.email = 'test@example.com';
      store.model.first_name = 'John';
      store.model.last_name = 'Doe';
      store.model.create_password = 'password123';
      store.model.repeat_password = 'password123';

      const authRepository = useRepositoryAuth() as any;
      const mockSession: any = {
        id: 'test-session',
        identity: { id: 'identity-456', traits: { email: 'test@example.com' } },
      };
      authRepository.getAuthFlow.mockImplementationOnce(async () => {
        authRepository.csrfToken.value = 'fresh-signup-csrf-token';
      });
      authRepository.setSignupState.value = {
        error: null,
        data: { session: mockSession, session_token: 'token' },
      };

      await store.signupPasswordHandler();
      mockUserProfiles.push({ id: 17, type: 'individual' });
      store.selectedProfileType = 'individual';
      await store.continueWithProfileType();

      expect(mockNavigateWithQueryParams).toHaveBeenCalledWith(
        expect.stringContaining('/profile/17/wallet-otp'),
        {
          profileType: 'individual',
          next: '/profile/17/account',
          redirect: '/profile/123/wallet',
        },
      );
    });
  });

  describe('onMountedHandler', () => {
    it('loads an invitation preview and prefills the public signup form', async () => {
      window.history.replaceState({}, '', '/signup?invite=opaque-invitation-code');
      const preview = {
        kind: 'investor',
        email: 'invitee@example.test',
        firstName: 'Invite',
        lastName: 'Recipient',
        profileType: 'entity',
        expiresAt: '2030-01-01T00:00:00Z',
      };
      mockPreviewInvitation.mockImplementation(async () => {
        mockInvitationPreviewState.value = { loading: false, error: null, data: preview };
        return preview;
      });

      const store = useSignupStore();
      await store.onMountedHandler();

      expect(mockPreviewInvitation).toHaveBeenCalledWith(
        'opaque-invitation-code',
        expect.any(AbortSignal),
      );
      expect(store.invitationState).toBe('ready');
      expect(store.model).toMatchObject({
        email: 'invitee@example.test',
        first_name: 'Invite',
        last_name: 'Recipient',
      });
      expect(store.isEmailFixed).toBe(true);
      // The invited type is fixed, so the chooser is never this signup's step.
      expect(store.isInvitationContinuation).toBe(true);
      // ...but the form is still being filled in, so nothing is pending yet:
      // the pending flag is what disables the submit button.
      expect(store.isInvitationContinuationPending).toBe(false);

      store.signupStep = 'resolving';
      expect(store.isInvitationContinuationPending).toBe(true);

      // A failure is a screen of its own, not a form waiting on a redirect.
      store.signupStep = 'error';
      expect(store.isInvitationContinuationPending).toBe(false);
    });

    it('leaves a direct signup on the profile chooser path', async () => {
      window.history.replaceState({}, '', '/signup');
      const store = useSignupStore();
      await store.onMountedHandler();

      expect(store.invitationState).toBe('none');
      expect(store.isInvitationContinuation).toBe(false);
    });

    it('invalidates an earlier preview when the invite query changes', async () => {
      window.history.replaceState({}, '', '/signup?invite=first-invitation-code');
      let resolveFirstPreview: ((preview: any) => void) | undefined;
      const firstPreview = new Promise(resolve => {
        resolveFirstPreview = resolve;
      });
      const secondPreview = {
        kind: 'investor',
        email: 'second@example.test',
        firstName: 'Second',
        lastName: 'Recipient',
        profileType: 'trust',
        expiresAt: '2030-01-02T00:00:00Z',
      };
      mockPreviewInvitation
        .mockImplementationOnce(() => firstPreview)
        .mockImplementationOnce(async () => {
          mockInvitationPreviewState.value = {
            loading: false,
            error: null,
            data: secondPreview,
          };
          return secondPreview;
        });

      const store = useSignupStore();
      const firstLoad = store.loadInvitationPreview();
      window.history.replaceState({}, '', '/signup?invite=second-invitation-code');
      await store.loadInvitationPreview();
      resolveFirstPreview?.({
        kind: 'investor',
        email: 'first@example.test',
        firstName: 'First',
        lastName: 'Recipient',
        profileType: 'entity',
        expiresAt: '2030-01-01T00:00:00Z',
      });
      await firstLoad;

      expect(mockPreviewInvitation).toHaveBeenNthCalledWith(
        1,
        'first-invitation-code',
        expect.any(AbortSignal),
      );
      expect(mockPreviewInvitation).toHaveBeenNthCalledWith(
        2,
        'second-invitation-code',
        expect.any(AbortSignal),
      );
      expect(store.model).toMatchObject({
        email: 'second@example.test',
        first_name: 'Second',
        last_name: 'Recipient',
      });
      expect(store.invitationState).toBe('ready');
    });

    it('clears sensitive persistent form state across direct and invitation route changes', async () => {
      const firstPreview = {
        kind: 'team',
        email: 'first@example.test',
        firstName: 'First',
        lastName: 'Recipient',
        profileType: null,
        expiresAt: '2030-01-01T00:00:00Z',
      };
      const secondPreview = {
        ...firstPreview,
        email: 'second@example.test',
        firstName: 'Second',
      };
      mockPreviewInvitation
        .mockResolvedValueOnce(firstPreview)
        .mockResolvedValueOnce(secondPreview)
        .mockResolvedValueOnce(firstPreview);
      mockGetSession.mockResolvedValue(null);
      const store = useSignupStore();

      store.model.email = 'direct@example.test';
      store.model.create_password = 'direct-secret';
      store.model.repeat_password = 'direct-secret';
      store.checkbox = true;
      window.history.replaceState({}, '', '/signup?invite=first-code');
      await store.loadInvitationPreview();
      expect(store.model.email).toBe(firstPreview.email);
      expect(store.model.create_password).toBe('');
      expect(store.checkbox).toBe(false);

      store.model.create_password = 'first-secret';
      store.model.repeat_password = 'first-secret';
      store.checkbox = true;
      window.history.replaceState({}, '', '/signup?invite=second-code');
      await store.loadInvitationPreview();
      expect(store.model.email).toBe(secondPreview.email);
      expect(store.model.create_password).toBe('');
      expect(store.checkbox).toBe(false);

      store.model.create_password = 'second-secret';
      store.model.repeat_password = 'second-secret';
      store.checkbox = true;
      window.history.replaceState({}, '', '/signup');
      await store.loadInvitationPreview();
      expect(store.invitationEntry.status).toBe('direct');
      expect(store.model).toMatchObject({
        first_name: '',
        last_name: '',
        email: '',
        create_password: '',
        repeat_password: '',
      });
      expect(store.checkbox).toBe(false);
    });

    it('fetches and classifies each flow id instead of reusing a cached flow return', async () => {
      const origin = window.location.origin;
      mockGetSignup
        .mockResolvedValueOnce({ return_to: `${origin}/signup?invite=flow-a-code` })
        .mockResolvedValueOnce({ return_to: `${origin}/signup?invite=flow-b-code` });
      mockPreviewInvitation
        .mockResolvedValueOnce({
          kind: 'team',
          email: 'a@example.test',
          firstName: 'Flow A',
          lastName: 'Recipient',
          profileType: null,
          expiresAt: '2030-01-01T00:00:00Z',
        })
        .mockResolvedValueOnce({
          kind: 'team',
          email: 'b@example.test',
          firstName: 'Flow B',
          lastName: 'Recipient',
          profileType: null,
          expiresAt: '2030-01-01T00:00:00Z',
        });
      mockGetSession.mockResolvedValue(null);
      window.history.replaceState({}, '', '/signup?flow=flow-a');
      const store = useSignupStore();
      await store.onMountedHandler();
      store.model.create_password = 'flow-a-secret';
      store.checkbox = true;

      window.history.replaceState({}, '', '/signup?flow=flow-b');
      await store.onMountedHandler();

      expect(mockGetSignup).toHaveBeenNthCalledWith(1, 'flow-a');
      expect(mockGetSignup).toHaveBeenNthCalledWith(2, 'flow-b');
      expect(store.invitationCode).toBe('flow-b-code');
      expect(store.model.email).toBe('b@example.test');
      expect(store.model.create_password).toBe('');
      expect(store.checkbox).toBe(false);
    });

    it('requires an explicit acceptance click after invited account registration', async () => {
      window.history.replaceState({}, '', '/signup?invite=opaque-invitation-code');
      const preview = {
        kind: 'investor',
        email: 'invitee@example.test',
        firstName: 'Invite',
        lastName: 'Recipient',
        profileType: 'individual',
        expiresAt: '2030-01-01T00:00:00Z',
      };
      mockPreviewInvitation.mockImplementation(async () => {
        mockInvitationPreviewState.value = { loading: false, error: null, data: preview };
        return preview;
      });
      mockAcceptInvitation.mockResolvedValueOnce({
        kind: 'investor',
        acceptedProfileId: 73,
        selectedProfileType: 'individual',
      });

      const store = useSignupStore();
      await store.onMountedHandler();
      store.checkbox = true;
      store.model.create_password = 'password123';
      store.model.repeat_password = 'password123';
      const authRepository = useRepositoryAuth() as any;
      authRepository.setSignupState.value = {
        error: null,
        data: {
          session: {
            id: 'test-session',
            identity: {
              id: 'identity-456',
              traits: { email: preview.email },
            },
          },
        },
      };

      await store.signupPasswordHandler();

      expect(store.signupStep).not.toBe('choose-profile');
      expect(store.invitationEntry.status).toBe('match');
      expect(mockAcceptInvitation).not.toHaveBeenCalled();

      await store.acceptCurrentInvitation();

      expect(mockAcceptInvitation).toHaveBeenCalledTimes(1);
      expect(mockAcceptInvitation).toHaveBeenCalledWith(
        'opaque-invitation-code',
        'individual',
      );
      expect(mockNavigateWithQueryParams).toHaveBeenCalledWith(
        expect.stringContaining('/profile/73/wallet-otp'),
        {
          profileType: 'individual',
          next: '/profile/73/kyc',
        },
      );
    });

    it('fails explicit acceptance when the accepted type differs from the preview', async () => {
      window.history.replaceState({}, '', '/signup?invite=opaque-invitation-code');
      const preview = {
        kind: 'investor',
        email: 'invitee@example.test',
        firstName: 'Invite',
        lastName: 'Recipient',
        profileType: 'trust',
        expiresAt: '2030-01-01T00:00:00Z',
      };
      mockPreviewInvitation.mockImplementation(async () => {
        mockInvitationPreviewState.value = { loading: false, error: null, data: preview };
        return preview;
      });
      mockAcceptInvitation.mockResolvedValueOnce({
        kind: 'investor',
        acceptedProfileId: 91,
        selectedProfileType: 'entity',
      });

      const store = useSignupStore();
      await store.onMountedHandler();
      store.checkbox = true;
      store.model.create_password = 'password123';
      store.model.repeat_password = 'password123';
      const authRepository = useRepositoryAuth() as any;
      authRepository.setSignupState.value = {
        error: null,
        data: {
          session: {
            id: 'test-session',
            identity: {
              id: 'identity-456',
              traits: { email: preview.email },
            },
          },
        },
      };

      await store.signupPasswordHandler();
      await store.acceptCurrentInvitation();

      expect(mockAcceptInvitation).toHaveBeenCalledWith(
        'opaque-invitation-code',
        'trust',
      );
      expect(store.invitationEntry).toMatchObject({
        status: 'accept-error',
        retryable: false,
      });
      expect(mockNavigateWithQueryParams).not.toHaveBeenCalled();
    });

    // sdira and solo401k are outside the selectable set, so the accept call has
    // to leave the type out. Sending one would be rejected as a mismatch.
    it('accepts an sdira invitation explicitly without sending a selected type', async () => {
      stubWindowLocation('?invite=dedicated-invitation-code');
      appConfig.urls.dashboard = 'https://dashboard.example.test';
      const preview = {
        kind: 'investor',
        email: 'retirement@example.test',
        firstName: 'Retirement',
        lastName: 'Recipient',
        profileType: 'sdira',
        expiresAt: '2030-01-01T00:00:00Z',
      };
      mockPreviewInvitation.mockImplementation(async () => {
        mockInvitationPreviewState.value = { loading: false, error: null, data: preview };
        return preview;
      });
      mockAcceptInvitation.mockResolvedValueOnce({
        kind: 'investor',
        acceptedProfileId: 58,
        selectedProfileType: 'sdira',
      });

      const store = useSignupStore();
      await store.onMountedHandler();
      store.checkbox = true;
      store.model.create_password = 'password123';
      store.model.repeat_password = 'password123';
      const authRepository = useRepositoryAuth() as any;
      authRepository.setSignupState.value = {
        error: null,
        data: {
          session: {
            id: 'test-session',
            identity: {
              id: 'identity-456',
              traits: { email: preview.email },
            },
          },
        },
      };

      await store.signupPasswordHandler();
      await store.acceptCurrentInvitation();

      expect(store.signupStep).not.toBe('choose-profile');
      expect(store.continuationError).toBe('');
      expect(mockAcceptInvitation).toHaveBeenCalledTimes(1);
      expect(mockAcceptInvitation).toHaveBeenCalledWith(
        'dedicated-invitation-code',
        undefined,
      );
      expect(window.location.assign).toHaveBeenCalledWith(
        'https://dashboard.example.test/profile/create-new-profile'
        + '?onboarding=invitation&profileType=sdira&acceptedProfileId=58',
      );
    });

    it('blocks unrestricted signup when the invitation preview is unavailable', async () => {
      window.history.replaceState({}, '', '/signup?invite=unavailable-invitation-code');
      mockPreviewInvitation.mockRejectedValueOnce(new Error('Invitation is not available.'));

      const store = useSignupStore();
      await store.onMountedHandler();

      expect(store.invitationState).toBe('unavailable');
      expect(store.isDisabledButton).toBe(true);
      expect(mockDemoAccountAuthenticate).not.toHaveBeenCalled();
    });

    it('classifies matching and mismatched authenticated accounts without accepting', async () => {
      const preview = {
        kind: 'team',
        email: 'invited@example.test',
        firstName: 'Invited',
        lastName: 'User',
        profileType: null,
        expiresAt: '2030-01-01T00:00:00Z',
      };
      mockPreviewInvitation.mockResolvedValue(preview);
      window.history.replaceState({}, '', '/signup?invite=team-code');

      mockGetSession.mockResolvedValueOnce({
        active: true,
        id: 'session-1',
        identity: { id: 'identity-1', traits: { email: 'INVITED@example.test' } },
      });
      const matchingStore = useSignupStore();
      await matchingStore.onMountedHandler();
      expect(matchingStore.invitationEntry.status).toBe('match');
      expect(mockAcceptInvitation).not.toHaveBeenCalled();

      setActivePinia(createPinia());
      mockGetSession.mockResolvedValueOnce({
        active: true,
        id: 'session-2',
        identity: { id: 'identity-2', traits: { email: 'other@example.test' } },
      });
      const mismatchedStore = useSignupStore();
      await mismatchedStore.onMountedHandler();
      expect(mismatchedStore.invitationEntry.status).toBe('mismatch');
      expect(mockAcceptInvitation).not.toHaveBeenCalled();
    });

    it('treats server null as authoritative and clears a cached private session', async () => {
      mockUserSession.value = {
        active: true,
        identity: { id: 'stale', traits: { email: 'stale@example.test' } },
      };
      mockPreviewInvitation.mockResolvedValue({
        kind: 'investor',
        email: 'invited@example.test',
        firstName: 'Invited',
        lastName: 'User',
        profileType: 'individual',
        expiresAt: '2030-01-01T00:00:00Z',
      });
      mockGetSession.mockResolvedValueOnce(null);
      window.history.replaceState({}, '', '/signup?invite=anonymous-code');

      const store = useSignupStore();
      await store.onMountedHandler();

      expect(mockResetAllData).toHaveBeenCalledOnce();
      expect(store.invitationEntry.status).toBe('anonymous');
    });

    it('treats an inactive session as anonymous and a blank identity email as a session error', async () => {
      const preview = {
        kind: 'team',
        email: 'invited@example.test',
        firstName: 'Invited',
        lastName: 'User',
        profileType: null,
        expiresAt: '2030-01-01T00:00:00Z',
      };
      mockPreviewInvitation.mockResolvedValue(preview);
      window.history.replaceState({}, '', '/signup?invite=session-shapes');
      mockGetSession.mockResolvedValueOnce({ active: false });
      const inactiveStore = useSignupStore();
      await inactiveStore.onMountedHandler();
      expect(mockResetAllData).toHaveBeenCalledOnce();
      expect(inactiveStore.invitationEntry.status).toBe('anonymous');

      setActivePinia(createPinia());
      mockGetSession.mockResolvedValueOnce({
        active: true,
        identity: { id: 'identity-blank', traits: { email: '   ' } },
      });
      const blankEmailStore = useSignupStore();
      await blankEmailStore.onMountedHandler();
      expect(blankEmailStore.invitationEntry.status).toBe('session-error');
    });

    it('keeps session verification failures distinct from anonymous signup', async () => {
      mockPreviewInvitation.mockResolvedValue({
        kind: 'team',
        email: 'invited@example.test',
        firstName: 'Invited',
        lastName: 'User',
        profileType: null,
        expiresAt: '2030-01-01T00:00:00Z',
      });
      mockGetSession.mockRejectedValueOnce(new Error('network down'));
      window.history.replaceState({}, '', '/signup?invite=session-error-code');

      const store = useSignupStore();
      await store.onMountedHandler();

      expect(store.invitationEntry.status).toBe('session-error');
      expect(mockResetAllData).not.toHaveBeenCalled();
    });

    it('recovers an invitation when a flow-only registration callback has expired', async () => {
      const origin = window.location.origin;
      rememberInvitationReturnForFlow({
        flowId: 'expired-registration-flow',
        invitationReturn: `${origin}/signup?invite=remembered-code`,
        origin,
      });
      window.history.replaceState({}, '', '/signup?flow=expired-registration-flow');
      mockGetSignup.mockRejectedValueOnce(new Error('flow expired'));
      mockPreviewInvitation.mockResolvedValueOnce({
        kind: 'team',
        email: 'invited@example.test',
        firstName: 'Invited',
        lastName: 'User',
        profileType: null,
        expiresAt: '2030-01-01T00:00:00Z',
      });
      mockGetSession.mockResolvedValueOnce(null);

      const store = useSignupStore();
      await store.onMountedHandler();

      expect(store.invitationCode).toBe('remembered-code');
      expect(store.invitationEntry.status).toBe('anonymous');
    });

    it('retains a flow-only invitation when session verification is retried', async () => {
      window.history.replaceState({}, '', '/signup?flow=session-retry-flow');
      mockGetSignup.mockResolvedValueOnce({
        return_to: `${window.location.origin}/signup?invite=flow-retry-code`,
      });
      mockPreviewInvitation.mockResolvedValue({
        kind: 'team',
        email: 'invited@example.test',
        firstName: 'Invited',
        lastName: 'User',
        profileType: null,
        expiresAt: '2030-01-01T00:00:00Z',
      });
      mockGetSession
        .mockRejectedValueOnce(new Error('temporary session failure'))
        .mockResolvedValueOnce(null);
      const store = useSignupStore();
      await store.onMountedHandler();
      expect(store.invitationEntry.status).toBe('session-error');

      await store.retryInvitationVerification();

      expect(store.invitationCode).toBe('flow-retry-code');
      expect(store.invitationEntry.status).toBe('anonymous');
    });

    it('locks acceptance synchronously so double activation sends one POST', async () => {
      const preview = {
        kind: 'team',
        email: 'invited@example.test',
        firstName: 'Invited',
        lastName: 'User',
        profileType: null,
        expiresAt: '2030-01-01T00:00:00Z',
      };
      window.history.replaceState({}, '', '/signup?invite=double-code');
      mockPreviewInvitation.mockResolvedValue(preview);
      const session = {
        active: true,
        id: 'session-1',
        identity: { id: 'identity-1', traits: { email: preview.email } },
      };
      mockGetSession.mockResolvedValue(session);
      mockAcceptInvitation.mockImplementation(() => new Promise(() => {}));
      const store = useSignupStore();
      await store.onMountedHandler();

      void store.acceptCurrentInvitation();
      void store.acceptCurrentInvitation();

      expect(mockAcceptInvitation).toHaveBeenCalledTimes(1);
      expect(store.invitationEntry.status).toBe('accepting');
    });

    it.each([
      [400, 'accept-error', false],
      [409, 'accept-error', false],
      [429, 'accept-error', true],
      [500, 'accept-error', true],
      [403, 'mismatch', undefined],
      [404, 'unavailable', undefined],
    ] as const)(
      'maps acceptance status %i to %s',
      async (status, expectedState, expectedRetryable) => {
        const preview = {
          kind: 'team',
          email: 'invited@example.test',
          firstName: 'Invited',
          lastName: 'User',
          profileType: null,
          expiresAt: '2030-01-01T00:00:00Z',
        };
        window.history.replaceState({}, '', `/signup?invite=status-${status}`);
        mockPreviewInvitation.mockResolvedValue(preview);
        mockGetSession.mockResolvedValue({
          active: true,
          identity: { id: 'identity-1', traits: { email: preview.email } },
        });
        mockAcceptInvitation.mockRejectedValue(Object.assign(new Error('accept failed'), {
          status,
        }));
        const store = useSignupStore();
        await store.onMountedHandler();

        await store.acceptCurrentInvitation();

        expect(store.invitationEntry.status).toBe(expectedState);
        if (expectedRetryable !== undefined) {
          expect(store.invitationEntry).toMatchObject({ retryable: expectedRetryable });
        }
      },
    );

    it('maps acceptance 401 to reset and signin with the captured invitation', async () => {
      const preview = {
        kind: 'team',
        email: 'invited@example.test',
        firstName: 'Invited',
        lastName: 'User',
        profileType: null,
        expiresAt: '2030-01-01T00:00:00Z',
      };
      window.history.replaceState({}, '', '/signup?invite=status-401');
      mockPreviewInvitation.mockResolvedValue(preview);
      mockGetSession.mockResolvedValue({
        active: true,
        identity: { id: 'identity-1', traits: { email: preview.email } },
      });
      mockAcceptInvitation.mockRejectedValue(Object.assign(new Error('unauthorized'), {
        status: 401,
      }));
      const store = useSignupStore();
      await store.onMountedHandler();

      await store.acceptCurrentInvitation();

      expect(mockResetAllData).toHaveBeenCalledOnce();
      expect(mockNavigateWithQueryParams).toHaveBeenCalledWith(
        expect.any(String),
        { redirect: '/signup?invite=status-401' },
      );
    });

    it('keeps a network acceptance failure retryable', async () => {
      const preview = {
        kind: 'team',
        email: 'invited@example.test',
        firstName: 'Invited',
        lastName: 'User',
        profileType: null,
        expiresAt: '2030-01-01T00:00:00Z',
      };
      window.history.replaceState({}, '', '/signup?invite=network-status');
      mockPreviewInvitation.mockResolvedValue(preview);
      mockGetSession.mockResolvedValue({
        active: true,
        identity: { id: 'identity-1', traits: { email: preview.email } },
      });
      mockAcceptInvitation.mockRejectedValue(Object.assign(new Error('offline'), {
        code: 'SDK_NETWORK_FAILED',
      }));
      const store = useSignupStore();
      await store.onMountedHandler();

      await store.acceptCurrentInvitation();

      expect(store.invitationEntry).toMatchObject({
        status: 'accept-error',
        retryable: true,
      });
    });

    it('retries failed navigation from the cached acceptance without another POST', async () => {
      stubWindowLocation('?invite=team-code');
      appConfig.urls.dashboard = 'https://dashboard.example.test';
      const preview = {
        kind: 'team',
        email: 'invited@example.test',
        firstName: 'Invited',
        lastName: 'User',
        profileType: null,
        expiresAt: '2030-01-01T00:00:00Z',
      };
      mockPreviewInvitation.mockResolvedValue(preview);
      mockGetSession.mockResolvedValue({
        active: true,
        id: 'session-1',
        identity: { id: 'identity-1', traits: { email: preview.email } },
      });
      mockAcceptInvitation.mockResolvedValue({
        kind: 'team',
        acceptedProfileId: null,
        selectedProfileType: null,
      });
      vi.mocked(window.location.assign).mockImplementationOnce(() => {
        throw new Error('navigation failed');
      });
      const store = useSignupStore();
      await store.onMountedHandler();

      await store.acceptCurrentInvitation();
      expect(store.invitationEntry.status).toBe('accepted-navigation-failed');
      await store.acceptCurrentInvitation();

      expect(mockAcceptInvitation).toHaveBeenCalledTimes(1);
      expect(window.location.assign).toHaveBeenLastCalledWith('https://dashboard.example.test');
    });

    it('reclassifies instead of navigating when the session identity changes during acceptance', async () => {
      stubWindowLocation('?invite=team-code');
      const preview = {
        kind: 'team',
        email: 'invited@example.test',
        firstName: 'Invited',
        lastName: 'User',
        profileType: null,
        expiresAt: '2030-01-01T00:00:00Z',
      };
      const matchingSession = {
        active: true,
        id: 'session-1',
        identity: { id: 'identity-1', traits: { email: preview.email } },
      };
      const differentSession = {
        active: true,
        id: 'session-2',
        identity: { id: 'identity-2', traits: { email: 'other@example.test' } },
      };
      mockPreviewInvitation.mockResolvedValue(preview);
      mockGetSession.mockResolvedValue(matchingSession);
      let finishAcceptance: ((value: any) => void) | undefined;
      mockAcceptInvitation.mockImplementationOnce(() => new Promise(resolve => {
        finishAcceptance = resolve;
      }));
      const store = useSignupStore();
      await store.onMountedHandler();

      const pending = store.acceptCurrentInvitation();
      mockUserSession.value = differentSession;
      mockGetSession.mockResolvedValue(differentSession);
      finishAcceptance?.({
        kind: 'team',
        acceptedProfileId: null,
        selectedProfileType: null,
      });
      await pending;

      expect(store.invitationEntry.status).toBe('mismatch');
      expect(window.location.assign).not.toHaveBeenCalled();
      expect(mockAcceptInvitation).toHaveBeenCalledTimes(1);
    });

    it('ignores a rejected acceptance result after the session identity changes', async () => {
      const preview = {
        kind: 'team',
        email: 'invited@example.test',
        firstName: 'Invited',
        lastName: 'User',
        profileType: null,
        expiresAt: '2030-01-01T00:00:00Z',
      };
      const matchingSession = {
        active: true,
        identity: { id: 'identity-1', traits: { email: preview.email } },
      };
      const differentSession = {
        active: true,
        identity: { id: 'identity-2', traits: { email: 'other@example.test' } },
      };
      window.history.replaceState({}, '', '/signup?invite=identity-failure');
      mockPreviewInvitation.mockResolvedValue(preview);
      mockGetSession.mockResolvedValue(matchingSession);
      let rejectAcceptance: ((reason: Error) => void) | undefined;
      mockAcceptInvitation.mockImplementationOnce(() => new Promise((_resolve, reject) => {
        rejectAcceptance = reject;
      }));
      const store = useSignupStore();
      await store.onMountedHandler();

      const pending = store.acceptCurrentInvitation();
      mockUserSession.value = differentSession;
      mockGetSession.mockResolvedValue(differentSession);
      rejectAcceptance?.(Object.assign(new Error('server failed'), { status: 500 }));
      await pending;

      expect(store.invitationEntry.status).toBe('mismatch');
      expect(mockAcceptInvitation).toHaveBeenCalledTimes(1);
    });

    it('captures the canonical invitation before logout and ignores a later query change', async () => {
      const preview = {
        kind: 'team',
        email: 'invited@example.test',
        firstName: 'Invited',
        lastName: 'User',
        profileType: null,
        expiresAt: '2030-01-01T00:00:00Z',
      };
      window.history.replaceState({}, '', '/signup?invite=first-code');
      mockPreviewInvitation.mockResolvedValue(preview);
      mockGetSession.mockResolvedValue({
        active: true,
        id: 'session-1',
        identity: { id: 'identity-1', traits: { email: 'other@example.test' } },
      });
      let finishLogout: ((value: { status: 'navigation-started' }) => void) | undefined;
      mockLogoutHandler.mockImplementationOnce(() => new Promise(resolve => {
        finishLogout = resolve;
      }));
      const store = useSignupStore();
      await store.onMountedHandler();

      const pending = store.logoutForCurrentInvitation();
      window.history.replaceState({}, '', '/signup?invite=second-code');
      finishLogout?.({ status: 'navigation-started' });
      await pending;

      expect(mockLogoutHandler).toHaveBeenCalledWith({
        redirectTo: '/signup?invite=first-code',
      });
      expect(mockAcceptInvitation).not.toHaveBeenCalled();
    });

    it('auto-logins the demo account when tryDemo is present without a registration flow', async () => {
      window.history.replaceState({}, '', '/signup?tryDemo=1');

      const store = useSignupStore();
      mockShouldAutoAuthenticateDemoAccount.mockReturnValue(true);

      await store.onMountedHandler();

      expect(mockShouldAutoAuthenticateDemoAccount).toHaveBeenCalledWith(window.location.search);
      expect(mockDemoAccountAuthenticate).toHaveBeenCalledTimes(1);
    });

    it('does not auto-login the demo account while continuing an existing registration flow', async () => {
      window.history.replaceState({}, '', '/signup?flow=test-flow-id&tryDemo=1');

      const store = useSignupStore();
      mockShouldAutoAuthenticateDemoAccount.mockReturnValue(true);

      await store.onMountedHandler();

      expect(mockGetSignup).toHaveBeenCalledWith('test-flow-id');
      expect(mockShouldAutoAuthenticateDemoAccount).not.toHaveBeenCalled();
      expect(mockDemoAccountAuthenticate).not.toHaveBeenCalled();
    });
  });
});
