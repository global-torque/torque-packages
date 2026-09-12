import {
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { createFormatterCache } from '../formatterCache';

describe('formatterCache', () => {
  it('reuses formatted values while item signatures are unchanged', () => {
    const format = vi.fn((item: { id: number; value: string }) => item.value.toUpperCase());
    const cache = createFormatterCache({
      getKey: (item: { id: number }) => item.id,
      getSignature: (item: { value: string }) => item.value,
      format,
    });

    expect(cache.format({ id: 1, value: 'alpha' })).toBe('ALPHA');
    expect(cache.format({ id: 1, value: 'alpha' })).toBe('ALPHA');
    expect(format).toHaveBeenCalledTimes(1);

    expect(cache.format({ id: 1, value: 'beta' })).toBe('BETA');
    expect(format).toHaveBeenCalledTimes(2);
  });

  it('prunes old keys and clears the cache', () => {
    const format = vi.fn((item: { id: number; value: string }) => item.value);
    const cache = createFormatterCache({
      getKey: (item: { id: number }) => item.id,
      getSignature: (item: { value: string }) => item.value,
      format,
    });

    cache.formatMany([
      { id: 1, value: 'one' },
      { id: 2, value: 'two' },
    ]);
    cache.prune([{ id: 1, value: 'one' }]);
    cache.format({ id: 2, value: 'two' });
    cache.clear();
    cache.format({ id: 1, value: 'one' });

    expect(format).toHaveBeenCalledTimes(4);
  });
});
