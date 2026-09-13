import { formatProfilePhoneNumberForDisplay } from '@global-torque/invest-core/profiles/formatting';
import {
  IFormPartialBeneficialOwnershipItem,
  IFormPartialBeneficialOwnershipItemFormatted,
} from '@global-torque/domain-types/profilesTypes';

export class BeneficialsFormatter {
  private beneficial: IFormPartialBeneficialOwnershipItem;

  constructor(beneficial: IFormPartialBeneficialOwnershipItem) {
    this.beneficial = beneficial;
  }

  get phoneFormatted() {
    return formatProfilePhoneNumberForDisplay(this.beneficial.phone);
  }

  format(): IFormPartialBeneficialOwnershipItemFormatted {
    return {
      ...this.beneficial,
      phoneFormatted: this.phoneFormatted,
    };
  }
}
