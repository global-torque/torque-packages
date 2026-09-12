import type { App } from 'vue';
import type { InvestAppConfig } from '@webdevelop-pro/invest-core/app/config';
import {
  installInvestRuntime,
  type InstallInvestRuntimeErrorHandlingOptions,
  installDefaultApiClientHooks,
  installNativePushBridge,
  setupChunkErrorHandler,
  setupErrorHandling,
} from '@webdevelop-pro/invest-runtime';

type InstallInvestShellRuntimeErrorHandlingOptions =
  Omit<InstallInvestRuntimeErrorHandlingOptions, 'serviceName'>
  & Partial<Pick<InstallInvestRuntimeErrorHandlingOptions, 'serviceName'>>;

export type InstallInvestShellRuntimeOptions = {
  app: App;
  appConfig: InvestAppConfig;
  errorHandling?: InstallInvestShellRuntimeErrorHandlingOptions;
  installApiClientHooks?: boolean;
  installNativePush?: boolean;
};

export const installInvestShellRuntime = ({
  app,
  appConfig,
  errorHandling,
  installApiClientHooks = true,
  installNativePush = false,
}: InstallInvestShellRuntimeOptions) => {
  const context = installInvestRuntime({
    app,
    appConfig,
    errorHandling: {
      serviceName: appConfig.isStaticSite ? 'invest' : 'dashboard',
      ...errorHandling,
    },
    installApiClientHooks,
    installNativePush,
  });

  return context;
};

export {
  installDefaultApiClientHooks,
  installInvestRuntime,
  installNativePushBridge,
  setupChunkErrorHandler,
  setupErrorHandling,
};
