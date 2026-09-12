import {
  formatToFullDate,
} from '../formatting/dateTime.ts';
import {
  capitalizeFirstLetter,
  currency,
} from '../formatting/display.ts';
import {
  assertCanonicalDecimalString,
  assertPositiveCanonicalDecimalString,
  compareCanonicalDecimals,
  formatCanonicalUsd,
  formatExactUsd,
} from '../decimal/canonicalDecimal.ts';
import {
  calculateOfferFundedPercent,
  calculateOfferMinimumInvestment,
  isOfferClosingSoon,
  isOfferFullyFunded,
  isOfferFundingCompleted,
  isOfferNewWithinDays,
  isOfferSharesReached,
  isRegD506cOffer,
} from './metrics.ts';
import {
  IOfferFormatted, IOffer, OfferStatuses, PaymentScheduleTypes, VotingRightsTypes,
  DividendType, DividendFrequencyTypes,
} from '@webdevelop-pro/domain-types/offerTypes';

type OfferApiImage = {
  meta_data?: Partial<Record<PublicOfferImageSize, string>>;
  url?: string;
};

export type PublicOfferImageSize = 'big' | 'small' | 'medium';
export type OfferImageResolver = (
  source: number | string | null | undefined,
  size: PublicOfferImageSize,
) => string | undefined;

export interface OfferFormatterOptions {
  fallbackImage?: string;
  resolveImage?: OfferImageResolver;
}

type OfferWithApiImage = IOffer & {
  image?: OfferApiImage;
};

export class OfferFormatter {
  private offer: IOffer;
  private fallbackImage: string;
  private resolveImage: OfferImageResolver;

  constructor(offer?: IOffer, options: OfferFormatterOptions = {}) {
    this.offer = offer ? { ...this.createDefaultOffer(), ...offer } : this.createDefaultOffer();
    this.fallbackImage = options.fallbackImage ?? '';
    this.resolveImage = options.resolveImage ?? (() => undefined);
    assertCanonicalDecimalString(this.offer.price_per_share, 'price_per_share');
    assertCanonicalDecimalString(this.offer.min_investment, 'min_investment');
    assertCanonicalDecimalString(this.offer.total_shares, 'total_shares');
    assertCanonicalDecimalString(this.offer.subscribed_shares, 'subscribed_shares');
    assertCanonicalDecimalString(this.offer.confirmed_shares, 'confirmed_shares');
    if (this.offer.id > 0) {
      assertPositiveCanonicalDecimalString(this.offer.min_investment, 'min_investment');
    }
    if (this.offer.status === OfferStatuses.published) {
      this.assertPublishedShareInvariants();
    }
  }

  private assertPublishedShareInvariants(): void {
    assertPositiveCanonicalDecimalString(this.offer.price_per_share, 'price_per_share');
    assertPositiveCanonicalDecimalString(this.offer.min_investment, 'min_investment');
    if (this.offer.fund_structure === 'open_ended') {
      return;
    }
    if (compareCanonicalDecimals(this.offer.confirmed_shares, this.offer.subscribed_shares) > 0) {
      throw new RangeError('confirmed_shares must not exceed subscribed_shares');
    }
    assertPositiveCanonicalDecimalString(this.offer.total_shares, 'total_shares');
    if (this.offer.total_shares !== '0') {
      if (compareCanonicalDecimals(this.offer.subscribed_shares, this.offer.total_shares) > 0) {
        throw new RangeError('subscribed_shares must not exceed total_shares');
      }
    }
  }

  get amountRaisedFormatted() {
    return currency(this.offer.amount_raised);
  }

  get targetRaiseFormatted() {
    return this.offer.target_raise ? currency(this.offer.target_raise) : '-';
  }

  get pricePerShareFormatted() {
    return formatCanonicalUsd(this.offer.price_per_share);
  }

  get securityTypeFormatted() {
    return this.offer.security_type ? capitalizeFirstLetter(this.offer.security_type) : '-';
  }

