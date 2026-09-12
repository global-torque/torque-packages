export interface VOfferCardData {
  id?: number | string;
  name?: string;
  slug?: string;
  seo_description?: string;
  href?: string;
  imageMedium?: string;
  imageSmall?: string;
  imageBig?: string;
  imageSrc?: string;
  imageSrcset?: string;
  imageSizes?: string;
  isDefaultImage?: boolean;
  minInvestmentFormatted?: string;
  targetRaiseFormatted?: string;
  pricePerShareFormatted?: string;
  isOpenEnded?: boolean;
  securityTypeFormatted?: string;
  interestRateFormatted?: string;
  dividendRateFormatted?: string;
  votingRightsFormatted?: string;
  isSecurityTypeDebt?: boolean;
  isSecurityTypeConvertibleDebt?: boolean;
  isSecurityTypeConvertibleNote?: boolean;
  isSecurityTypeEquity?: boolean;
  isSecurityTypePreferredEquity?: boolean;
  isStatusClosedSuccessfully?: boolean;
  tagText?: string;
  tagBackground?: string;
  showTag?: boolean;
  actionLabel?: string;
}

export type VOfferHrefResolver<TOffer extends VOfferCardData = VOfferCardData> = (
  offer: TOffer
) => string | undefined;

export function getDefaultOfferHref(offer?: VOfferCardData): string | undefined {
  if (!offer) {
    return undefined;
  }

  if (offer.href) {
    return offer.href;
  }

  return offer.slug ? `/${offer.slug}` : undefined;
}
