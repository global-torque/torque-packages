export const PROFILE_TYPES = {
  INDIVIDUAL: 'individual',
  ENTITY: 'entity',
  TRUST: 'trust',
  SDIRA: 'sdira',
  SOLO401K: 'solo401k',
} as const;

export type ProfileType = typeof PROFILE_TYPES[keyof typeof PROFILE_TYPES];