  get securityTypeTooltip(): string | undefined {
    const securityTypeTooltips: Record<string, string> = {
      'debt': 'A loan to the company that must be repaid with interest. Investors receive fixed interest payments on a set schedule until maturity.',
      'convertible-note': 'A loan that may convert into equity (shares) in the future, usually during a financing round and often at a discount or with other benefits.',
      'equity': 'Ownership shares in the company. Common stock may include voting rights, limited voting rights, or none, depending on the terms. Holders share in profits (if dividends are declared) and potential exit upside, but are last in priority if the company liquidates.',
      'preferred-equity': 'Shares with priority over common stock for dividends and liquidation proceeds. Preferred stock may or may not include voting rights, depending on the terms.',
    };

    return this.offer.security_type ? securityTypeTooltips[this.offer.security_type.toLowerCase()] : undefined;
  }

  get isSecurityTypeConvertibleNote(): boolean {
    return this.offer.security_type === 'convertible-note';
  }

  get isSecurityTypeConvertibleDebt(): boolean {
    return this.offer.security_type === 'convertible_debt';
  }

  get isSecurityTypeDebt(): boolean {
    return this.offer.security_type === 'debt';
  }

  get isSecurityTypeEquity(): boolean {
    return this.offer.security_type === 'equity';
  }

  get isSecurityTypePreferredEquity(): boolean {
    return this.offer.security_type === 'preferred-equity';
  }

  get isRegD506cOffer(): boolean {
    return isRegD506cOffer(this.offer.reg_type);
  }

  private getApiImage(metaSize: PublicOfferImageSize): string | undefined {
    const image = (this.offer as OfferWithApiImage)?.image;
    const source = image?.meta_data?.[metaSize] || image?.url;

    return source ? this.resolveImage(source, metaSize) : undefined;
  }

  get valuationLabel(): string {
    if (this.isSecurityTypeDebt || this.isSecurityTypeConvertibleDebt || this.isSecurityTypeConvertibleNote) {
      return 'Funding Goal:';
    }
    return 'Target Raise:';
  }

  get valuationFormatted() {
    return this.offer.valuation ? currency(this.offer.valuation) : '-';
  }

  get preMoneyValuationFormatted(): string {
    const value = this.offer.security_info?.pre_money_valuation;
    if (value === undefined || value === null) {
      return '-';
    }
    return currency(value);
  }

  get approvedAtFormatted(): string {
    return this.offer.approved_at
      ? formatToFullDate(this.offer.approved_at)
      : '-';
  }

  get closeAtFormatted(): string {
    return this.offer.close_at
      ? formatToFullDate(this.offer.close_at)
      : 'not closed';
  }

  get statusFormatted() {
    const statusMap = {
      [OfferStatuses.new]: { text: 'New', color: 'blue' },
      [OfferStatuses.draft]: { text: 'Draft', color: 'gray' },
      [OfferStatuses.legal_review]: { text: 'Legal Review', color: 'yellow' },
      [OfferStatuses.legal_accepted]: { text: 'Legal Accepted', color: 'green' },
      [OfferStatuses.legal_declined]: { text: 'Legal Declined', color: 'red' },
      [OfferStatuses.published]: { text: 'Published', color: 'green' },
      [OfferStatuses.legal_closed]: { text: 'Legal Closed', color: 'orange' },
      [OfferStatuses.closed_successfully]: { text: 'Closed Successfully', color: 'green' },
      [OfferStatuses.closed_unsuccessfully]: { text: 'Closed Unsuccessfully', color: 'red' },
    };

    return {
      text: statusMap[this.offer.status as OfferStatuses]?.text || 'Unknown',
      color: statusMap[this.offer.status as OfferStatuses]?.color || 'gray',
    };
  }

  getOfferImage(metaSize: PublicOfferImageSize = 'small'): string {
    const apiImage = this.getApiImage(metaSize);
    if (apiImage) {
      return apiImage;
    }

    const imageID = this.offer?.image_link_id;
    if (imageID && (imageID > 0)) {
      return this.resolveImage(imageID, metaSize) ?? this.fallbackImage;
    }
    return this.fallbackImage;
  }

