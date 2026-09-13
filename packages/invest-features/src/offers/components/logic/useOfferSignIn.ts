import { useRoute } from 'vitepress';
import { getInvestDataAppLinks } from '@global-torque/invest-data/service/dataClientConfig';
import { navigateWithQueryParams } from '@global-torque/invest-runtime/navigation';

export function useOfferSignIn() {
  const route = useRoute();

  function signIn(): void {
    const redirect = `${route.path}${window.location.search}${window.location.hash}`;
    navigateWithQueryParams(getInvestDataAppLinks().signin, { redirect });
  }

  return { signIn };
}
