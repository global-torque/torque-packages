import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useRepositoryInvitations } from '../invitations.repository.ts';

const invitations = vi.hoisted(() => ({
  preview: vi.fn(),
  accept: vi.fn(),
}));

vi.mock('@webdevelop-pro/invest-runtime/application-context', () => ({
  useInvestApplicationContext: () => ({
    createInvitationsSdkResource: () => invitations,
  }),
}));

describe('invitation repository', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    invitations.preview.mockReset();
    invitations.accept.mockReset();
  });

  it('loads the minimized preview from the public user-api route', async () => {
    invitations.preview.mockResolvedValueOnce({
      data: {
        kind: 'investor',
        email: 'invitee@example.test',
        firstName: 'Invite',
        lastName: 'Recipient',
        profileType: 'entity',
        expiresAt: '2030-01-01T00:00:00Z',
      },
    });
    const signal = new AbortController().signal;
    const repository = useRepositoryInvitations();

    const preview = await repository.preview('opaque-code', signal);

    expect(invitations.preview).toHaveBeenCalledWith({
      body: { code: 'opaque-code' },
      request: {
        signal,
        cache: 'no-store',
        retry: { maxRetries: 0 },
      },
    });
    expect(preview.email).toBe('invitee@example.test');
    expect(repository.previewState.data).toEqual(preview);
  });

  it('accepts through the authenticated user-api route with the final profile type', async () => {
    invitations.accept.mockResolvedValueOnce({
      data: {
        invitation: {
          kind: 'investor',
          acceptedProfileId: 'investor-73',
        },
        investor: {
          id: 'investor-73',
        },
        selectedProfileType: 'trust',
      },
    });
    const repository = useRepositoryInvitations();

    const result = await repository.accept('opaque-code', 'trust');

    expect(invitations.accept).toHaveBeenCalledWith({
      body: {
        code: 'opaque-code',
        selectedProfileType: 'trust',
      },
      request: {
        cache: 'no-store',
        retry: { maxRetries: 0 },
      },
    });
    expect(result).toEqual({
      kind: 'investor',
      acceptedProfileId: 73,
      selectedProfileType: 'trust',
    });
  });

  it('rethrows SDK failures through ActionState and resets every invitation state', async () => {
    invitations.preview.mockResolvedValueOnce({
      data: {
        kind: 'team',
        email: 'member@example.test',
        firstName: 'Team',
        lastName: 'Member',
        expiresAt: '2030-01-01T00:00:00Z',
      },
    });
    const failure = new Error('Invitation acceptance failed.');
    invitations.accept.mockRejectedValueOnce(failure);
    const repository = useRepositoryInvitations();

    await repository.preview('preview-code');
    await expect(repository.accept('accept-code')).rejects.toBe(failure);

    expect(repository.previewState).toMatchObject({
      loading: false,
      error: null,
      data: { kind: 'team', email: 'member@example.test' },
    });
    expect(repository.acceptState).toEqual({
      loading: false,
      error: failure,
      data: undefined,
    });

    repository.resetAll();

    expect(repository.previewState).toEqual({
      loading: false,
      error: null,
      data: undefined,
    });
    expect(repository.acceptState).toEqual({
      loading: false,
      error: null,
      data: undefined,
    });
  });
});
