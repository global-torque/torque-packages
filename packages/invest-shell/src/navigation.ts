import {
  configureInvestShellNavigation,
  getInvestAppLinks,
  urlBlog,
  urlBlogSingle,
  urlContactUs,
  urlCookie,
  urlFaq,
  urlHome,
  urlHowItWorks,
  urlNotifications,
  urlOffers,
  urlOfferSingle,
  urlProfile,
  urlProfileAccount,
  urlProfileCryptoWallet,
  urlProfilePortfolio,
  urlProfileWallet,
  urlProfileTabDistributions,
  urlProfileTabEarn,
  urlProfileTabPortfolio,
  urlProfileTabSummary,
  urlProfileTabWallet,
  urlSettingsAccountDetails,
  urlSettingsBankAccounts,
  urlSettingsMfa,
  urlSettingsSecurity,
  urlSettings,
  urlPrivacy,
  urlTerms,
} from './navigation/links.ts';
import { useClientIp } from '@webdevelop-pro/invest-runtime/client/useClientIp';
import { useMobileAppShell } from './navigation/useMobileAppShell.ts';
import { useMobileLayout } from './navigation/useMobileLayout.ts';
import { useDialogs } from '@webdevelop-pro/invest-runtime/dialogs';
import { useProfilesStore } from '@webdevelop-pro/invest-runtime/profiles';
import { useDomainWebSocketStore } from '@webdevelop-pro/invest-runtime/websockets';
import { useSessionStore } from '@webdevelop-pro/invest-runtime/session';
import { usePageSeo } from './navigation/usePageSeo.ts';
import { PostLinkTypes } from '@webdevelop-pro/domain-types/blogTypes';
import type { MenuItem } from './navigation/types.ts';

export {
  configureInvestShellNavigation,
  PostLinkTypes,
  getInvestAppLinks,
  urlBlog,
  urlBlogSingle,
  urlContactUs,
  urlCookie,
  urlFaq,
  urlHome,
  urlHowItWorks,
  urlNotifications,
  urlOfferSingle,
  urlOffers,
  urlProfile,
  urlProfileAccount,
  urlProfileCryptoWallet,
  urlProfilePortfolio,
  urlProfileWallet,
  urlProfileTabDistributions,
  urlProfileTabEarn,
  urlProfileTabPortfolio,
  urlProfileTabSummary,
  urlProfileTabWallet,
  urlSettingsAccountDetails,
  urlSettingsBankAccounts,
  urlSettingsMfa,
  urlSettingsSecurity,
  urlSettings,
  urlPrivacy,
  urlTerms,
  useClientIp,
  useDialogs,
  useDomainWebSocketStore,
  useMobileAppShell,
  useMobileLayout,
  usePageSeo,
  useProfilesStore,
  useSessionStore,
};
export type { MenuItem };
