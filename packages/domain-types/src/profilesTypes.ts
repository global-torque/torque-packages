import type { AccreditationTypes, IAccreditationData } from './accreditationTypes.ts';
import type { IKycData, InvestKycTypes } from './kycTypes.ts';

export interface IEmployment {
  type: string;
  employer_name?: string;
  role?: string;
  address1?: string;
  address2?: string;
  city?: string;
  postal_code?: string;
}

export interface IFinra {
  member_association: boolean;
  correspondence: boolean;
  member_firm_name: string;
  compliance_contact_name: string;
  compliance_contant_email: string;
}

export interface ITenPercentShareholder {
  shareholder_association: boolean;
  ticker_symbol_list: string;
}

export interface IBeneficiary {
  first_name: string;
  last_name: string;
  relationship_type: string;
  phone: string;
  email: string;
  dob: string;
}

export interface IInvestmentObjectives {
  objectives: string;
  years_experience: number;
  duration: string;
  importance_of_access: string;
  risk_comfort: string;
}

export interface IAccreditedInvestor {
  is_accredited: boolean;
}

export interface IRegCF {
  limitation_rule: boolean;
  limitation_rule_confirmation: boolean;
  annual_income: number;
  net_worth: number;
  invested_external: number;
}

export interface IOwnership {
  first_name: string;
  last_name: string;
  middle_name: string;
  dob: string;
  phone: string;
  ssn: string;
  address1: string;
  address2: string;
  city: string;
  state: string;
  zip_code: string;
  country: string;
  citizenship: string;
  nc_account_nickname?: string;
  nc_account_bank_name?: string;
}

export interface IBusinessController {
  first_name: string;
  last_name: string;
  address1: string;
  address2: string;
  city: string;
  state: string;
  zip_code: string;
  country: string;
  phone: string;
  email: string;
  dob: string;
}

export interface ITypeOfId {
  type: string;
  number: string;
}

export interface IFormPartialBeneficialOwnershipItem {
  first_name: string;
  last_name: string;
  dob: string;
  address1: string;
  address2?: string;
  city: string;
  state: string;
  zip_code: string;
  country: string;
  phone: string;
  email: string;
  non_us: string;
  ssn?: string;
  type_of_identification?: {
    id_number: string;
    country: string;
  };
}

export interface IFormPartialBeneficialOwnershipItemFormatted extends IFormPartialBeneficialOwnershipItem {
  phoneFormatted?: string;
}

export interface IUserDataIndividual {
  first_name?: string;
  last_name?: string;
  middle_name?: string;
  dob?: string;
  phone?: string;
  email?: string;
  ssn?: string;
  address1?: string;
  address2?: string;
  type?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  country?: string;
  citizenship?: string;
  nc_party_id?: string;
  nc_link_id?: string;
  employment: IEmployment;
  ip_address: string;
  beneficiary: IBeneficiary;
  risk_involved?: boolean;
  finra_affiliated: IFinra;
  accredited_investor: IAccreditedInvestor;
  resell_difficulties?: boolean;
  cancelation_restrictions?: boolean;
  educational_materials?: boolean;
  investment_objectives: IInvestmentObjectives;
  irs_backup_withholding?: boolean;
  ten_percent_shareholder?: ITenPercentShareholder;
  no_legal_advices_from_company?: boolean;
  /** Answers to fund-defined custom onboarding questions, keyed by label-derived slug. */
  custom_fields?: Record<string, string | number | boolean>;
  name?: string;
  owner_title?: string;
  tax_exempts?: string;
  solely_for_investing?: string;
  business_controller?: IBusinessController;
  type_of_identification?: ITypeOfId;
  account_number?: string;
  full_account_name?: string;
  ein?: string;
  is_full_ssn_provided: boolean;
  beneficials?: IFormPartialBeneficialOwnershipItem[];
  formattedBeneficials?: IFormPartialBeneficialOwnershipItemFormatted[];
}

export interface IProfileIndividual {
  id: number;
  escrow_id?: string;
  type: string;
  data: IUserDataIndividual;
  kyc_id: number;
  kyc_status?: InvestKycTypes;
  kyc_data?: IKycData[];
  accreditation_id: number;
  accreditation_status?: AccreditationTypes;
  accreditation_data?: IAccreditationData[];
  kyc_at: string;
  accreditation_at: string;
  wallet: IWallet;
  total_distributions?: number;
  total_investments_12_months?: number;
  total_investments?: number;
  avarange_annual: number;
  total_investments_change_percent: number;
  total_distributions_change_percent: number;
  user_id?: number;
}

