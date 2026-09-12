import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useRepositoryProfiles } from '../profiles.repository.ts';

const apiClient = vi.hoisted(() => ({
  get: vi.fn(),
  options: vi.fn(),
  patch: vi.fn(),
  post: vi.fn(),
}));

vi.mock('@webdevelop-pro/invest-data/service/dataClientConfig', () => ({
  createInvestDataApiClient: () => apiClient,
}));

const response = (imageLinkId: number) => ({
  data: {
    id: 123,
    first_name: 'Demo',
    last_name: 'User',
    image_link_id: imageLinkId,
    profiles: [],
  },
  headers: new Headers(),
});

describe('profiles repository user refresh', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    apiClient.get.mockReset();
  });

  it('bypasses browser and offline caches for authoritative refreshes', async () => {
    apiClient.get.mockResolvedValue(response(77));
    const repository = useRepositoryProfiles();
    await repository.getUser({ authoritative: true, preserveDataOnError: true });

    expect(apiClient.get).toHaveBeenCalledWith('/auth/user', expect.objectContaining({
      cache: 'no-store',
      offlineFallback: false,
      retry: 0,
    }));
    expect(repository.getUserState.data?.image_link_id).toBe(77);
    expect(repository.getUserState.loading).toBe(false);
  });

  it('keeps an older user response from overwriting a newer avatar response', async () => {
    let resolveOld!: (value: ReturnType<typeof response>) => void;
    let resolveNew!: (value: ReturnType<typeof response>) => void;
    apiClient.get
      .mockImplementationOnce(() => new Promise((resolve) => { resolveOld = resolve; }))
      .mockImplementationOnce(() => new Promise((resolve) => { resolveNew = resolve; }));
    const repository = useRepositoryProfiles();
    const oldRequest = repository.getUser();
    const newRequest = repository.getUser({ authoritative: true });

    resolveNew(response(88));
    await newRequest;
    resolveOld(response(42));
    await oldRequest;

    expect(repository.getUserState.data?.image_link_id).toBe(88);
  });

  it('preserves the visible user when an authoritative refresh fails', async () => {
    apiClient.get.mockResolvedValueOnce(response(42));
    const repository = useRepositoryProfiles();
    await repository.getUser();
    apiClient.get.mockRejectedValueOnce(new Error('refresh failed'));

    await expect(repository.getUser({ authoritative: true, preserveDataOnError: true }))
      .rejects.toThrow('refresh failed');
    expect(repository.getUserState.data?.image_link_id).toBe(42);
    expect(repository.getUserState.loading).toBe(false);
  });

  it.each(['resolve', 'reject'])('ignores a previous account response that %ss after account reset', async (result) => {
    apiClient.get.mockResolvedValueOnce(response(42));
    const repository = useRepositoryProfiles();
    await repository.getUser();
    let finish!: () => void;
    apiClient.get.mockImplementationOnce(() => new Promise((resolve, reject) => {
      finish = () => result === 'resolve' ? resolve(response(77)) : reject(new Error('old account failure'));
    }));
    const previousRequest = repository.getUser().catch(() => undefined);
    repository.resetAll();
    expect(repository.getUserState.data).toBeUndefined();
    apiClient.get.mockResolvedValueOnce({ ...response(88), data: { ...response(88).data, id: 456, first_name: 'Current' } });
    await repository.getUser();
    finish();
    await previousRequest;
    expect(repository.getUserState.data?.fullName).toBe('Current User');
    expect(repository.getUserState.data?.id).toBe(456);
    expect(repository.getUserState.error).toBeNull();
    expect(repository.getUserState.loading).toBe(false);
  });
});
