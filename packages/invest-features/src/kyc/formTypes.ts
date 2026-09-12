import type {
  IAccreditedInvestor,
} from '@webdevelop-pro/domain-types/profilesTypes';

export interface FormChild<TModel = Record<string, unknown>, TValidation = unknown> {
  isValid: boolean;
  validation: TValidation;
  model: TModel;
  onValidate: () => void;
}

export interface FormModelPersonalInformation {
  first_name: string;
  last_name: string;
  middle_name?: string;
  dob: string;
  address1: string;
  address2: string;
  city: string;
  state: string;
  zip_code: string;
  country: string;
  phone: string;
  citizenship: string;
  ssn?: string;
  ein?: string;
}

export interface FormModelFinancialSituation {
  accredited_investor: IAccreditedInvestor;
}