  get offerFundedPercent() {
    if (this.isOpenEnded) return 0;
    return calculateOfferFundedPercent(this.offer.subscribed_shares, this.offer.total_shares);
  }

  get isFullyFunded(): boolean {
    if (this.isOpenEnded) return false;
    return isOfferFullyFunded(this.offerFundedPercent);
  }

  get isClosingSoon(): boolean {
    if (this.isOpenEnded) return false;
    return isOfferClosingSoon(this.offerFundedPercent);
  }

  get isSharesReached(): boolean {
    if (this.isOpenEnded) return false;
    return isOfferSharesReached(
      this.offer.total_shares,
      this.offer.subscribed_shares,
      this.offer.min_investment,
      this.offer.price_per_share,
    );
  }

  get isOpenEnded(): boolean {
    return this.offer.fund_structure === 'open_ended';
  }

  get isDefaultImage(): boolean {
    return !(this.offer?.image_link_id) && !this.getApiImage('small');
  }

  get minInvestment(): string {
    return calculateOfferMinimumInvestment(this.offer.min_investment);
  }

  get minInvestmentFormatted(): string {
    return formatExactUsd(this.minInvestment, 0);
  }

  get isNew(): boolean {
    return isOfferNewWithinDays(this.offer.approved_at);
  }

  get tagText(): string {
    if (this.isFullyFunded) return 'Funded';
    if (this.isClosingSoon) return '🔥 Closing Soon';
    return 'New';
  }

  get tagBackground(): string {
    if (this.isFullyFunded) return 'is--background-secondary-light';
    if (this.isClosingSoon) return 'is--background-yellow-light';
    return 'is--background-secondary-light';
  }

  get showTag(): boolean {
    return this.isFullyFunded || this.isClosingSoon || this.isNew;
  }

  get isStatusNew(): boolean {
    return this.offer.status === OfferStatuses.new;
  }

  get isStatusDraft(): boolean {
    return this.offer.status === OfferStatuses.draft;
  }

  get isStatusLegalReview(): boolean {
    return this.offer.status === OfferStatuses.legal_review;
  }

  get isStatusLegalAccepted(): boolean {
    return this.offer.status === OfferStatuses.legal_accepted;
  }

  get isStatusLegalDeclined(): boolean {
    return this.offer.status === OfferStatuses.legal_declined;
  }

  get isStatusPublished(): boolean {
    return this.offer.status === OfferStatuses.published;
  }

  get isStatusLegalClosed(): boolean {
    return this.offer.status === OfferStatuses.legal_closed;
  }

  get isStatusClosedSuccessfully(): boolean {
    return this.offer.status === OfferStatuses.closed_successfully;
  }

  get isStatusClosedUnsuccessfully(): boolean {
    return this.offer.status === OfferStatuses.closed_unsuccessfully;
  }

  get isFundingCompleted(): boolean {
    return isOfferFundingCompleted(this.offer.status);
  }

  // Security Info Formatters
  get votingRightsFormatted(): string | undefined {
    const votingRights = this.offer.security_info?.voting_rights;
    if (!votingRights) return undefined;
    
    return VotingRightsTypes[votingRights as keyof typeof VotingRightsTypes] || votingRights;
  }

  get liquidationPreferenceFormatted(): string | undefined {
    if (this.isSecurityTypeEquity) return undefined;
    return this.offer.security_info?.liquidation_preference;
  }

  get dividendTypeFormatted(): string | undefined {
    const dividendType = this.offer.security_info?.dividend_type;
    if (!dividendType || this.isSecurityTypeEquity) return undefined;
    
    return DividendType[dividendType as keyof typeof DividendType] || dividendType;
  }

  get dividendRateFormatted(): string | undefined {
    const dividendRate = this.offer.security_info?.dividend_rate;
    if (!dividendRate) return undefined;
    
    // Convert to string to handle both string and number types
    const dividendRateStr = String(dividendRate);
    if (dividendRateStr.toLowerCase() === 'none' || dividendRateStr.toLowerCase() === '') return undefined;

    const numericValue = parseFloat(dividendRateStr);
    if (Number.isNaN(numericValue)) return dividendRateStr;

    return `${numericValue}%`;
  }

