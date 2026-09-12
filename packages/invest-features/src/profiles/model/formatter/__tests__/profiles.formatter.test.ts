import { afterEach, describe, expect, it, vi } from 'vitest';
import type { IProfileIndividual } from '@webdevelop-pro/domain-types/profilesTypes';
import { ProfileFormatter } from '../profiles.formatter.ts';

describe('ProfileFormatter beneficial-owner collection', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('derives beneficial metadata from the sanitized collection', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const profile = {
      id: 1150,
      data: {
        beneficials: [
          { first_name: 'Valid', phone: '+16097337724' },
          null,
        ],
      },
    } as unknown as IProfileIndividual;

    const formatted = new ProfileFormatter(profile).format();

    expect(formatted.data.beneficials).toHaveLength(1);
    expect(formatted.hasBeneficials).toBe(true);
    expect(formatted.beneficialsCount).toBe(1);
    expect(consoleError).toHaveBeenCalledWith(
      'Skipping invalid beneficial owner at index 1',
      expect.any(TypeError),
    );
  });
});
