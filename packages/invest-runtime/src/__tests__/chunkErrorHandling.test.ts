import { describe, expect, it } from 'vitest';
import { setupChunkErrorHandler } from '../chunkErrorHandling.ts';
import { setupChunkErrorHandler as setupInternalChunkErrorHandler } from '../chunkErrorHandler.ts';

describe('runtime chunk error handling facade', () => {
  it('re-exports the internal setupChunkErrorHandler implementation', () => {
    expect(setupChunkErrorHandler).toBe(setupInternalChunkErrorHandler);
  });
});
