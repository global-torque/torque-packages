import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref } from 'vue';
import { setActivePinia, createPinia } from 'pinia';
import { useOffersDetailsContent, OfferTabTypes } from '../useOffersDetailsContent.ts';

const breakpointMock = vi.hoisted(() => ({ isTablet: { value: false } }));

vi.mock('@global-torque/ui-kit/breakpoints', () => ({
  useBreakpoints: () => ({ isTablet: breakpointMock.isTablet }),
}));

vi.mock('@webdevelop-pro/invest-runtime/session', () => ({
  useSessionStore: vi.fn(() => ({ userLoggedIn: ref(true) })),
}));

vi.mock('../useOfferFilerFiles.ts', () => ({
  useOfferFilerFiles: () => ({
    filesFormatted: ref([{ id: 1, typeFormatted: 'Financial Documents' }]),
    folders: ref(['investment-agreements', 'financial-documents']),
    filesLoading: ref(false),
    isOnline: ref(true),
  }),
}));

vi.mock('../../../data/offer.repository.ts', () => ({
  useRepositoryOffer: vi.fn(() => ({
    getOfferCommentsState: ref({ data: { count: 3 } }),
  })),
}));

describe('useOffersDetailsContent', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    breakpointMock.isTablet.value = false;
  });

  it('computes files, folders, headers and loading state', () => {
    const offerRef = ref(undefined as any);
    const composable = useOffersDetailsContent(offerRef);
    expect(composable.filesFormatted.value.length).toBe(1);
    expect(composable.folders.value).toEqual(['investment-agreements', 'financial-documents']);
    expect(composable.tableHeader.length).toBe(4);
    expect(composable.isFilesLoading.value).toBe(false);
    expect(composable.isOnline.value).toBe(true);
  });

  it('parses and cleans markdown for description and highlights', () => {
    const offerRef = ref({ description: 'desc', highlights: 'highl' } as any);
    const composable = useOffersDetailsContent(offerRef);
    expect(composable.parsedDescription.value).toMatch(/^<p>desc<\/p>\n?$/);
    expect(composable.parsedHighlights.value).toMatch(/^<p>highl<\/p>\n?$/);
  });

  it('builds tab options including comments count subtitle', () => {
    const offerRef = ref({ risk_disclosures: 'Risk details' } as any);
    const composable = useOffersDetailsContent(offerRef);
    const opts = composable.tabOptions.value;
    expect(opts.map(o => o.value)).toEqual([
      OfferTabTypes.description,
      OfferTabTypes.highlights,
      OfferTabTypes.risk_disclosures,
      OfferTabTypes.documents,
      OfferTabTypes.comments,
    ]);
    expect(opts.find(o => o.value === OfferTabTypes.risk_disclosures)?.label).toBe('Risks');
    expect(opts.find(o => o.value === OfferTabTypes.documents)?.label).toBe('Financial Documents');
    const comments = opts.find(o => o.value === OfferTabTypes.comments);
    expect(comments?.subTitle).toBe(3);
  });

  it('uses the compact documents label on mobile', () => {
    breakpointMock.isTablet.value = true;
    const offerRef = ref({} as any);
    const composable = useOffersDetailsContent(offerRef, ref(true));

    expect(
      composable.tabOptions.value.find(o => o.value === OfferTabTypes.documents)?.label,
    ).toBe('Docs');
  });
});
