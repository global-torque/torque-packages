// @ts-nocheck
import {
  IOffer,
  IOfferData,
  IOfferCommentsResponse,
  IOfferCommentPayload,
} from '@global-torque/domain-types/offerTypes';
import { useInvestApplicationContext } from '@global-torque/invest-runtime/application-context';
import {
  executeSdkReadWithCompatibilityErrors,
  resolveCompatibilityServiceRequestUrl,
  validateOfferDetailCompatibilityResponse,
  validateOfferListCompatibilityEnvelope,
} from '@global-torque/invest-data/migration/sdkReadCompatibility';
import {
  applyOfflineHydrationMeta,
  createRepositoryStates,
  formatValidCachedItems,
  withActionState,
  type OptionsStateData,
} from '../../modelState.ts';
import { acceptHMRUpdate, defineStore } from 'pinia';
import { OfferFormatter } from '@global-torque/invest-core/offer/formatter';
import { buildPublicFilerImageUrl } from '@global-torque/invest-data/filer';
import defaultOfferImage from '../assets/default.svg?url';
import { IOfferFormatted, IOffer as IOfferApp } from '@global-torque/domain-types/offerTypes';
import { INotification } from '@global-torque/domain-types/notificationsTypes';
import { createFormatterCache } from '@global-torque/invest-core/repository/formatterCache';
import { DEFAULT_OFFLINE_RESPONSE_SOURCE_HEADER } from '@global-torque/invest-data/service/apiClientHooks';

type OfferStates = {
  getOffersState: IOfferData;
  getOfferOneState: IOfferFormatted;
  getOfferCommentsState: IOfferCommentsResponse;
  setOfferCommentState: { id: number };
  setOfferCommentOptionsState: OptionsStateData;
};

const responseHeadersWithSdkSource = (response: {
  headers: Headers;
  metadata?: { source?: unknown };
}, fallbackSource?: 'network'): Headers => {
  const headers = new Headers(response.headers);
  const source = response.metadata?.source ?? fallbackSource;
  if (source === 'network' || source === 'offline-cache') {
    headers.set(DEFAULT_OFFLINE_RESPONSE_SOURCE_HEADER, source);
  }
  return headers;
};

const PUBLIC_OFFER_PAGE_LIMIT = 100;
const MAX_PUBLIC_OFFER_PAGES = 10_000;

const validReportedCount = (value, minimum) => (
  typeof value === 'number'
  && Number.isSafeInteger(value)
  && value >= minimum
    ? value
    : null
);

