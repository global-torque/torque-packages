import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useGlobalLoader } from './useGlobalLoader';

describe('useGlobalLoader', () => {
  beforeEach(() => setActivePinia(createPinia()));

  it('owns investment-app loading orchestration outside generic UI', () => {
    const loader = useGlobalLoader();
    expect(loader.isLoading).toBe(false);
    loader.show();
    expect(loader.isLoading).toBe(true);
    loader.toggle(false);
    expect(loader.isLoading).toBe(false);
    loader.toggle();
    expect(loader.isLoading).toBe(true);
    loader.hide();
    expect(loader.isLoading).toBe(false);
  });
});
