import { getInvestRuntimeAdapters } from '../adapters.ts';
import { getInvestRuntimeConfig, getInvestRuntimeLinks } from '../config.ts';
import { navigateWithQueryParams } from '@webdevelop-pro/invest-runtime/navigation';
import { toast } from 'vue-sonner';
import { reportError } from './errorReporting.ts';
import { h } from 'vue';

type FlowType = 'login' | 'registration' | 'settings' | 'recovery' | 'verification' | 'logout' | 'signup' | 'browser';

export interface OryErrorHandlingOptions {
  postAuthReturnPath?: string | null;
}

/** Minimal shape of Ory flow response JSON (error or flow data). */
interface OryResponseJson {
  ui?: { messages?: Array<{ type?: string; text?: string; id?: number; context?: Record<string, unknown> }> };
  error?: { id?: string };
  redirect_browser_to?: string;
}

const TOAST_OPTIONS = {
  title: 'Something went wrong',
  description: 'Please try again',
} as const;

const CREDENTIALS_ERROR_ID = 4000006;
const BROWSER_LOCATION_CHANGE_REQUIRED = 'browser_location_change_required';

type OryCompatibilityError = {
  data?: {
    responseJson?: OryResponseJson;
    httpRequest?: { url?: unknown };
  };
};

const isRecord = (value: unknown): value is Record<string, unknown> => (
  value !== null && typeof value === 'object' && !Array.isArray(value)
);

const readOryResponseJson = (value: unknown): OryResponseJson | undefined => {
  if (!isRecord(value)) return undefined;
  const errorRecord = isRecord(value.error) ? value.error : undefined;
  const uiRecord = isRecord(value.ui) ? value.ui : undefined;
  const messages = Array.isArray(uiRecord?.messages)
    ? uiRecord.messages.flatMap((message) => {
        if (!isRecord(message)) return [];
        return [{
          ...(typeof message.type === 'string' ? { type: message.type } : {}),
          ...(typeof message.text === 'string' ? { text: message.text } : {}),
          ...(typeof message.id === 'number' ? { id: message.id } : {}),
        }];
      })
    : undefined;

  return {
    ...(messages ? { ui: { messages } } : {}),
    ...(typeof errorRecord?.id === 'string' ? { error: { id: errorRecord.id } } : {}),
    ...(typeof value.redirect_browser_to === 'string'
      ? { redirect_browser_to: value.redirect_browser_to }
      : {}),
  };
};

const readOryCompatibilityError = (value: unknown): OryCompatibilityError => {
  if (!isRecord(value) || !isRecord(value.data)) return {};
  const httpRequest = isRecord(value.data.httpRequest) ? value.data.httpRequest : undefined;
  const responseJson = readOryResponseJson(value.data.responseJson);
  return {
    data: {
      ...(responseJson ? { responseJson } : {}),
      ...(typeof httpRequest?.url === 'string' ? { httpRequest: { url: httpRequest.url } } : {}),
    },
  };
};

const isRequestFromConfiguredOryService = (error: OryCompatibilityError): boolean => {
  const requestUrl = error.data?.httpRequest?.url;
  const configuredOryUrl = getInvestRuntimeConfig().urls.api.kratos;
  if (typeof requestUrl !== 'string' || typeof configuredOryUrl !== 'string') return false;

  try {
    const request = new URL(requestUrl);
    const service = new URL(configuredOryUrl);
    if (request.origin !== service.origin) return false;

    const servicePath = service.pathname.replace(/\/+$/u, '');
    return servicePath === ''
      || servicePath === '/'
      || request.pathname === servicePath
      || request.pathname.startsWith(`${servicePath}/`);
  }
  catch {
    return false;
  }
};

const parseApprovedBrowserRedirect = (value: unknown): URL | null => {
  if (typeof value !== 'string' || value.trim() === '') return null;
  try {
    const url = new URL(value);
    if (url.username || url.password) return null;
    if (url.protocol === 'https:') return url;
    const config = getInvestRuntimeConfig();
    if (url.protocol !== 'http:' || !config.isDev) return null;
    const configuredOrigins = [config.urls.frontend, config.urls.dashboard]
      .filter((candidate): candidate is string => typeof candidate === 'string')
      .flatMap((candidate) => {
        try {
          const configured = new URL(candidate);
          return configured.protocol === 'http:' ? [configured.origin] : [];
        }
        catch {
          return [];
        }
      });
    return configuredOrigins.includes(url.origin) ? url : null;
  }
  catch {
    return null;
  }
};

