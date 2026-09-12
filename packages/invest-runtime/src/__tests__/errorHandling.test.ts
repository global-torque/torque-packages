import { describe, expect, it } from 'vitest';
import { setupErrorHandling } from '../errorHandling.ts';
import { setupErrorHandling as setupInternalErrorHandling } from '../error/unifiedErrorHandler.ts';

describe('runtime error handling facade', () => {
  it('re-exports the internal setupErrorHandling implementation', () => {
    expect(setupErrorHandling).toBe(setupInternalErrorHandling);
  });
});
