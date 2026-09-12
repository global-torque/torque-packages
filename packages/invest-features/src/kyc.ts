import {
  VKycActionButton,
  VKycAlert,
  useKycAlertViewModel,
} from '@webdevelop-pro/invest-widgets/kyc';
import { useKycThirdParty } from './kyc/logic/useKycThirdParty.ts';
import { useKycAlertViewModel as useKycAlertModel } from './kyc/logic/useKycAlertViewModel.ts';
import { useKycModel } from './kyc/model/useKycModel.ts';

export {
  VKycActionButton,
  VKycAlert,
  useKycAlertViewModel,
  useKycThirdParty,
  useKycAlertModel,
  useKycModel,
};
export type {
  FormChild,
  FormModelFinancialSituation,
  FormModelPersonalInformation,
} from './kyc/formTypes.ts';
