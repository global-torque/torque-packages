import type { WalletAuthDialogOptions } from '../providers.ts';
import { useInvestWidgetProviders } from '../providers.ts';

export function useVDialogWalletAuth(options: WalletAuthDialogOptions) {
  return useInvestWidgetProviders().walletAuth.useDialog(options);
}
