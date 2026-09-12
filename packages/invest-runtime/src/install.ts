import type { App } from "vue";
import type { InvestAppConfig } from "@webdevelop-pro/invest-core/app/config";
import { setInvestDataClientConfig } from "@webdevelop-pro/invest-data/service/dataClientConfig";
import {
  createPwaPolicyEnvFromInvestAppConfig,
  setInvestRuntimeConfig,
} from "./config.ts";
import {
  createDefaultApiClientHooks,
  installDefaultApiClientHooks,
  type InstallDefaultApiClientHooksOptions,
} from "./apiClientDefaultHooks.ts";
import {
  createInvestApplicationContext,
  installInvestApplicationContext,
  type InvestApplicationContext,
} from "./applicationContext.ts";
import {
  getInvestRuntimeAdapters,
  resolveInvestRuntimePrivateCachePartition,
} from "./adapters.ts";
import {
  setupErrorHandling,
  type SetupErrorHandlingOptions,
} from "./errorHandling.ts";
import { installNativePushBridge } from "./nativePush/nativePushBridge.ts";
import { clearPrivateRuntimeCaches } from "./pwa/pwaOfflineStore.ts";
import { reportError } from "./error/errorReporting.ts";

export type InstallInvestRuntimeErrorHandlingOptions = Omit<
  SetupErrorHandlingOptions,
  "app" | "type"
> &
  Partial<Pick<SetupErrorHandlingOptions, "type">>;

type InstallInvestRuntimeBaseOptions = {
  app?: App;
  appConfig: InvestAppConfig;
  applicationContext?: InvestApplicationContext;
  applicationKey?: string;
  installApiClientHooks?: boolean | InstallDefaultApiClientHooksOptions;
  installNativePush?: boolean;
};

export type InstallInvestRuntimeOptions =
  | (InstallInvestRuntimeBaseOptions & {
      errorHandling: InstallInvestRuntimeErrorHandlingOptions;
      installErrorHandling?: true;
    })
  | (InstallInvestRuntimeBaseOptions & {
      errorHandling?: InstallInvestRuntimeErrorHandlingOptions;
      installErrorHandling: false;
    });

const canonicalConfigJson = (value: unknown): string =>
  JSON.stringify(value, (_key, entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry))
      return entry;
    return Object.fromEntries(
      Object.entries(entry as Record<string, unknown>).sort(([left], [right]) =>
        left.localeCompare(right),
      ),
    );
  });

export function installInvestRuntime(
  options: InstallInvestRuntimeOptions,
): InvestApplicationContext {
  const {
    app,
    appConfig,
    applicationContext,
    applicationKey,
    installApiClientHooks: apiClientHooks = true,
    installNativePush = false,
  } = options;
  const effectiveAppConfig = applicationContext?.getAppConfig() ?? appConfig;
  if (
    applicationContext &&
    canonicalConfigJson(effectiveAppConfig) !== canonicalConfigJson(appConfig)
  ) {
    throw new Error(
      "installInvestRuntime received an appConfig that does not match the supplied application context.",
    );
  }
  const runtimeAdapters = getInvestRuntimeAdapters();
  const getPrivateCachePartition = () =>
    resolveInvestRuntimePrivateCachePartition(runtimeAdapters);
  const hooks = createDefaultApiClientHooks({
    pwaPolicyEnv: createPwaPolicyEnvFromInvestAppConfig(effectiveAppConfig),
    getPrivateCachePartition,
    ...(typeof apiClientHooks === "object" ? apiClientHooks : {}),
  });
  const context =
    applicationContext ??
    createInvestApplicationContext({
      appConfig: effectiveAppConfig,
      applicationKey,
      adapters: runtimeAdapters,
      apiClientHooks: hooks,
    });
  if (applicationContext) {
    context.configureAdapters(runtimeAdapters);
  }

  if (app) {
    installInvestApplicationContext(app, context);
  }

  // Temporary Phase 3 bridge for consumers that have not moved to explicit context injection yet.
  setInvestRuntimeConfig(context.getAppConfig());
  setInvestDataClientConfig(context.getDataClientConfig());

  if (apiClientHooks) {
    installDefaultApiClientHooks({
      pwaPolicyEnv: createPwaPolicyEnvFromInvestAppConfig(effectiveAppConfig),
      getPrivateCachePartition,
      ...(typeof apiClientHooks === "object" ? apiClientHooks : {}),
    });
  }

  if (typeof window !== "undefined") {
    void clearPrivateRuntimeCaches().catch((error) => {
      reportError(error, "Legacy private runtime cache cleanup failed", {
        source: "private-cache-migration",
        silent: true,
      });
    });
  }

  if (options.installErrorHandling !== false) {
    setupErrorHandling({
      app,
      type: app ? "vue" : "vitepress",
      build: appConfig.build,
      ...options.errorHandling,
    });
  }

  if (installNativePush) {
    installNativePushBridge({
      subscribeDevice: async (token) => {
        await context.createNotificationsSdkResource().subscribeDevice({
          body: { device_token: token, provider: "fcm" },
        });
      },
    });
  }

  return context;
}
