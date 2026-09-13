import { createInvestAppLinks } from '@global-torque/invest-core/app/config';
import { useInvestApplicationContext } from '@global-torque/invest-runtime/application-context';

/** Resolve auth navigation from the immutable configuration installed by the host app. */
export const getAuthLinks = () => {
  const { urls } = useInvestApplicationContext().appConfig;

  return createInvestAppLinks({
    dashboard: urls.dashboard,
    static: urls.static,
  });
};
