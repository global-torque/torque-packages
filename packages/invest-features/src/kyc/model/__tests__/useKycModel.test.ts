import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { createPinia, setActivePinia } from 'pinia';

const apiPostMock = vi.hoisted(() => vi.fn());
const loadPlaidScriptOnceMock = vi.hoisted(() => vi.fn());

vi.mock('@global-torque/invest-data/service/apiClient', () => ({
  ApiClient: class {
    post = apiPostMock;
    get = vi.fn();
    put = vi.fn();
    options = vi.fn();
  },
}));

vi.mock('@global-torque/invest-data/plaid', () => ({
  loadPlaidScriptOnce: loadPlaidScriptOnceMock,
}));

import { useKycModel } from '../useKycModel.ts';

const flushAsyncWork = () => new Promise<void>(resolve => setTimeout(resolve, 0));

describe('useKycModel', () => {
  const plaidCreateMock = vi.fn();
  let originalPlaid: typeof window.Plaid;

  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    apiPostMock.mockReset();
    loadPlaidScriptOnceMock.mockReset();
    loadPlaidScriptOnceMock.mockResolvedValue(undefined);
    plaidCreateMock.mockReset();
    plaidCreateMock.mockImplementation(() => ({
      open: vi.fn(),
    }));
    originalPlaid = window.Plaid;
    window.Plaid = {
      create: plaidCreateMock,
    };
  });

  afterEach(() => {
    window.Plaid = originalPlaid;
  });

  it('launches Plaid from a provided token and opens the handler via onLoad', async () => {
    const store = useKycModel();
    const resultPromise = store.handlePlaidKycToken('direct-token');

    await flushAsyncWork();

    expect(loadPlaidScriptOnceMock).toHaveBeenCalledTimes(1);
    expect(plaidCreateMock).toHaveBeenCalledWith(expect.objectContaining({
      token: 'direct-token',
      receivedRedirectUri: null,
    }));

    const plaidHandler = plaidCreateMock.mock.results[0]?.value;
    const plaidConfig = plaidCreateMock.mock.calls[0]?.[0];
    expect(plaidHandler.open).not.toHaveBeenCalled();

    plaidConfig.onLoad();
    expect(plaidHandler.open).toHaveBeenCalledTimes(1);

    plaidConfig.onSuccess('public-token', { link_session_id: 'session-1' });

    await expect(resultPromise).resolves.toEqual({ status: 'success' });
    expect(store.isPlaidLoading).toBe(false);
    expect(store.isPlaidDone).toBe(true);
  });

  it('settles with exit when success metadata does not match the current link session id', async () => {
    const store = useKycModel();
    const resultPromise = store.handlePlaidKycToken('direct-token');

    await flushAsyncWork();

    const plaidConfig = plaidCreateMock.mock.calls[0]?.[0];

    plaidConfig.onEvent('OPEN', { link_session_id: 'expected-session' });
    plaidConfig.onSuccess('public-token', { link_session_id: 'other-session' });

    await expect(resultPromise).resolves.toEqual({ status: 'exit' });
    expect(store.isPlaidLoading).toBe(false);
  });

  it('resolves an unsuccessful result when the Plaid flow exits', async () => {
    const store = useKycModel();
    const resultPromise = store.handlePlaidKycToken('direct-token');

    await flushAsyncWork();

    const plaidConfig = plaidCreateMock.mock.calls[0]?.[0];
    plaidConfig.onExit(new Error('closed'), { step: 'exit' });

    await expect(resultPromise).resolves.toEqual({ status: 'exit' });
    expect(store.isPlaidLoading).toBe(false);
    expect(store.isPlaidDone).toBe(false);
  });

  it('clears loading and rethrows when Plaid bootstrapping fails', async () => {
    const store = useKycModel();
    loadPlaidScriptOnceMock.mockRejectedValueOnce(new Error('script failed'));

    await expect(store.handlePlaidKycToken('direct-token')).rejects.toThrow('script failed');
    expect(store.isPlaidLoading).toBe(false);
    expect(store.isPlaidDone).toBe(false);
  });

  it('keeps handlePlaidKyc working through the shared token launcher', async () => {
    apiPostMock.mockResolvedValueOnce({
      data: {
        link_token: 'profile-token',
        expiration: '2099-01-01T00:00:00Z',
        request_id: 'req-1',
      },
      headers: new Headers(),
    });

    const store = useKycModel();
    const resultPromise = store.handlePlaidKyc(123);

    await flushAsyncWork();

    expect(apiPostMock).toHaveBeenCalledWith('/auth/kyc/123', {});
    await vi.waitFor(() => {
      expect(plaidCreateMock).toHaveBeenCalledWith(expect.objectContaining({
        token: 'profile-token',
      }));
    });

    const plaidConfig = plaidCreateMock.mock.calls[0]?.[0];
    plaidConfig.onSuccess('public-token', { link_session_id: 'profile-session' });

    await expect(resultPromise).resolves.toEqual({ status: 'success' });
    expect(store.tokenState.data?.link_token).toBe('profile-token');
  });

  it('resetAll clears all Plaid and token state', async () => {
    const store = useKycModel();
    void store.handlePlaidKycToken('any-token');

    await flushAsyncWork();

    expect(store.isPlaidLoading).toBe(true);

    store.resetAll();

    expect(store.tokenState.data).toBeUndefined();
    expect(store.isPlaidLoading).toBe(false);
    expect(store.isPlaidDone).toBe(false);
  });
});
