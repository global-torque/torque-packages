const isDebug =
  typeof import.meta !== 'undefined' &&
  typeof (import.meta as any).env !== 'undefined' &&
  Boolean((import.meta as any).env.DEV);

export const debugLog = (...args: unknown[]): void => {
  if (!isDebug) return;
  // Intentionally keep console logging behind the debug flag
  console.log(...args);
};

