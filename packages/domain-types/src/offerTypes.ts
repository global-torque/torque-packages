export const OfferStatuses = {
  new: 'new',
  draft: 'draft',
  legal_review: 'legal_review',
  legal_accepted: 'legal_accepted',
  legal_declined: 'legal_declined',
  published: 'published',
  legal_closed: 'legal_closed',
  closed_successfully: 'closed_successfully',
  closed_unsuccessfully: 'closed_unsuccessfully',
} as const;

export type OfferStatuses = typeof OfferStatuses[keyof typeof OfferStatuses];

export const PaymentScheduleTypes = {
  interest_only_monthly: 'Interest-Only Monthly',
  interest_only_quarterly: 'Interest-Only Quarterly',
  fully_amortizing_monthly: 'Fully Amortizing Monthly',
  all_at_maturity: 'All at Maturity',
  principal_at_maturity: 'Principal at Maturity',
} as const;

export type PaymentScheduleTypes = typeof PaymentScheduleTypes[keyof typeof PaymentScheduleTypes];

export const VotingRightsTypes = {
  one_vote_per_share: '1 Vote per Share',
  no_voting_rights: 'No Voting Rights',
  other: 'Other',
} as const;

export type VotingRightsTypes = typeof VotingRightsTypes[keyof typeof VotingRightsTypes];

export const DividendType = {
  none: 'None',
  cumulative: 'Cumulative',
  non_cumulative: 'Non-Cumulative',
} as const;

export type DividendType = typeof DividendType[keyof typeof DividendType];

export const DividendFrequencyTypes = {
  annually: 'Annually',
  quarterly: 'Quarterly',
  at_discretion_of_board: 'At Discretion of Board',
} as const;

export type DividendFrequencyTypes = typeof DividendFrequencyTypes[keyof typeof DividendFrequencyTypes];

export const SecurityType = {
  equity: 'Equity',
  'preferred-equity': 'Preferred Equity',
  debt: 'Debt',
  equity_warrants: 'Equity Warrants',
  preference_shares: 'Preference Shares',
  convertible_bonds: 'Convertible Bonds',
  convertible_debt: 'Convertible Debt',
  'convertible-note': 'Convertible Note',
} as const;

export type SecurityType = typeof SecurityType[keyof typeof SecurityType];

export const OfferDocumentsObjectTypes = {
  company: 'company',
  investment_agreements: 'investment-agreements',
  tax: 'tax',
} as const;

export type OfferDocumentsObjectTypes = typeof OfferDocumentsObjectTypes[keyof typeof OfferDocumentsObjectTypes];

export interface IOfferInfoData {
  wire_to: string;
  swift_id: string;
  custodian: string;
  account_number: string;
  routing_number: string;
  apy: string;
  distribution_frequency: string;
  investment_strategy: string;
  estimated_hold_period: string;
  video?: string;
}

export interface ISecurityInfo {
  voting_rights?: string;
  liquidation_preference?: string;
  dividend_type?: string;
  dividend_rate?: string;
  dividend_payment_frequency?: string;
  cn_valuation_cap?: string;
  cn_discount_rate?: string;
  cn_interest_rate?: string;
  cn_maturity_date?: string;
  interest_rate_apy?: string;
  debt_payment_schedule?: string;
  debt_maturity_date?: string;
  debt_interest_rate?: string;
  debt_term_length?: string;
  debt_term_unit?: string;
  pre_money_valuation?: number;
}

export interface OfferOnChainSummary {
  network: string;
  custody?: {
    address?: string | null;
    explorer_url?: string;
  };
  asset_token?: {
    standard: 'ERC-20' | 'ERC-7943' | 'unknown';
    symbol: string;
    name: string;
    address: string | null;
    decimals?: number;
    explorer_url?: string;
  };
  vault?: {
    standard: string;
    address?: string | null;
    explorer_url?: string;
    share_decimals?: number;
    share_symbol?: string;
  };
  latest_finalized_nav?: {
    id: number;
    version: number;
    nav_usdc_raw: string;
    vault_total_supply_raw: string;
    nav_share_supply_raw: string;
    valuation_block_number: string;
    valuation_as_of: string;
    finalized_at: string;
  } | null;
  subscription_availability?: {
    available: boolean;
    reason: 'offer_not_published'
      | 'not_open_ended'
      | 'unsupported_tokenization_engine'
      | 'vault_not_deployed'
      | null;
  };
}

