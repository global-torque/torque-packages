import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

const apiDeleteMock = vi.hoisted(() => vi.fn());

vi.mock('../service/dataClientConfig.ts', () => ({
  createInvestDataApiClient: () => ({
    delete: apiDeleteMock,
  }),
}));

import { deleteSettingsSession } from '../settings.ts';

describe('settings transport', () => {
  beforeEach(() => {
    apiDeleteMock.mockReset();
  });

  it('passes text response mode as request config without serializing it as a DELETE body', async () => {
    apiDeleteMock.mockResolvedValue({
      data: '',
      status: 204,
      headers: new Headers(),
    });

    await expect(deleteSettingsSession('session-7')).resolves.toBe('Session deleted');

    expect(apiDeleteMock).toHaveBeenCalledOnce();
    expect(apiDeleteMock).toHaveBeenCalledWith(
      '/sessions/session-7',
      undefined,
      { type: 'text' },
    );
  });
});