  get dividendPaymentFrequencyFormatted(): string | undefined {
    const frequency = this.offer.security_info?.dividend_payment_frequency;
    if (!frequency) return undefined;

    return DividendFrequencyTypes[frequency as keyof typeof DividendFrequencyTypes] || frequency;
  }

  get valuationCapFormatted(): string | undefined {
    const valuationCap = this.offer.security_info?.cn_valuation_cap;
    if (!valuationCap) return undefined;
    
    // Parse the value and format as currency
    const numericValue = parseFloat(valuationCap);
    if (isNaN(numericValue)) return valuationCap; // Return as-is if not a number
    
    return currency(numericValue);
  }

  get discountRateFormatted(): string | undefined {
    const discountRate = this.offer.security_info?.cn_discount_rate;
    if (!discountRate) return undefined;
    
    // Parse the value and format as percentage
    const numericValue = parseFloat(discountRate);
    if (isNaN(numericValue)) return discountRate; // Return as-is if not a number
    
    return `${numericValue}%`;
  }

  get interestRateFormatted(): string | undefined {
    const cnInterestRate = this.offer.security_info?.cn_interest_rate;
    const debtInterestRate = this.offer.security_info?.debt_interest_rate;
    
    const rate = cnInterestRate || debtInterestRate;
    if (!rate) return undefined;
    
    // Parse the value and format as percentage
    const numericValue = parseFloat(rate);
    if (isNaN(numericValue)) return rate; // Return as-is if not a number
    
    return `${numericValue}%`;
  }

  get maturityDateFormatted(): string | undefined {
    const cnMaturityDate = this.offer.security_info?.cn_maturity_date;
    const debtMaturityDate = this.offer.security_info?.debt_maturity_date;
    
    if (cnMaturityDate) {
      return formatToFullDate(cnMaturityDate);
    }
    
    if (debtMaturityDate) {
      return formatToFullDate(debtMaturityDate);
    }
    
    return undefined;
  }

  get interestRateApyFormatted(): string | undefined {
    const interestRateApy = this.offer.security_info?.interest_rate_apy;
    if (!interestRateApy) return undefined;
    
    // Parse the value and format as percentage
    const numericValue = parseFloat(interestRateApy);
    if (isNaN(numericValue)) return interestRateApy; // Return as-is if not a number
    
    return `${numericValue}%`;
  }

  get paymentScheduleFormatted(): string | undefined {
    const paymentSchedule = this.offer.security_info?.debt_payment_schedule;
    if (!paymentSchedule) return undefined;
    
    return PaymentScheduleTypes[paymentSchedule as keyof typeof PaymentScheduleTypes] || paymentSchedule;
  }

  get termLengthFormatted(): string | undefined {
    const termLength = this.offer.security_info?.debt_term_length;
    const termUnit = this.offer.security_info?.debt_term_unit;
    
    if (!termLength) return undefined;
    
    return `${termLength} ${termUnit}`;
  }

  private createDefaultOffer(): IOffer {
    return {
      id: 0,
      amount_raised: 0,
      approved_at: '',
      close_at: '',
      confirmed_shares: '0',
      image_link_id: 0,
      min_investment: '0',
      name: '',
      legal_name: '',
      price_per_share: '0',
      seo_description: '',
      seo_title: '',
      slug: '',
      description: '',
      highlights: '',
      status: 'draft',
      subscribed_shares: '0',
      title: '',
      total_shares: '0',
      fund_structure: 'closed_ended',
      valuation: 0,
      target_raise: 0,
      additional_details: '',
      website: '',
      security_type: '',
      city: '',
      state: '',
      data: {
        wire_to: '',
        swift_id: '',
        custodian: '',
        account_number: '',
        routing_number: '',
        apy: '',
        distribution_frequency: '',
        investment_strategy: '',
        estimated_hold_period: '',
      },
      security_info: {
        voting_rights: '',
        liquidation_preference: '',
        dividend_type: '',
        dividend_rate: '',
        dividend_payment_frequency: '',
        cn_valuation_cap: '',
        cn_discount_rate: '',
        cn_interest_rate: '',
        cn_maturity_date: '',
        interest_rate_apy: '',
        debt_payment_schedule: '',
        debt_maturity_date: '',
        debt_interest_rate: '',
        debt_term_length: '',
        debt_term_unit: '',
        pre_money_valuation: 0,
      },
      linkedin: '',
      facebook: '',
      twitter: '',
      github: '',
      instagram: '',
      telegram: '',
      mastodon: '',
      reg_type: '',
    };
  }

