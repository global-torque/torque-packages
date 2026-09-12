export const normalizeGroupMessage = (rawMessage: string): string => {
  const msg = (rawMessage || '').toLowerCase().trim();
  if (/(cannot\s+read\s+propert(y|ies))|(can'?t\s+access\s+propert(y|ies))/.test(msg)) {
    return "can't access property";
  }
  if (/undefined\s+is\s+not\s+an?\s+object/.test(msg)) return "can't access property";
  if (/is\s+not\s+defined/.test(msg)) return 'identifier not defined';
  if (/unexpected\s+token/.test(msg)) return 'syntax error';
  if (/network\s+error/.test(msg)) return 'network error';
  if (/failed\s+to\s+fetch/.test(msg)) return 'network error';
  const firstSentence = msg.split(/[.!?]/)[0]?.trim();
  return firstSentence || 'unknown error';
};

export const formatErrorMessage = (message: string, componentName: string): string => {
  return `${message} at ${componentName}`;
};

export const getIsoTimestampFrom = (ts: unknown): string => {
  if (!ts) return new Date().toISOString();
  try {
    if (ts instanceof Date) return ts.toISOString();
    const asString = String(ts);
    const d = new Date(asString);
    return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
  } catch {
    return new Date().toISOString();
  }
};

