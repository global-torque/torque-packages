import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { formatKycThirdPartyScreen } from '@global-torque/invest-core/kyc/thirdPartyScreen';
import { useKycThirdParty } from '../useKycThirdParty.ts';

const handlePlaidKycToken = vi.hoisted(() => vi.fn());
const reportErrorMock = vi.hoisted(() => vi.fn());

vi.mock('../../model/useKycModel.ts', () => ({
  useKycModel: () => ({
    handlePlaidKycToken,
  }),
}));

vi.mock('@global-torque/invest-runtime/error/errorReporting', () => ({
  reportError: reportErrorMock,
}));

describe('useKycThirdParty', () => {
  let originalLocation: Location;

  beforeEach(() => {
    vi.clearAllMocks();
    originalLocation = window.location;
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { search: '?token=test-token&expiration=123&request_id=req-1' },
    });
  });

  afterEach(() => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalLocation,
    });
  });

  it('marks the flow invalid when there is no token in the URL', async () => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { search: '' },
    });

    const viewModel = useKycThirdParty();
    await viewModel.launch();

    expect(viewModel.status.value).toBe('invalidToken');
    expect(viewModel.screen.value).toEqual(formatKycThirdPartyScreen('invalidToken'));
    expect(handlePlaidKycToken).not.toHaveBeenCalled();
  });

  it('exposes a launching state until the repository resolves', async () => {
    let resolveLaunch!: (value: { status: 'success' } | null) => void;
    handlePlaidKycToken.mockReturnValue(new Promise((resolve) => {
      resolveLaunch = resolve;
    }));

    const viewModel = useKycThirdParty();
    const launchPromise = viewModel.launch();

    expect(viewModel.status.value).toBe('launching');
    expect(viewModel.screen.value).toEqual(formatKycThirdPartyScreen('launching'));

    resolveLaunch({ status: 'success' });
    await launchPromise;
  });

  it('marks the flow successful when Plaid completes', async () => {
    handlePlaidKycToken.mockResolvedValue({ status: 'success' });

    const viewModel = useKycThirdParty();
    await viewModel.launch();

    expect(handlePlaidKycToken).toHaveBeenCalledWith('test-token');
    expect(viewModel.status.value).toBe('success');
    expect(viewModel.screen.value).toEqual(formatKycThirdPartyScreen('success'));
  });

  it('marks the flow incomplete when the repository returns an unsuccessful result', async () => {
    handlePlaidKycToken.mockResolvedValue({ status: 'exit' });

    const viewModel = useKycThirdParty();
    await viewModel.launch();

    expect(viewModel.status.value).toBe('incomplete');
    expect(viewModel.screen.value).toEqual(formatKycThirdPartyScreen('incomplete'));
  });

  it('also marks the flow incomplete when the repository returns null', async () => {
    handlePlaidKycToken.mockResolvedValue(null);

    const viewModel = useKycThirdParty();
    await viewModel.launch();

    expect(viewModel.status.value).toBe('incomplete');
    expect(viewModel.screen.value).toEqual(formatKycThirdPartyScreen('incomplete'));
  });

  it('reports the error and marks the flow failed when the repository throws', async () => {
    const error = new Error('kyc failed');
    handlePlaidKycToken.mockRejectedValue(error);

    const viewModel = useKycThirdParty();
    await viewModel.launch();

    expect(reportErrorMock).toHaveBeenCalledWith(error, 'Failed to handle Plaid KYC');
    expect(viewModel.status.value).toBe('error');
    expect(viewModel.screen.value).toEqual(formatKycThirdPartyScreen('error'));
  });

  it('does not expose the raw token or query objects', () => {
    const viewModel = useKycThirdParty();

    expect(viewModel).not.toHaveProperty('token');
    expect(viewModel).not.toHaveProperty('query');
  });
});
