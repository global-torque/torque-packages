import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref } from 'vue';
import { setActivePinia, createPinia } from 'pinia';
import { useOffersDetailsContent, OfferTabTypes } from '../useOffersDetailsContent.ts';

const breakpointMock = vi.hoisted(() => ({ isTablet: { value: false } }));

vi.mock('@global-torque/ui-kit/breakpoints', () => ({
  useBreakpoints: () => ({ isTablet: breakpointMock.isTablet }),
}));

vi.mock('@global-torque/invest-runtime/session', () => ({
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
  it('renders tables, code, entities, links and signed images in every offer text field', () => {
    const content = [
      '| Asset | Value |',
      '| --- | --- |',
      '| Fund | **42** |',
      '',
      '```html',
      '<script>alert("x")</script>',
      '```',
      '',
      '&copy; &amp; [Details](https://example.test/docs?q=1&lang=en)',
      '',
      '![Signed](https://example.test/image.png?X-Goog-Algorithm=GOOG4&X-Goog-Signature=abc)',
      '![Sized](https://example.test/image.png?width=100&height=50)',
    ].join('\n');
    const offerRef = ref({ description: content, highlights: content, risk_disclosures: content } as any);
    const result = useOffersDetailsContent(offerRef, ref(true));
    for (const html of [result.parsedDescription.value, result.parsedHighlights.value, result.parsedRiskDisclosures.value]) {
      const document = new DOMParser().parseFromString(html, 'text/html');
      expect(document.querySelector('.v-table__wrap table tbody td strong')?.textContent).toBe('42');
      expect(document.querySelector('pre code')?.textContent).toBe('<script>alert("x")</script>\n');
      expect(document.querySelector('script')).toBeNull();
      expect(document.body.textContent).toContain('© & Details');
      expect(document.querySelector('a')?.getAttribute('href')).toBe('https://example.test/docs?q=1&lang=en');
      expect([...document.querySelectorAll('img')].map(image => image.getAttribute('src'))).toEqual([
        'https://example.test/image.png',
        'https://example.test/image.png?width=100&height=50',
      ]);
    }
    offerRef.value.description = 'Updated **description**';
    expect(result.parsedDescription.value).toContain('<strong>description</strong>');
  });

});
