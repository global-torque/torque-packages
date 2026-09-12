import { useSessionStore } from './session/store/useSession.ts';
import { useCookies } from '@vueuse/integrations/useCookies';
import { getInvestRuntimeAdapters } from './adapters.ts';
import { cookiesOptions } from './session/store/useSession.ts';
import { clearPrivatePwaData } from './pwa/pwaOfflineStore.ts';
import { cleanupNativePushBridgeOnLogout } from './nativePush/nativePushBridge.ts';
import {
  runFullResetTargets,
  runProfileResetTargets,
} from './lifecycle/domainLifecycle.ts';

function clearAllCookies() {
  const cookies = useCookies();
  Object.keys(cookies.getAll()).forEach((key) => {
    // Pass a date in the past to expire the cookie
    cookies.remove(key, cookiesOptions(new Date(0)));
  });
}

export const resetAllProfileData = (options: { clearPrivatePwa?: boolean } = {}) => {
  const { clearPrivatePwa = true } = options;
  const { profiles, repositories } = getInvestRuntimeAdapters();

  profiles?.resetProfileData();
  // Clear any pending post-auth action so a stale deferred operation
  // (e.g. a previous withdraw) doesn't re-execute after a profile switch.
  runProfileResetTargets();

  repositories?.resetProfileRepositories();

  if (clearPrivatePwa) {
    void clearPrivatePwaData();
  }
};

/**
 * Clears state owned by the previously authenticated identity while preserving
 * the browser's newly issued authentication cookie and the replacement session
 * that the caller is about to install.
 *
 * Use this after a successful registration or another explicit account switch.
 * Logout and invalid-session flows must continue to use resetAllData().
 */
export const resetDataForIdentityChange = async () => {
  const { auth, profiles, repositories } = getInvestRuntimeAdapters();

  await cleanupNativePushBridgeOnLogout();
  profiles?.resetSelectedProfile();
  profiles?.resetAccountData?.();
  auth?.resetAll?.();
  await runFullResetTargets();
  resetAllProfileData({ clearPrivatePwa: false });
  await repositories?.resetFullRepositories();
  await clearPrivatePwaData();
};

export const resetAllData = async () => {
  const { auth, profiles, repositories } = getInvestRuntimeAdapters();

  await cleanupNativePushBridgeOnLogout();
  clearAllCookies();
  useSessionStore().resetAll();
  // Reset selectedUserProfileId ref to 0 so the auto-select watcher fires
  // for the next user's profile list (the cookie was just cleared above).
  profiles?.resetSelectedProfile();
  profiles?.resetAccountData?.();
  auth?.resetAll?.();
  await runFullResetTargets();
  resetAllProfileData({ clearPrivatePwa: false });
  await repositories?.resetFullRepositories();
  await clearPrivatePwaData();
};
