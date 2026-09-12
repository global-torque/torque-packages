export const InvestKycTypes = {
  none: 'none',
  new: 'new',
  pending: 'pending',
  approved: 'approved',
  declined: 'declined',
  in_progress: 'in_progress',
} as const;

export type InvestKycTypes = typeof InvestKycTypes[keyof typeof InvestKycTypes];

export interface IKycTokenResponse {
  expiration: string;
  link_token: string;
  request_id: string;
}

export interface IKycIdentity {
  id: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface IKycData {
  completed_at: string;
  created_at: string;
  status: InvestKycTypes;
}

export interface IKycProfile {
  id: number;
  user_id: number;
  kyc_status: InvestKycTypes;
  kyc_data: IKycData[];
  created_at: string;
  updated_at: string;
}

export type KycPlaidLaunchStatus = 'success' | 'exit';

export interface KycPlaidLaunchResult {
  status: KycPlaidLaunchStatus;
}
