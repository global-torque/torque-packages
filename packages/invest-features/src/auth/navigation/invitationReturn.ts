const MAX_INVITATION_CODE_LENGTH = 512;
const INVITATION_FLOW_STORAGE_KEY = 'invest.invitation-auth-flow-return';

const parseUrl = (value: string, origin: string): URL | null => {
  try {
    return new URL(value, origin);
  }
  catch {
    return null;
  }
};

export const parseInvitationCode = (url: URL): string | null => {
  const values = url.searchParams.getAll('invite');
  if (
    values.length !== 1
    || values[0].length < 1
    || values[0].length > MAX_INVITATION_CODE_LENGTH
  ) {
    return null;
  }
  return values[0];
};

export const buildCanonicalInvitationPath = (code: string): string | null => {
  if (code.length < 1 || code.length > MAX_INVITATION_CODE_LENGTH) {
    return null;
  }
  const query = new URLSearchParams({ invite: code });
  return `/signup?${query.toString()}`;
};

export const buildCanonicalInvitationUrl = (
  code: string,
  origin: string,
): string | null => {
  const path = buildCanonicalInvitationPath(code);
  if (!path) return null;
  const parsedOrigin = parseUrl(origin, origin);
  if (
    !parsedOrigin
    || !['http:', 'https:'].includes(parsedOrigin.protocol)
    || parsedOrigin.username
    || parsedOrigin.password
  ) {
    return null;
  }
  return new URL(path, parsedOrigin.origin).href;
};

export const recoverInvitationCodeFromReturn = (
  value: string | null | undefined,
  origin: string,
): string | null => {
  if (!value) return null;
  const url = parseUrl(value, origin);
  if (
    !url
    || url.origin !== origin
    || url.username
    || url.password
    || url.pathname !== '/signup'
  ) {
    return null;
  }
  return parseInvitationCode(url);
};

export const recoverInvitationCode = (options: {
  currentUrl?: string | null;
  flowReturnTo?: string | null;
  origin: string;
}): string | null => (
  recoverInvitationCodeFromReturn(options.currentUrl, options.origin)
  ?? recoverInvitationCodeFromReturn(options.flowReturnTo, options.origin)
);

export const validateLocalPostAuthReturnPath = (
  value: string | null | undefined,
  origin: string,
): string | null => {
  if (!value) return null;
  const url = parseUrl(value, origin);
  if (
    !url
    || url.origin !== origin
    || url.username
    || url.password
    || !url.pathname.startsWith('/')
  ) {
    return null;
  }
  return `${url.pathname}${url.search}${url.hash}`;
};

const invitationPathFromReturn = (
  value: string | null | undefined,
  origin: string,
): string | null => {
  const code = recoverInvitationCodeFromReturn(value, origin);
  return code ? buildCanonicalInvitationPath(code) : null;
};

export const rememberInvitationReturnForFlow = (options: {
  flowId: string | null | undefined;
  invitationReturn: string | null | undefined;
  origin: string;
}): void => {
  if (typeof sessionStorage === 'undefined' || !options.flowId) return;
  const invitationPath = invitationPathFromReturn(options.invitationReturn, options.origin);
  if (!invitationPath) return;
  try {
    sessionStorage.setItem(INVITATION_FLOW_STORAGE_KEY, JSON.stringify({
      flowId: options.flowId,
      invitationPath,
    }));
  }
  catch {
    // Flow return persistence is a recovery aid; Ory return_to remains canonical.
  }
};

export const recoverRememberedInvitationReturn = (options: {
  flowId: string | null | undefined;
  origin: string;
}): string | null => {
  if (typeof sessionStorage === 'undefined' || !options.flowId) return null;
  try {
    const stored = JSON.parse(sessionStorage.getItem(INVITATION_FLOW_STORAGE_KEY) ?? 'null');
    if (
      !stored
      || typeof stored !== 'object'
      || stored.flowId !== options.flowId
      || typeof stored.invitationPath !== 'string'
    ) {
      return null;
    }
    return invitationPathFromReturn(stored.invitationPath, options.origin);
  }
  catch {
    return null;
  }
};
