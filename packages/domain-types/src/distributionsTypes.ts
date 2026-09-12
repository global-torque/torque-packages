import type {
  IInvestment,
  IInvestmentDocuments,
} from './investmentTypes.ts';

export interface IDistributionsData {
  id: number;
  amount: number;
  total_amount: number;
  status: string;
  investment_id: number;
  profile_id: number;
  updated_at: string;
  investment: IInvestment;
  documents?: IInvestmentDocuments[];
  created_at: string;
}

export interface IDistributionsMeta {
  geografic_data: number[];
  geografic_labels: string[];
  performance_data: number[];
  performance_labels: number[] | string[];
}

export interface IDistributionFormatted extends IDistributionsData {
  amountFormatted: string;
  amountFormattedZero: string;
  totalAmountFormatted: string;
  totalAmountFormattedZero: string;
  createdAtFormatted: string;
  createdAtTime: string;
  updatedAtFormatted: string;
  updatedAtTime: string;
  statusFormatted: {
    text: string;
    tooltip?: string;
    color: string;
  };
  isActive: boolean;
  isCompleted: boolean;
  isPending: boolean;
}

export interface IDistributions {
  meta: IDistributionsMeta;
  count: number;
  data: IDistributionFormatted[];
}
