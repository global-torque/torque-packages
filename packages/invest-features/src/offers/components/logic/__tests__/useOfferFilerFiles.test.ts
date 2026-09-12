import { flushPromises } from '@vue/test-utils';
import { effectScope, reactive, ref } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FilerAccess } from '@webdevelop-pro/domain-types/filerTypes';
import type { IOfferFormatted } from '@webdevelop-pro/domain-types/offerTypes';
import { useOfferFilerFiles } from '../useOfferFilerFiles.ts';

const mocks = vi.hoisted(() => ({
  fetchObjectTree: vi.fn(),
  getObjectQueryState: vi.fn(),
  reportOfflineReadError: vi.fn(),
  userLoggedIn: true,
}));

vi.mock('@webdevelop-pro/invest-runtime/filer', () => ({
  useFilerModel: () => ({
    objectInvalidationVersion: ref(0),
    fetchObjectTree: mocks.fetchObjectTree,
    getObjectQueryState: mocks.getObjectQueryState,
  }),
}));

vi.mock('@webdevelop-pro/invest-runtime/application-context', () => ({
  useInvestApplicationContext: () => ({
    appConfig: { urls: { api: { filer: 'https://filer.example.test' } } },
  }),
}));

vi.mock('@webdevelop-pro/invest-runtime/session', () => ({
  useSessionStore: () => ({ userLoggedIn: ref(mocks.userLoggedIn) }),
}));

vi.mock('@webdevelop-pro/invest-runtime/error/errorReporting', async (importOriginal) => {
  const original = await importOriginal<
    typeof import('@webdevelop-pro/invest-runtime/error/errorReporting')
  >();
  return {
    ...original,
    reportOfflineReadError: mocks.reportOfflineReadError,
  };
});

const apiError = (statusCode: number) => ({
  data: { statusCode },
});

const mountComposable = () => {
  const scope = effectScope();
  scope.run(() => {
    useOfferFilerFiles(ref({ id: 168 } as IOfferFormatted));
  });
  return scope;
};

describe('useOfferFilerFiles', () => {
  beforeEach(() => {
    mocks.fetchObjectTree.mockReset();
    mocks.getObjectQueryState.mockReset().mockImplementation(() => reactive({
      data: undefined, loading: false, error: null,
    }));
    mocks.reportOfflineReadError.mockReset();
    mocks.userLoggedIn = true;
  });

  it('requires the current public query to settle, independently of private loading', async () => {
    const publicQuery = reactive<{ data: unknown; loading: boolean; error: unknown }>({
      data: undefined, loading: false, error: null,
    });
    const privateQuery = reactive({ data: undefined, loading: true, error: null });
    mocks.getObjectQueryState.mockImplementation((access, _object, id) => id === 168
      ? access === 'public' ? publicQuery : privateQuery
      : { data: undefined, loading: false, error: null });
    mocks.fetchObjectTree.mockResolvedValue({ entities: {} });
    const offer = ref({ id: 168 } as IOfferFormatted);
    const scope = effectScope();
    const files = scope.run(() => useOfferFilerFiles(offer))!;
    expect(files.mediaReady.value).toBe(false);
    publicQuery.data = { entities: {} };
    publicQuery.loading = true;
    expect(files.mediaReady.value).toBe(false);
    publicQuery.loading = false;
    expect(files.mediaReady.value).toBe(true);
    expect(files.filesLoading.value).toBe(true);
    publicQuery.data = undefined;
    publicQuery.error = new Error('Public request failed');
    expect(files.mediaReady.value).toBe(true);
    offer.value = { id: 169 } as IOfferFormatted;
    expect(files.mediaReady.value).toBe(false);
    offer.value = { id: 0 } as IOfferFormatted;
    expect(files.mediaReady.value).toBe(true);
    scope.stop();
    await flushPromises();
  });

  it('silences a missing private offer tree without hiding other filer failures', async () => {
    const privateError = apiError(404);
    mocks.fetchObjectTree.mockImplementation(({ access }: { access: FilerAccess }) => (
      access === 'private'
        ? Promise.reject(privateError)
        : Promise.resolve({ entities: {} })
    ));

    const scope = mountComposable();
    await flushPromises();

    expect(mocks.reportOfflineReadError).toHaveBeenCalledOnce();
    expect(mocks.reportOfflineReadError).toHaveBeenCalledWith(
      privateError,
      'Failed to load offer files',
      { silent: true },
    );
    scope.stop();
  });

  it.each([
    ['private', 500],
    ['public', 404],
  ] as const)(
    'keeps reporting a %s filer %i without silent UI context',
    async (failedAccess, statusCode) => {
      const error = apiError(statusCode);
      mocks.fetchObjectTree.mockImplementation(({ access }: { access: FilerAccess }) => (
        access === failedAccess
          ? Promise.reject(error)
          : Promise.resolve({ entities: {} })
      ));

      const scope = mountComposable();
      await flushPromises();

      expect(mocks.reportOfflineReadError).toHaveBeenCalledOnce();
      expect(mocks.reportOfflineReadError).toHaveBeenCalledWith(
        error,
        'Failed to load offer files',
        undefined,
      );
      scope.stop();
    },
  );
});