export const useRepositoryOffer = defineStore('repository-offer', () => {
  const applicationContext = useInvestApplicationContext();
  const apiClient = applicationContext.createApiClient('offer');
  const offersResource = applicationContext.createOffersSdkResource();
  const getOfferImageSignature = (offer: IOfferApp) => {
    const image = (
      offer as IOfferApp & {
        image?: {
          id?: number | string;
          updated_at?: string;
          url?: string;
          meta_data?: {
            big?: string;
            medium?: string;
            small?: string;
            size?: number | string;
          };
        };
      }
    )?.image;
    const metaData = image?.meta_data ?? {};

    return {
      id: image?.id ?? '',
      updated_at: image?.updated_at ?? '',
      url: image?.url ?? '',
      meta_data: {
        small: metaData.small ?? '',
        medium: metaData.medium ?? '',
        big: metaData.big ?? '',
        size: metaData.size ?? '',
      },
    };
  };
  const getOfferSignature = (offer: IOfferApp) => {
    const securityInfo = offer.security_info ?? {};
    const offerData = offer.data ?? {};
    const onChainSummary = offer.on_chain_summary;

    return JSON.stringify({
      id: offer.id ?? 0,
      name: offer.name ?? '',
      legal_name: offer.legal_name ?? '',
      slug: offer.slug ?? '',
      title: offer.title ?? '',
      security_type: offer.security_type ?? '',
      price_per_share: offer.price_per_share ?? '0',
      min_investment: offer.min_investment ?? '0',
      image_link_id: offer.image_link_id ?? 0,
      total_shares: offer.total_shares ?? '0',
      valuation: offer.valuation ?? 0,
      subscribed_shares: offer.subscribed_shares ?? '0',
      confirmed_shares: offer.confirmed_shares ?? '0',
      fund_structure: offer.fund_structure ?? '',
      status: offer.status ?? '',
      approved_at: offer.approved_at ?? '',
      close_at: offer.close_at ?? '',
      seo_title: offer.seo_title ?? '',
      seo_description: offer.seo_description ?? '',
      description: offer.description ?? '',
      highlights: offer.highlights ?? '',
      risk_disclosures: offer.risk_disclosures ?? '',
      additional_details: offer.additional_details ?? '',
      website: offer.website ?? '',
      state: offer.state ?? '',
      city: offer.city ?? '',
      amount_raised: offer.amount_raised ?? 0,
      target_raise: offer.target_raise ?? 0,
      reg_type: offer.reg_type ?? '',
      on_chain_summary: onChainSummary
        ? {
            network: onChainSummary.network ?? '',
            custody: onChainSummary.custody
              ? {
                  address: onChainSummary.custody.address ?? '',
                  explorer_url: onChainSummary.custody.explorer_url ?? '',
                }
              : undefined,
            asset_token: onChainSummary.asset_token
              ? {
                  standard: onChainSummary.asset_token.standard ?? '',
                  symbol: onChainSummary.asset_token.symbol ?? '',
                  name: onChainSummary.asset_token.name ?? '',
                  address: onChainSummary.asset_token.address ?? '',
                  decimals: onChainSummary.asset_token.decimals ?? '',
                  explorer_url: onChainSummary.asset_token.explorer_url ?? '',
                }
              : undefined,
            vault: onChainSummary.vault
              ? {
                  standard: onChainSummary.vault.standard ?? '',
                  address: onChainSummary.vault.address ?? '',
                  explorer_url: onChainSummary.vault.explorer_url ?? '',
                }
              : undefined,
          }
        : undefined,
      image: getOfferImageSignature(offer),
      linkedin: offer.linkedin ?? '',
      facebook: offer.facebook ?? '',
      twitter: offer.twitter ?? '',
      github: offer.github ?? '',
      instagram: offer.instagram ?? '',
      telegram: offer.telegram ?? '',
      mastodon: offer.mastodon ?? '',
      data: {
        wire_to: offerData.wire_to ?? '',
        swift_id: offerData.swift_id ?? '',
        custodian: offerData.custodian ?? '',
        account_number: offerData.account_number ?? '',
        routing_number: offerData.routing_number ?? '',
        apy: offerData.apy ?? '',
        distribution_frequency: offerData.distribution_frequency ?? '',
        investment_strategy: offerData.investment_strategy ?? '',
        estimated_hold_period: offerData.estimated_hold_period ?? '',
        video: offerData.video ?? '',
      },
      security_info: {
        voting_rights: securityInfo.voting_rights ?? '',
        liquidation_preference: securityInfo.liquidation_preference ?? '',
        dividend_type: securityInfo.dividend_type ?? '',
        dividend_rate: securityInfo.dividend_rate ?? '',
        dividend_payment_frequency:
          securityInfo.dividend_payment_frequency ?? '',
        cn_valuation_cap: securityInfo.cn_valuation_cap ?? '',
        cn_discount_rate: securityInfo.cn_discount_rate ?? '',
        cn_interest_rate: securityInfo.cn_interest_rate ?? '',
        cn_maturity_date: securityInfo.cn_maturity_date ?? '',
        interest_rate_apy: securityInfo.interest_rate_apy ?? '',
        debt_payment_schedule: securityInfo.debt_payment_schedule ?? '',
        debt_maturity_date: securityInfo.debt_maturity_date ?? '',
        debt_interest_rate: securityInfo.debt_interest_rate ?? '',
        debt_term_length: securityInfo.debt_term_length ?? '',
        debt_term_unit: securityInfo.debt_term_unit ?? '',
        pre_money_valuation: securityInfo.pre_money_valuation ?? 0,
      },
    });
  };
  const offerCache = createFormatterCache<IOfferApp, IOfferFormatted>({
    getKey: (offer) => Number(offer.id) || 0,
    getSignature: getOfferSignature,
    format: (offer) => new OfferFormatter(offer, {
      fallbackImage: defaultOfferImage,
      resolveImage: buildPublicFilerImageUrl,
    }).format(),
  });

  const {
    getOffersState,
    getOfferOneState,
    getOfferCommentsState,
    setOfferCommentState,
    setOfferCommentOptionsState,
    resetAll: resetActionStates,
  } = createRepositoryStates<OfferStates>({
    getOffersState: undefined,
    getOfferOneState: offerCache.format({} as IOfferApp),
    getOfferCommentsState: undefined,
    setOfferCommentState: undefined,
    setOfferCommentOptionsState: undefined,
  });

  const getOffers = async (maxPages = MAX_PUBLIC_OFFER_PAGES) => {
    let responseHeaders: Headers | null = null;
    const result = await withActionState(getOffersState, async () => {
      const allOffers: IOffer[] = [];
      let reportedCount = null;
      let countIsTrusted = true;
      let offset = 0;
      let paginationComplete = false;
      for (let pageNumber = 0; pageNumber < maxPages; pageNumber += 1) {
        let response;
        let sdkValidationError;
        try {
          response = await executeSdkReadWithCompatibilityErrors({
            execute: () => offersResource.listOffers({
              limit: PUBLIC_OFFER_PAGE_LIMIT,
              offset,
            }),
            method: 'GET',
            requestUrl: resolveCompatibilityServiceRequestUrl(
              applicationContext.dataClientConfig.apiUrls?.offer ?? '',
              `/public/offer?limit=${PUBLIC_OFFER_PAGE_LIMIT}&offset=${offset}`,
            ),
          });
        }
        catch (error) {
          if (error?.code !== 'SDK_RESPONSE_VALIDATION_FAILED') throw error;
          sdkValidationError = error;
          response = await apiClient.get('/public/offer', {
            params: { limit: PUBLIC_OFFER_PAGE_LIMIT, offset },
          });
        }
        responseHeaders = responseHeadersWithSdkSource(
          response,
          sdkValidationError ? 'network' : undefined,
        );
        let page = response.data as IOfferData;
        if (sdkValidationError) {
          try {
            page = validateOfferListCompatibilityEnvelope(response.data) as IOfferData;
          }
          catch {
            throw sdkValidationError;
          }
        }
        const items = Array.isArray(page.data) ? page.data : [];
        if (countIsTrusted) {
          const pageCount = validReportedCount(page.count, offset + items.length);
          if (pageCount === null || (reportedCount !== null && pageCount < reportedCount)) {
            countIsTrusted = false;
            reportedCount = null;
          }
          else {
            reportedCount = pageCount;
          }
        }
        allOffers.push(...items);
        offset += items.length;
        if (
          items.length < PUBLIC_OFFER_PAGE_LIMIT
          || (countIsTrusted && reportedCount !== null && offset >= reportedCount)
        ) {
          paginationComplete = true;
          break;
        }
      }
      if (!paginationComplete) {
        throw new Error(`Public offer pagination exceeded ${maxPages} pages.`);
      }

      const rawData: IOfferData = {
        count: reportedCount ?? allOffers.length,
        data: allOffers,
      };
      let formattedData = rawData;
      if (rawData.data && Array.isArray(rawData.data)) {
        const { formattedItems } = formatValidCachedItems(
          rawData.data as unknown as IOfferApp[],
          {
            format: (offer) => offerCache.format(
              validateOfferDetailCompatibilityResponse(offer) as IOfferApp,
            ),
            prune: (offers) => offerCache.prune(offers),
          },
          (offer, index) => `offer ${offer.id ?? `at index ${index}`}`,
        );
        const data = formattedItems.sort((a: IOfferFormatted, b: IOfferFormatted) => {
          if (a.isClosingSoon && !b.isClosingSoon) return 1;
          if (!a.isClosingSoon && b.isClosingSoon) return -1;
          return 0;
        });
        formattedData = {
          ...rawData,
          count: data.length,
          data,
        };
      }
      return formattedData;
    });
    if (responseHeaders) {
      applyOfflineHydrationMeta(getOffersState, responseHeaders);
    }
    return result;
  };

  const getOfferOne = async (slug: string | number) => {
    let responseHeaders: Headers | null = null;
    const result = await withActionState(getOfferOneState, async () => {
      let response;
      let sdkValidationError;
      try {
        response = await executeSdkReadWithCompatibilityErrors({
          execute: () => offersResource.getOffer({ slug }),
          method: 'GET',
          requestUrl: resolveCompatibilityServiceRequestUrl(
            applicationContext.dataClientConfig.apiUrls?.offer ?? '',
            `/public/offer/${slug}`,
          ),
        });
      }
      catch (error) {
        if (error?.code !== 'SDK_RESPONSE_VALIDATION_FAILED') throw error;
        sdkValidationError = error;
        response = await apiClient.get(`/public/offer/${slug}`);
      }
      responseHeaders = responseHeadersWithSdkSource(
        response,
        sdkValidationError ? 'network' : undefined,
      );
      let offerData = response.data as IOffer;
      if (sdkValidationError) {
        try {
          offerData = validateOfferDetailCompatibilityResponse(
            response.data,
          ) as IOffer;
        }
        catch {
          throw sdkValidationError;
        }
      }
      return offerCache.format(offerData as unknown as IOfferApp);
    });
    if (responseHeaders) {
      applyOfflineHydrationMeta(getOfferOneState, responseHeaders);
    }
    return result;
  };

  const getOfferComments = async (id: number) => {
    let responseHeaders: Headers | null = null;
    const result = await withActionState(getOfferCommentsState, async () => {
      const response = await apiClient.get(`/public/comment/${id}`);
      responseHeaders = response.headers;
      return response.data as IOfferCommentsResponse;
    });
    if (responseHeaders) {
      applyOfflineHydrationMeta(getOfferCommentsState, responseHeaders);
    }
    return result;
  };

  const setOfferComment = async (payload: IOfferCommentPayload) =>
    withActionState(setOfferCommentState, async () => {
      const response = await apiClient.post('/auth/comment', payload);
      return response.data as { id: number };
    });

  const setOfferCommentOptions = async () =>
    withActionState(setOfferCommentOptionsState, async () => {
      const response = await apiClient.options('/auth/comment');
      return response.data;
    });

  // Helper: delegate to formatter for single source of truth (accepts API or app shape)
  const getOfferFundedPercent = (offer: IOffer | IOfferApp) =>
    offer
      ? offerCache.format(offer as unknown as IOfferApp).offerFundedPercent
      : 0;

  const updateNotificationData = (notification: INotification) => {
    const { fields } = notification.data;
    const objectId = fields?.object_id;
    if (objectId === undefined) return;

    const one = getOfferOneState.value.data;
    if (one?.id === objectId) {
      const updated = { ...one, ...fields } as IOfferApp;
      getOfferOneState.value.data = offerCache.format(updated);
    }

    const list = getOffersState.value.data;
    if (!list) return;
    const items = (list as unknown as { data?: IOfferFormatted[] })?.data;
    if (!items?.length) return;
    const index = items.findIndex((t) => t.id === objectId);
    if (index === -1) return;
    const newItems = items.map((item, i) =>
      i === index
        ? offerCache.format({ ...item, ...fields } as unknown as IOfferApp)
        : item,
    );
    getOffersState.value.data = {
      ...list,
      data: newItems,
    } as unknown as IOfferData;
  };

  const resetAll = () => {
    offerCache.clear();
    resetActionStates();
  };

  // Returns the not-closed offer with the highest funded percent
  const getTopOpenOffer = (): IOfferFormatted | undefined => {
    const items = (
      getOffersState.value.data as unknown as { data?: IOfferFormatted[] }
    )?.data;
    if (!items || items.length === 0) return undefined;
    const openOffers = items.filter(
      (offer) => !offer.isFundingCompleted && offer.offerFundedPercent < 100,
    );
    if (openOffers.length === 0) return undefined;
    const result = openOffers.reduce<IOfferFormatted>(
      (best, current) =>
        current.offerFundedPercent > best.offerFundedPercent ? current : best,
      openOffers[0],
    );
    return {
      ...result,
      tagText: '🔥 Hot',
      showTag: true,
      tagBackground: 'is--background-yellow-light',
    };
  };

  return {
    // Actions
    getOffers,
    getOfferOne,
    getOfferComments,
    setOfferComment,
    setOfferCommentOptions,
    getOfferFundedPercent,
    updateNotificationData,
    getTopOpenOffer,
    resetAll,

    // States
    getOffersState,
    getOfferOneState,
    getOfferCommentsState,
    setOfferCommentState,
    setOfferCommentOptionsState,
  };
});

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useRepositoryOffer, import.meta.hot));
}