export interface IProfileData {
  id?: number;
  profile_id?: number;
  user_id?: number;
  escrow_id?: string;
  profile_type?: string;
  first_name?: string;
  last_name?: string;
  middle_name?: string;
  dob?: string;
  phone?: string;
  ssn?: string;
  address1?: string;
  address2?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  country?: string;
  citizenship?: string;
  nc_party_id?: string;
  nc_account_nickname?: string;
  nc_account_bank_name?: string;
  employment?: IEmployment;
  finra_affiliated?: IFinra;
  ten_percent_shareholder?: ITenPercentShareholder;
  beneficiary?: IBeneficiary;
  investment_objectives?: IInvestmentObjectives;
  accredited_investor?: IAccreditedInvestor;
  reg_cf?: IRegCF;
  irs_backup_withholding?: boolean;
  educational_materials?: boolean;
  cancelation_restrictions?: boolean;
  resell_difficulties?: boolean;
  risk_involved?: boolean;
  no_legal_advices_from_company?: boolean;
  /** Answers to fund-defined custom onboarding questions, keyed by label-derived slug. */
  custom_fields?: Record<string, string | number | boolean>;
  total_distributions?: number;
  total_investments_12_months?: number;
  total_investments?: number;
  kyc_status?: InvestKycTypes;
  kyc_data?: IKycData[];
  accreditation_status?: AccreditationTypes;
  accreditation_data?: IAccreditationData[];
  wallet_id?: number;
}

export interface IProfile {
  accreditation_status: AccreditationTypes;
  accreditation_data: IAccreditationData[];
  accreditation_id: string;
  id: number;
  user_id: number;
  escrow_id: string;
  kyc_at: string;
  accreditation_at: string;
  created_at: string;
  updated_at: string;
  kyc_status: InvestKycTypes;
  kyc_id: string;
  kyc_data: IKycData[];
  type: string;
  data: IOwnership;
  total_investments: number;
  total_investments_12_months: number;
  total_distributions: number;
  avarange_annual: number;
  wallet_id: number;
}

export interface IUser {
  id: number;
  first_name: string;
  last_name: string;
  phone: string;
  created_at: string;
  updated_at: string;
  image_link_id: string;
  profiles: IProfileFormatted[];
}

export interface IUserFormatted extends IUser {
  fullName: string;
  createdAtFormattedShortMonth: string;
  phoneFormatted?: string;
}

export interface IProfileList {
  id: number;
  label: string;
  value: string;
  action?: IProfileListAction;
}

export interface IProfileListAction {
  type: string;
  url: string;
}

export interface ISchema {
  $schema: string;
  definitions: {
    Individual?: {
      properties: Record<string, any>;
      type: string;
      required?: string[];
    };
    RegCF?: {
      properties: Record<string, any>;
      type: string;
      required?: string[];
    };
  };
  $ref: string;
}

export interface IWallet {
  id: number;
  status: string;
}

export interface IBackgroundInfo {
  reg_cf?: {
    net_worth: number;
    annual_income: number;
    limitation_rule: boolean;
    invested_external: number;
    limitation_rule_confirmation: boolean;
  };
  accredited_investor?: {
    explanation: string;
    is_accredited: boolean;
  };
}

export interface IProfileFormatted extends IProfileIndividual {
  isTypeIndividual: boolean;
  isTypeEntity: boolean;
  isTypeTrust: boolean;
  isTypeSdira: boolean;
  isTypeSolo401k: boolean;
  isKycApproved: boolean;
  isKycInProgress: boolean;
  isKycPending: boolean;
  isKycDeclined: boolean;
  isKycNew: boolean;
  isKycNone: boolean;
  isAccreditationApproved: boolean;
  isAccreditationInProgress: boolean;
  isAccreditationPending: boolean;
  isAccreditationDeclined: boolean;
  isAccreditationNew: boolean;
  isAccreditationInfoRequired: boolean;
  isAccreditationExpired: boolean;
  isCanCallKycPlaid: boolean;
  hasBeneficials: boolean;
  beneficialsCount: number;
}
