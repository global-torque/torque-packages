import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import {
  DEMO_ACCOUNT_TRIGGER_QUERY_PARAM,
  shouldAutoAuthenticateDemoAccount,
  useDemoAccountAuth,
} from '../useDemoAccountAuth.ts';

const hoisted = vi.hoisted(() => {
  const mockGetAuthFlowState = { value: { error: null } };
  const mockSetLoginState = { value: { data: null, error: null as Error | null } };

  return {
    flowId: { value: 'demo-login-flow' },
    csrfToken: { value: 'demo-csrf-token' },
    mockGetAuthFlowState,
    mockSetLoginState,
    mockGetAuthFlow: vi.fn(),
    mockSetLogin: vi.fn(),
    mockUpdateSession: vi.fn(),
    navigateWithQueryParamsMock: vi.fn(),
    oryErrorHandlingMock: vi.fn(),
    oryResponseHandlingMock: vi.fn(),
    appConfig: {
      demoAccount: { email: '', password: '' },
      urls: { dashboard: 'https://dashboard.example.com', static: 'https://invest.example.com' },
    },
  };
});

vi.mock('@global-torque/invest-runtime/application-context', () => ({
  useInvestApplicationContext: () => ({ appConfig: hoisted.appConfig }),
}));

vi.mock('../../data/auth.repository.ts', () => ({
  useRepositoryAuth: () => ({
    flowId: hoisted.flowId,
    csrfToken: hoisted.csrfToken,
    getAuthFlowState: hoisted.mockGetAuthFlowState,
    setLoginState: hoisted.mockSetLoginState,
    getAuthFlow: hoisted.mockGetAuthFlow,
    setLogin: hoisted.mockSetLogin,
  }),
}));

vi.mock('@global-torque/invest-runtime/session', () => ({
  useSessionStore: () => ({
    updateSession: hoisted.mockUpdateSession,
  }),
}));

vi.mock('@global-torque/invest-runtime/navigation', () => ({
  navigateWithQueryParams: hoisted.navigateWithQueryParamsMock,
}));

vi.mock('@global-torque/invest-runtime/error/oryErrorHandling', () => ({
  oryErrorHandling: hoisted.oryErrorHandlingMock,
}));

vi.mock('@global-torque/invest-runtime/error/oryResponseHandling', () => ({
  oryResponseHandling: hoisted.oryResponseHandlingMock,
}));

const createDemoSession = () => ({
  active: true,
  authenticated_at: '2026-03-06T17:24:41.66567Z',
  authenticator_assurance_level: 'aal1',
  authentication_methods: [],
  devices: [],
  expires_at: '2026-04-05T17:24:41.66567Z',
  id: '39c1887b-80a4-41c0-b8e5-ae60e4d02d9a',
  identity: {
    id: 'b3997507-1e9b-4555-92f3-139f7601122d',
    recovery_addresses: [],
    schema_id: 'default',
    schema_url: 'https://id.webdevelop.biz/schemas/default',
    state: 'active',
    state_changed_at: '2025-03-21T18:07:09.701487Z',
    traits: {
      email: 'demo@webdevelop.pro',
      name: {
        first: 'Demo',
        last: 'User',
      },
    },
    verifiable_addresses: [],
  },
  issued_at: '2026-03-06T17:24:24.116813Z',
  tokenized: '',
});

const createFlow = () => ({
  active: '',
  expires_at: '2026-04-05T17:24:41.66567Z',
  id: 'demo-flow',
  issued_at: '2026-03-06T17:24:24.116813Z',
  request_url: 'https://id.webdevelop.biz/self-service/login/browser',
  return_to: '',
  state: {},
  transient_payload: {},
  type: 'browser',
  ui: {
    action: '',
    method: 'POST',
    nodes: [],
  },
});

const setDemoAccountCredentials = (password = 'demo-password') => {
  hoisted.appConfig.demoAccount.email = 'demo@webdevelop.pro';
  hoisted.appConfig.demoAccount.password = password;
};