  format(): IOfferFormatted {
    return {
      ...this.offer,
      amountRaisedFormatted: this.amountRaisedFormatted,
      targetRaiseFormatted: this.targetRaiseFormatted,
      pricePerShareFormatted: this.pricePerShareFormatted,
      valuationFormatted: this.valuationFormatted,
      preMoneyValuationFormatted: this.preMoneyValuationFormatted,
      securityTypeFormatted: this.securityTypeFormatted,
      securityTypeTooltip: this.securityTypeTooltip,
      statusFormatted: this.statusFormatted,
      approvedAtFormatted: this.approvedAtFormatted,
      closeAtFormatted: this.closeAtFormatted,
      isDefaultImage: this.isDefaultImage,
      minInvestment: this.minInvestment,
      minInvestmentFormatted: this.minInvestmentFormatted,
      offerFundedPercent: this.offerFundedPercent,
      isOpenEnded: this.isOpenEnded,
      isFullyFunded: this.isFullyFunded,
      isClosingSoon: this.isClosingSoon,
      isSharesReached: this.isSharesReached,
      imageBig: this.getOfferImage('big'),
      imageSmall: this.getOfferImage('small'),
      imageMedium: this.getOfferImage('medium'),
      tagText: this.tagText,
      tagBackground: this.tagBackground,
      showTag: this.showTag,
      isNew: this.isNew,
      isStatusNew: this.isStatusNew,
      isStatusDraft: this.isStatusDraft,
      isStatusLegalReview: this.isStatusLegalReview,
      isStatusLegalAccepted: this.isStatusLegalAccepted,
      isStatusLegalDeclined: this.isStatusLegalDeclined,
      isStatusPublished: this.isStatusPublished,
      isStatusLegalClosed: this.isStatusLegalClosed,
      isStatusClosedSuccessfully: this.isStatusClosedSuccessfully,
      isStatusClosedUnsuccessfully: this.isStatusClosedUnsuccessfully,
      isFundingCompleted: this.isFundingCompleted,
      // Security Info Formatted Fields
      votingRightsFormatted: this.votingRightsFormatted,
      liquidationPreferenceFormatted: this.liquidationPreferenceFormatted,
      dividendTypeFormatted: this.dividendTypeFormatted,
      dividendRateFormatted: this.dividendRateFormatted,
      dividendPaymentFrequencyFormatted: this.dividendPaymentFrequencyFormatted,
      valuationCapFormatted: this.valuationCapFormatted,
      discountRateFormatted: this.discountRateFormatted,
      interestRateFormatted: this.interestRateFormatted,
      maturityDateFormatted: this.maturityDateFormatted,
      interestRateApyFormatted: this.interestRateApyFormatted,
      paymentScheduleFormatted: this.paymentScheduleFormatted,
      termLengthFormatted: this.termLengthFormatted,
      isSecurityTypeConvertibleDebt: this.isSecurityTypeConvertibleDebt,
      isSecurityTypeConvertibleNote: this.isSecurityTypeConvertibleNote,
      isSecurityTypeDebt: this.isSecurityTypeDebt,
      isSecurityTypeEquity: this.isSecurityTypeEquity,
      isSecurityTypePreferredEquity: this.isSecurityTypePreferredEquity,
      valuationLabel: this.valuationLabel,
      isRegD506cOffer: this.isRegD506cOffer,
    };
  }
}
