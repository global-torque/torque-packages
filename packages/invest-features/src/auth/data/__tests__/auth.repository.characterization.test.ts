import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

const apiGetMock = vi.hoisted(() => vi.fn());

vi.mock('@global-torque/invest-runtime/application-context', () => ({
  useInvestApplicationContext: () => ({
    createApiClient: () => ({
      get: apiGetMock,
    }),
  }),
}));

import { useRepositoryAuth } from '../auth.repository.ts';

describe('IDS-DEFECT-003 auth logout response contract', () => {
  beforeEach(() => {
    apiGetMock.mockReset();
  });

  it('preserves the complete logout response envelope until consumer migration', async () => {
    const response = {
      data: { logout: true },
      status: 200,
      headers: new Headers({ 'x-request-id': 'logout-fixture' }),
    };
    apiGetMock.mockResolvedValue(response);
    const repository = useRepositoryAuth();

    await expect(repository.getLogout('logout-token')).resolves.toBe(response);

    expect(apiGetMock).toHaveBeenCalledWith('/self-service/logout?token=logout-token');
    expect(repository.getLogoutState.value.data).toMatchObject({
      data: { logout: true },
      status: 200,
    });
    expect(repository.getLogoutState.value.data?.headers.get('x-request-id')).toBe('logout-fixture');
  });
});