export interface IOffer {
  id: number;
  name: string;
  legal_name: string;
  slug: string;
  title: string;
  security_type: string;
  price_per_share: string;
  min_investment: string;
  image_link_id: number;
  total_shares: string;
  valuation: number;
  subscribed_shares: string;
  confirmed_shares: string;
  fund_structure?: 'open_ended' | 'closed_ended';
  status: string;
  approved_at: string;
  website: string;
  state: string;
  city: string;
  security_info: ISecurityInfo;
  close_at: string;
  seo_title: string;
  seo_description: string;
  description?: string;
  highlights?: string;
  risk_disclosures?: string;
  additional_details: string;
  data?: IOfferInfoData;
  linkedin?: string;
  facebook?: string;
  twitter?: string;
  github?: string;
  instagram?: string;
  telegram?: string;
  mastodon?: string;
  reg_type?: string;
  amount_raised: number;
  target_raise: number;
  tokenization_engine?: string;
  tokenization_model?: string;
  on_chain_summary?: OfferOnChainSummary;
}

export interface IOfferData {
  count: number;
  data: IOffer[];
}

export interface IOfferSharesError {
  number_of_shares: string[];
}

export interface IOfferComment {
  created_at: string;
  comment: string;
  related?: string;
  user: {
    first_name: string;
    last_name: string;
  };
}

export interface IOfferCommentsResponse {
  count: number;
  data: IOfferComment[];
}

export interface IOfferCommentPayload {
  comment: string;
  related?: string;
  offer_id: number;
}

export interface IOfferFormatted extends IOffer {
  amountRaisedFormatted: string;
  targetRaiseFormatted: string;
  pricePerShareFormatted: string;
  valuationFormatted: string;
  preMoneyValuationFormatted: string | number | undefined;
  securityTypeFormatted: string;
  securityTypeTooltip: string | undefined;
  statusFormatted: {
    text: string;
    color: string;
  };
  approvedAtFormatted: string;
  closeAtFormatted: string;
  isDefaultImage: boolean;
  minInvestment: string;
  minInvestmentFormatted: string;
  offerFundedPercent: number;
  isOpenEnded: boolean;
  isFullyFunded: boolean;
  isClosingSoon: boolean;
  isSharesReached: boolean;
  imageBig: string;
  imageSmall: string;
  imageMedium: string;
  isNew: boolean;
  tagText: string;
  tagBackground: string;
  showTag: boolean;
  isStatusNew: boolean;
  isStatusDraft: boolean;
  isStatusLegalReview: boolean;
  isStatusLegalAccepted: boolean;
  isStatusLegalDeclined: boolean;
  isStatusPublished: boolean;
  isStatusLegalClosed: boolean;
  isStatusClosedSuccessfully: boolean;
  isStatusClosedUnsuccessfully: boolean;
  isFundingCompleted: boolean;
  votingRightsFormatted: string | undefined;
  liquidationPreferenceFormatted: string | undefined;
  dividendTypeFormatted: string | undefined;
  dividendRateFormatted: string | undefined;
  dividendPaymentFrequencyFormatted: string | undefined;
  valuationCapFormatted: string | undefined;
  discountRateFormatted: string | undefined;
  interestRateFormatted: string | undefined;
  maturityDateFormatted: string | undefined;
  interestRateApyFormatted: string | undefined;
  paymentScheduleFormatted: string | undefined;
  termLengthFormatted: string | undefined;
  isSecurityTypeConvertibleDebt: boolean;
  isSecurityTypeConvertibleNote: boolean;
  isSecurityTypeDebt: boolean;
  isSecurityTypeEquity: boolean;
  isSecurityTypePreferredEquity: boolean;
  valuationLabel: string;
  isRegD506cOffer: boolean;
}
