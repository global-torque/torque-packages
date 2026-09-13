import {
  formatProfileDateToShortMonthDateYear,
  formatProfileUserPhoneNumber,
} from '@global-torque/invest-core/profiles/formatting';
import { IUser, IProfileFormatted, IUserFormatted, IProfileIndividual } from '@global-torque/domain-types/profilesTypes';
import { mapValidListItems } from '@global-torque/invest-runtime/repository/action-state';
import { ProfileFormatter } from './profiles.formatter.ts';

export const formatDateToShortMonthDateYear = formatProfileDateToShortMonthDateYear;
export const formatPhoneNumber = formatProfileUserPhoneNumber;

export class UserFormatter {
  private user: IUser;
  private formatProfile: (profile: IProfileIndividual) => IProfileFormatted;

  constructor(
    user: IUser,
    formatProfile: (profile: IProfileIndividual) => IProfileFormatted = (
      profile,
    ) => new ProfileFormatter(profile).format(),
  ) {
    this.user = user;
    this.formatProfile = formatProfile;
  }

  get fullName(): string {
    const first = this.user?.first_name || '';
    const last = this.user?.last_name || '';
    return `${first} ${last}`.trim();
  }

  get createdAtFormattedShortMonth(): string {
    return this.user?.created_at ? formatDateToShortMonthDateYear(this.user.created_at) : '-';
  }

  get phoneFormatted(): string | undefined {
    return this.user?.phone ? formatPhoneNumber(this.user.phone) : undefined;
  }

  private formatProfiles(): IProfileFormatted[] {
    return mapValidListItems(
      this.user?.profiles || [],
      (profile: IProfileIndividual) => this.formatProfile(profile),
      (profile, index) => `profile ${profile.id ?? `at index ${index}`}`,
    );
  }

  format(): IUserFormatted {
    return {
      ...this.user,
      fullName: this.fullName,
      createdAtFormattedShortMonth: this.createdAtFormattedShortMonth,
      phoneFormatted: this.phoneFormatted,
      profiles: this.formatProfiles(),
    } as IUserFormatted;
  }
}
