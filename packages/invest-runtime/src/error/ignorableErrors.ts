const DYNAMIC_IMPORT_ERROR_PATTERN = new RegExp([
  'loading chunk',
  'failed to fetch dynamically imported module',
  'importing dynamically imported module',
  'error loading dynamically imported module',
].join('|'), 'i');

export const IGNORABLE_ERROR_PATTERNS = [
  /resizeobserver.*(loop|limit exceeded)/i,
  /aborterror|aborted|canceled/i,
  // Ignore common dynamic-import/chunk-load failures (noise, usually auto-recovered)
  DYNAMIC_IMPORT_ERROR_PATTERN,
  // Expected auth failures (e.g. wrong credentials) — user behavior, not system error
  /invalid email or password/i,
];

export function isIgnorableError(error: Error): boolean {
  const s = `${error?.name ?? ''} ${error?.message ?? ''}`.toLowerCase();
  return IGNORABLE_ERROR_PATTERNS.some((p) => p.test(s));
}

export function isIgnorableErrorMessage(message: string): boolean {
  const s = (message ?? '').toLowerCase();
  return IGNORABLE_ERROR_PATTERNS.some((p) => p.test(s));
}
