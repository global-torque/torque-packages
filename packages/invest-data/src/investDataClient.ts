import {
  createEvmWalletRepository,
} from './evm.ts';
import { createInvestDataClient } from './client.ts';
import { getInvestDataApiUrl } from './service/dataClientConfig.ts';

export const createInvestEvmDataRepository = () => createEvmWalletRepository(
  createInvestDataClient({
    baseUrl: getInvestDataApiUrl('evm') ?? '',
  }),
);
