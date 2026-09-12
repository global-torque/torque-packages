import { afterEach, describe, expect, it, vi } from 'vitest';
import type {
  IProfileFormatted,
  IProfileIndividual,
  IUser,
} from '@webdevelop-pro/domain-types/profilesTypes';
import { UserFormatter } from '../user.formatter.ts';

describe('UserFormatter profile collection', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('logs and skips a malformed profile without dropping later valid profiles', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const profiles = [1, 2, 3].map((id) => ({ id }) as IProfileIndividual);
    const user = {
      id: 10,
      first_name: 'Demo',
      last_name: 'User',
      profiles,
    } as IUser;
    const formatProfile = vi.fn((profile: IProfileIndividual) => {
      if (profile.id === 2) throw new TypeError('profile is malformed');
      return { ...profile, formatted: true } as unknown as IProfileFormatted;
    });

    const formatted = new UserFormatter(user, formatProfile).format();

    expect(formatted.profiles.map((profile) => profile.id)).toEqual([1, 3]);
    expect(formatProfile).toHaveBeenCalledTimes(3);
    expect(consoleError).toHaveBeenCalledWith(
      'Skipping invalid profile 2',
      expect.objectContaining({ message: 'profile is malformed' }),
    );
  });
});
