export const AccreditationTypes = {
  new: 'new',
  pending: 'pending',
  info_required: 'info_required',
  expired: 'expired',
  approved: 'approved',
  declined: 'declined',
} as const;

export type AccreditationTypes = typeof AccreditationTypes[keyof typeof AccreditationTypes];

export interface IAccreditationData {
  completed_at: string;
  created_at: string;
  status: AccreditationTypes;
  notes?: string;
}

export interface IAccreditation {
  accreditation_data: IAccreditationData[];
  accreditation_status: AccreditationTypes;
}
