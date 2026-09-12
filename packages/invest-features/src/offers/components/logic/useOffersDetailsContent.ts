// @ts-nocheck
import {
  computed, onMounted, ref, type Ref,
} from 'vue';
import MarkdownIt from 'markdown-it';
import tableWrap from '@webdevelop-pro/invest-core/markdown/tableWrap';
import type { IOfferFormatted } from '@webdevelop-pro/domain-types/offerTypes';
import { storeToRefs } from 'pinia';
import { useSessionStore } from '@webdevelop-pro/invest-runtime/session';
import { useRepositoryOffer } from '../../data/offer.repository.ts';
import { useBreakpoints } from '@global-torque/ui-kit/breakpoints';
import { useOfferFilerFiles } from './useOfferFilerFiles.ts';

export enum OfferTabTypes {
  description = 'description',
  highlights = 'highlights',
  risk_disclosures = 'risk_disclosures',
  documents = 'documents',
  comments = 'comments',
}

export type OfferDetailsTabOption = {
  value: OfferTabTypes;
  label: string;
  subTitle?: number | null;
};

export function useOffersDetailsContent(
  offerRef: Ref<IOfferFormatted | undefined>,
  hydrationReady?: Ref<boolean>,
) {
  const userSessionStore = useSessionStore();
  const { userLoggedIn } = storeToRefs(userSessionStore);
  const { filesFormatted, folders, filesLoading, isOnline } = useOfferFilerFiles(offerRef);
  const offerRepository = useRepositoryOffer();
  const { getOfferCommentsState } = storeToRefs(offerRepository);
  const { isTablet } = useBreakpoints();
  const hasHydrated = hydrationReady ?? ref(false);
  if (!hydrationReady) {
    onMounted(() => {
      hasHydrated.value = true;
    });
  }
  const compactTabs = computed(() => hasHydrated.value && isTablet.value);

  const commentsLength = computed(() => (
    getOfferCommentsState.value.data?.count || null
  ));

  const tableHeader = [
    { text: 'Document Name', class: '' },
    { text: 'Type', class: '' },
    { text: 'Date Added', class: 'offer-details-content__date-header' },
    { text: '', class: 'offer-details-content__action-header' },
  ];

  const isFilesLoading = filesLoading;

  // Create markdown-it instance matching VitePress configuration
  const md = new MarkdownIt();
  md.use(tableWrap);

  function cleanImageUrls(htmlContent: string): string {
    const regex = /(<img\s[^>]*src="[^"]+)(\?X-Goog-Algorithm[^"]*)(")/g;
    return htmlContent?.replace(regex, '$1$3');
  }

  function parseAndClean(markdownText?: string | null) {
    if (!markdownText) return null as unknown as string | null;
    return cleanImageUrls(md.render(markdownText));
  }

  const parsedDescription = computed(() => parseAndClean(offerRef.value?.description));
  const parsedHighlights = computed(() => parseAndClean(offerRef.value?.highlights));
  const parsedRiskDisclosures = computed(
    () => parseAndClean(offerRef.value?.risk_disclosures),
  );

  const tabOptions = computed<OfferDetailsTabOption[]>(() => {
    const tabs: OfferDetailsTabOption[] = [
      {
        value: OfferTabTypes.description,
        label: 'Description',
      },
      {
        value: OfferTabTypes.highlights,
        label: 'Highlights',
      },
    ];

    if (offerRef.value?.risk_disclosures) {
      tabs.push({
        value: OfferTabTypes.risk_disclosures,
        label: 'Risks',
      });
    }

    tabs.push(
      {
        value: OfferTabTypes.documents,
        label: compactTabs.value ? 'Docs' : 'Financial Documents',
      },
      {
        value: OfferTabTypes.comments,
        label: compactTabs.value ? 'Question' : 'Ask a Question',
        subTitle: commentsLength.value,
      },
    );

    return tabs;
  });

  return {
    OfferTabTypes,
    userLoggedIn,
    filesFormatted,
    folders,
    tableHeader,
    isFilesLoading,
    isOnline,
    parsedDescription,
    parsedHighlights,
    parsedRiskDisclosures,
    tabOptions,
    compactTabs,
  };
}