/**
 * Ory Kratos error handling (toast, navigation, dialogs).
 * Call from ViewModel/guard in catch blocks — not from repository.
 * @param _flowType - Unused; kept for API compatibility. May be used for logging later.
 */
export const oryErrorHandling = async (
  error: unknown,
  _flowType: FlowType,
  resetFlow: () => void,
  comment: string,
  onSessionRefresh?: () => void,
  options: OryErrorHandlingOptions = {},
) => {
  const links = getInvestRuntimeLinks();
  const compatibilityError = readOryCompatibilityError(error);
  const responseJson = compatibilityError.data?.responseJson;
  const uiError = responseJson?.ui?.messages?.find((m: { type?: string }) => m.type === 'error');
  const isCredentialsError = uiError?.id === CREDENTIALS_ERROR_ID;

  if (isCredentialsError) {
    toast.error(comment || TOAST_OPTIONS.title, { description: 'Invalid email or password.' });
    return;
  }

  if (uiError?.text?.toLowerCase().includes('account with the same identifier')) {
    toast.error('Account Already Exists', {
      description: () => h('div', {
        innerHTML: `Sorry, your email already used, do you want to <a href="/signin">log in</a>?`,
      }),
      duration: 8000,
    });
    return;
  }

  if (!responseJson?.error?.id) {
    reportError(error, comment);
    return;
  }

  switch (responseJson?.error?.id) {
    case 'session_already_available':
      navigateWithQueryParams(options.postAuthReturnPath || links.profile());
      break;
    case 'session_aal2_required':
      if (options.postAuthReturnPath) {
        navigateWithQueryParams(links.authenticator, {
          redirect: options.postAuthReturnPath,
        });
      }
      else {
        navigateWithQueryParams(links.authenticator);
      }
      return;
    case 'session_refresh_required':
      try {
        const success = await getInvestRuntimeAdapters().dialogs?.showRefreshSession();
        if (success && onSessionRefresh) onSessionRefresh();
      } catch (refreshError) {
        if (typeof console?.error === 'function') console.error('Session refresh failed:', refreshError);
      }
      break;
    case BROWSER_LOCATION_CHANGE_REQUIRED: {
      if (!isRequestFromConfiguredOryService(compatibilityError)) {
        reportError(error, comment);
        return;
      }
      let redirect: URL | null = null;
      try {
        redirect = new URL(responseJson.redirect_browser_to ?? '');
      }
      catch {
        redirect = null;
      }
      if (redirect?.searchParams.get('aal') === 'aal2') {
        if (options.postAuthReturnPath) {
          navigateWithQueryParams(links.authenticator, {
            redirect: options.postAuthReturnPath,
          });
        }
        else {
          navigateWithQueryParams(links.authenticator);
        }
        return;
      }
      redirect = parseApprovedBrowserRedirect(responseJson.redirect_browser_to);
      if (!redirect) {
        reportError(error, comment);
        return;
      }
      window.location.assign(redirect.href);
      break;
    }
    case 'self_service_flow_expired':
      toast('Your interaction expired, please fill out the form again.', {
        ...TOAST_OPTIONS,
      });
      resetFlow();
      break;
    case 'self_service_flow_return_to_forbidden':
      toast('The return_to address is not allowed.', {
        ...TOAST_OPTIONS,
      });
      resetFlow();
      break;
    case 'security_csrf_violation':
      toast('A security violation was detected, please fill out the form again.', {
        ...TOAST_OPTIONS,
      });
      resetFlow();
      break;
    case 'security_identity_mismatch':
      resetFlow();
      break;
    case 'session_inactive':
      navigateWithQueryParams(links.signin);
      break;
    default:
      reportError(error, comment);
  }
};