describe('useDemoAccountAuth', () => {
  beforeEach(() => {
    hoisted.mockGetAuthFlow.mockReset().mockResolvedValue(createFlow());
    hoisted.mockSetLogin.mockReset().mockImplementation(async () => {
      hoisted.mockSetLoginState.value = {
        data: { session: createDemoSession() },
        error: null,
      };
    });
    hoisted.mockUpdateSession.mockReset();
    hoisted.navigateWithQueryParamsMock.mockReset();
    hoisted.oryErrorHandlingMock.mockReset().mockResolvedValue(undefined);
    hoisted.oryResponseHandlingMock.mockReset();

    hoisted.mockGetAuthFlowState.value = { error: null };
    hoisted.mockSetLoginState.value = { data: null, error: null };
    hoisted.appConfig.demoAccount.email = '';
    hoisted.appConfig.demoAccount.password = '';

    window.history.replaceState({}, '', '/signin');
    document.cookie = 'selectedUserProfileId=; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Path=/';
    document.cookie = 'ory_kratos_session=; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Path=/';
  });

  it('requests a login flow, submits the demo credentials, updates the session, and redirects to the default dashboard target', async () => {
    setDemoAccountCredentials();

    const demoAccountAuth = useDemoAccountAuth();

    expect(demoAccountAuth.isAvailable.value).toBe(true);

    const result = await demoAccountAuth.authenticate();

    expect(result).toBe(true);
    expect(hoisted.mockGetAuthFlow).toHaveBeenCalledWith('/self-service/login/browser');
    expect(hoisted.mockSetLogin).toHaveBeenCalledWith('demo-login-flow', {
      identifier: 'demo@webdevelop.pro',
      password: 'demo-password',
      method: 'password',
      csrf_token: 'demo-csrf-token',
    });
    expect(hoisted.mockUpdateSession).toHaveBeenCalledWith(createDemoSession());
    expect(hoisted.navigateWithQueryParamsMock).toHaveBeenCalledWith('https://dashboard.example.com/profile');
    expect(document.cookie).not.toContain('selectedUserProfileId=');
    expect(document.cookie).not.toContain('ory_kratos_session=');
  });

  it('honors the redirect query parameter when authenticating the demo account', async () => {
    setDemoAccountCredentials();

    window.history.replaceState(
      {},
      '',
      '/signin?redirect=https%3A%2F%2Fdashboard.example.com%2Fprofile%2F470%2Fportfolio',
    );

    const demoAccountAuth = useDemoAccountAuth();

    await demoAccountAuth.authenticate();

    expect(hoisted.navigateWithQueryParamsMock).toHaveBeenCalledWith(
      'https://dashboard.example.com/profile/470/portfolio',
    );
  });

  it('refuses missing demo credential configuration', async () => {
    const demoAccountAuth = useDemoAccountAuth();

    expect(demoAccountAuth.isAvailable.value).toBe(false);
    await expect(demoAccountAuth.authenticate()).resolves.toBe(false);
    expect(hoisted.mockGetAuthFlow).not.toHaveBeenCalled();
    expect(hoisted.mockSetLogin).not.toHaveBeenCalled();
    expect(hoisted.mockUpdateSession).not.toHaveBeenCalled();
  });

  it('surfaces login errors through the shared Ory error handler', async () => {
    const error = new Error('Invalid demo credentials');

    setDemoAccountCredentials('wrong-password');
    hoisted.mockSetLogin.mockReset().mockRejectedValue(error);

    const demoAccountAuth = useDemoAccountAuth();

    await expect(demoAccountAuth.authenticate()).resolves.toBe(false);

    expect(hoisted.oryErrorHandlingMock).toHaveBeenCalledWith(
      error,
      'login',
      expect.any(Function),
      'Failed to login demo account',
    );
    expect(hoisted.mockUpdateSession).not.toHaveBeenCalled();
    expect(hoisted.navigateWithQueryParamsMock).not.toHaveBeenCalled();
  });

  it('returns false when the login flow completes without a session', async () => {
    setDemoAccountCredentials();
    hoisted.mockSetLogin.mockReset().mockImplementation(async () => {
      hoisted.mockSetLoginState.value = {
        data: {},
        error: null,
      };
    });

    const demoAccountAuth = useDemoAccountAuth();

    await expect(demoAccountAuth.authenticate()).resolves.toBe(false);
    expect(hoisted.mockUpdateSession).not.toHaveBeenCalled();
    expect(hoisted.navigateWithQueryParamsMock).not.toHaveBeenCalled();
  });

  it('detects the try-demo URL trigger from truthy query values', () => {
    expect(shouldAutoAuthenticateDemoAccount(`?${DEMO_ACCOUNT_TRIGGER_QUERY_PARAM}`)).toBe(true);
    expect(shouldAutoAuthenticateDemoAccount(`?${DEMO_ACCOUNT_TRIGGER_QUERY_PARAM}=1`)).toBe(true);
    expect(shouldAutoAuthenticateDemoAccount(`?${DEMO_ACCOUNT_TRIGGER_QUERY_PARAM}=true`)).toBe(true);
  });

  it('ignores the try-demo URL trigger when the query is absent or explicitly disabled', () => {
    expect(shouldAutoAuthenticateDemoAccount('')).toBe(false);
    expect(shouldAutoAuthenticateDemoAccount(`?${DEMO_ACCOUNT_TRIGGER_QUERY_PARAM}=false`)).toBe(false);
    expect(shouldAutoAuthenticateDemoAccount(`?${DEMO_ACCOUNT_TRIGGER_QUERY_PARAM}=0`)).toBe(false);
  });
});
