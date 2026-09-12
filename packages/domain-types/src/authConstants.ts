/**
 * Ory Kratos self-service flow paths.
 *
 * These are API endpoint path constants, not app-owned route names.
 */
export const SELFSERVICE = {
  login: '/self-service/login/browser',
  logout: '/self-service/logout/browser',
  registration: '/self-service/registration/browser',
  settings: '/self-service/settings/browser',
  recovery: '/self-service/recovery/browser',
} as const;

export type SELFSERVICE = typeof SELFSERVICE[keyof typeof SELFSERVICE];

export const AAL2_QUERY = { aal: 'aal2' } as const;
