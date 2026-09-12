// @ts-nocheck
import { useInvestApplicationContext } from '@webdevelop-pro/invest-runtime/application-context';
import {
  computed, nextTick, onScopeDispose, ref, toRaw,
} from 'vue';
import { acceptHMRUpdate, defineStore, storeToRefs } from 'pinia';
import { navigateWithQueryParams } from '@webdevelop-pro/invest-runtime/navigation';
import { getAuthLinks } from '../links.ts';
import { useRepositoryAuth } from '../data/auth.repository.ts';
import { useFormValidation } from '@global-torque/ui-kit/form-validation';
import { JSONSchemaType } from 'ajv/dist/types/json-schema';
import {
  emailRule, errorMessageRule, passwordRule, firstNameRule, lastNameRule,
  composeInvestmentFormSchema, createInvestmentAjv, prepareInvestmentFormData,
} from '@webdevelop-pro/invest-core/form-validation';
import { useSessionStore } from '@webdevelop-pro/invest-runtime/session';
import { SELFSERVICE } from '@webdevelop-pro/domain-types/authConstants';
import { oryErrorHandling } from '@webdevelop-pro/invest-runtime/error/oryErrorHandling';
import { oryResponseHandling } from '@webdevelop-pro/invest-runtime/error/oryResponseHandling';
import { useSendAnalyticsEvent } from '@webdevelop-pro/invest-runtime/analytics/useSendAnalyticsEvent';
import {
  shouldAutoAuthenticateDemoAccount,
  useDemoAccountAuth,
} from '../composables/useDemoAccountAuth.ts';
import { notifyNativePushAuthSuccess } from '@webdevelop-pro/invest-runtime/native-push';
import type { SignupProfileType } from '@webdevelop-pro/domain-types/onboardingTypes';
import { parseSignupProfileType } from '@webdevelop-pro/invest-core/onboarding/intents';
import { getRequiredInvestRuntimeAdapter } from '@webdevelop-pro/invest-runtime/adapters';
import { useRepositoryInvitations } from '../invitations/invitations.repository.ts';
import type {
  UserInvitationAcceptance,
  UserInvitationPreview,
} from '../invitations/invitations.types.ts';
import { resetAllData, resetDataForIdentityChange } from '@webdevelop-pro/invest-runtime/reset';
import { useLogoutStore } from './useLogout.ts';
import { normalizeError, reportError } from '@webdevelop-pro/invest-runtime/error/errorReporting';
import {
  buildCanonicalInvitationPath,
  buildCanonicalInvitationUrl,
  parseInvitationCode,
  recoverInvitationCodeFromReturn,
  recoverRememberedInvitationReturn,
  rememberInvitationReturnForFlow,
} from '../navigation/invitationReturn.ts';

export type InvitationEntryUiState =
  | { status: 'direct' }
  | { status: 'checking' }
  | { status: 'anonymous' }
  | { status: 'match' }
  | { status: 'mismatch' }
  | { status: 'session-error'; message: string }
  | { status: 'unavailable' }
  | { status: 'accepting' }
  | { status: 'accept-error'; message: string; retryable: boolean }
  | { status: 'logging-out' }
  | { status: 'accepted-navigation-failed'; message: string };

type AcceptedInvitationCache = {
  accepted: UserInvitationAcceptance;
  generation: number;
  code: string;
  identityId: string;
  identityEmail: string;
};

type FormModelSignUp = {
  first_name: string;
  last_name: string;
  email: string;
  create_password: string;
  repeat_password: string;
  provider?: string;
}

type UINode = {
  attributes: {
    name: string;
    value: string | undefined;
  };
};

type FormFieldMapping = {
  [key: string]: (value: string | undefined) => void;
};

export const useSignupStore = defineStore('signup', () => {
  // Store actions outlive the component setup call that created the store.
  // Capture the installed context while Vue injection is available instead of
  // looking it up later from an async invitation continuation.
  const applicationContext = useInvestApplicationContext();
  const {
    signin: urlSignin,
    profileWalletOtp: urlProfileWalletOtp,
  } = getAuthLinks();
  const authRepository = useRepositoryAuth();
  const {
    getSchemaState, setSignupState, getSignupState, getAuthFlowState,
  } = storeToRefs(authRepository);

  const userSessionStore = useSessionStore();
  const { sendEvent } = useSendAnalyticsEvent();
  const demoAccountAuth = useDemoAccountAuth();
  const profiles = getRequiredInvestRuntimeAdapter('profiles');
  const invitationsRepository = useRepositoryInvitations();
  const {
    previewState: invitationPreviewState,
    acceptState: invitationAcceptState,
  } = storeToRefs(invitationsRepository);
  const signupStep = ref<'registration' | 'choose-profile' | 'resolving' | 'error'>('registration');
  const selectedProfileType = ref<SignupProfileType | ''>('');
  const continuationError = ref('');
  const invitationEntry = ref<InvitationEntryUiState>({ status: 'checking' });
  const invitationPreview = ref<UserInvitationPreview | null>(null);
  const acceptedInvitation = ref<AcceptedInvitationCache | null>(null);
  const previewedInvitationCode = ref('');
  let previewRequestId = 0;
  let invitationGeneration = 0;
  let acceptanceLocked = false;
  let logoutLocked = false;
  let previewAbortController: AbortController | null = null;
  const resolvedInvitationCode = ref('');
  const lastClassifiedInvitationCode = ref('');
  const resolvedFlowReturnTo = ref<string | null>(null);
  const verifiedSessionEmail = ref('');

  const currentOrigin = () => (typeof window === 'undefined' ? '' : window.location.origin);
  const rememberCurrentInvitationFlow = () => {
    rememberInvitationReturnForFlow({
      flowId: authRepository.flowId.value,
      invitationReturn: canonicalInvitationPath.value,
      origin: currentOrigin(),
    });
  };

  const resetSignupFlow = () => {
    const returnTo = canonicalInvitationUrl.value;
    void authRepository
      .getAuthFlow(
        SELFSERVICE.registration,
        returnTo ? { return_to: returnTo } : undefined,
      )
      .then((flow) => {
        oryResponseHandling(flow as any);
        rememberCurrentInvitationFlow();
      });
  };

  const trackSignupEvent = async (
    statusCode: number,
    body?: unknown,
    requestId = authRepository.flowId.value,
  ) => {
    const uiPath = typeof window !== 'undefined' ? window.location.pathname : '';
    await sendEvent({
      event_type: 'send',
      method: 'POST',
      httpRequestMethod: 'POST',
      request_id: requestId,
      request_path: uiPath,
      httpRequestUrl: SELFSERVICE.registration,
      status_code: statusCode,
      body,
    });
  };

  // Query parameters handling
  const queryVersion = ref(0);
  const queryParams = computed(() => {
    void queryVersion.value;
    if (import.meta.env.SSR) return new Map<string, string>();
    return new Map(Object.entries(Object.fromEntries(new URLSearchParams(window?.location?.search))));
  });

  const refreshQueryParams = () => {
    queryVersion.value += 1;
  };

  const getQueryParam = (key: string): string | undefined => queryParams.value.get(key);

  const title = computed(() => (getQueryParam('flow') ? 'Finish Registration' : 'Create Account'));

  const queryFlow = computed(() => getQueryParam('flow'));
  const invitationCode = computed(() => resolvedInvitationCode.value);
  const isEmailFixed = computed(() => invitationEntry.value.status === 'anonymous');
  const invitationState = computed(() => {
    if (invitationEntry.value.status === 'direct') return 'none';
    if (invitationEntry.value.status === 'checking') return 'loading';
    if (invitationEntry.value.status === 'unavailable') return 'unavailable';
    return 'ready';
  });

  const canonicalInvitationPath = computed(() => (
    buildCanonicalInvitationPath(invitationCode.value) ?? ''
  ));
  const canonicalInvitationUrl = computed(() => (
    typeof window === 'undefined'
      ? ''
      : buildCanonicalInvitationUrl(invitationCode.value, window.location.origin) ?? ''
  ));
  const signInHref = computed(() => {
    if (!canonicalInvitationPath.value) return urlSignin;
    const query = new URLSearchParams({ redirect: canonicalInvitationPath.value });
    return `${urlSignin}?${query.toString()}`;
  });
  const authHeaderState = computed(() => ({
    disabled: invitationEntry.value.status === 'checking',
    ...(canonicalInvitationPath.value ? {
      signInHref: signInHref.value,
      signUpHref: canonicalInvitationPath.value,
    } : {}),
    suppressAuthenticatedAccountControls: ['mismatch', 'logging-out']
      .includes(invitationEntry.value.status),
  }));

  // Form schema and validation
  const schemaFrontend = computed(() => ({
    $schema: 'http://json-schema.org/draft-07/schema#',
    definitions: {
      Auth: {
        properties: {
          first_name: firstNameRule,
          last_name: lastNameRule,
          email: emailRule,
          create_password: passwordRule,
          repeat_password: {
            const: {
              $data: '1/create_password',
            },
            ...passwordRule,
            errorMessage: {
              const: 'Passwords do not match',
            },
          },
        },
        type: 'object',
        required: ['first_name', 'last_name', 'email', 'create_password', 'repeat_password'],
        errorMessage: errorMessageRule,
      },
    },
    $ref: '#/definitions/Auth',
  } as unknown as JSONSchemaType<FormModelSignUp>));

  const schemaBackend = computed(() => {
    if (getSchemaState.value.data) {
      return structuredClone(toRaw(getSchemaState.value.data));
    }
    return null;
  });

  const fieldsPaths = ['first_name', 'last_name', 'email', 'create_password', 'repeat_password'];

  const {
    model, validation, isValid, onValidate,
    scrollToError, formErrors, isFieldRequired, getErrorText,
    getOptions,
  } = useFormValidation<FormModelSignUp>(
    schemaFrontend,
    schemaBackend,
    {} as FormModelSignUp,
    fieldsPaths,
    {
      createAjv: createInvestmentAjv,
      composeSchema: composeInvestmentFormSchema,
      prepareData: prepareInvestmentFormData,
    }
  );

  const isLoading = ref(false);
  const checkbox = ref(false);
  const isDisabledButton = computed(() => (
    !isValid.value
    || isLoading.value
    || !checkbox.value
    || (
      invitationEntry.value.status !== 'direct'
      && invitationEntry.value.status !== 'anonymous'
    )
  ));

  // Navigation
  const onLogin = () => {
    if (canonicalInvitationPath.value) {
      return navigateWithQueryParams(urlSignin, { redirect: canonicalInvitationPath.value });
    }
    const params = queryParams.value.size ? queryParams.value : undefined;
    return navigateWithQueryParams(urlSignin, params);
  };

  const goToDashboard = () => window.location.assign(dashboardBaseUrl());
  const returnHome = () => navigateWithQueryParams('/');

  const dashboardBaseUrl = (): string => {
    const configuredDashboard = String(
      applicationContext.appConfig.urls.dashboard ?? '',
    ).trim().replace(/\/+$/, '');
    const dashboardUrl = new URL(configuredDashboard);
    if (
      !['http:', 'https:'].includes(dashboardUrl.protocol)
      || dashboardUrl.username
      || dashboardUrl.password
      || dashboardUrl.search
      || dashboardUrl.hash
    ) {
      throw new Error('Investor dashboard onboarding is unavailable.');
    }
    return configuredDashboard;
  };

  const navigateToSignupWalletOtp = (
    profileId: number,
    next = `/profile/${profileId}/account`,
  ) => {
    const redirect = getQueryParam('redirect');
    return navigateWithQueryParams(
      urlProfileWalletOtp(profileId),
      {
        profileType: 'individual',
        next,
        ...(redirect ? { redirect } : {}),
      },
    );
  };

  // Form validation
  const validateForm = () => {
    onValidate();
    if (!isValid.value) {
      nextTick(() => scrollToError('VFormAuthSignup'));
      return false;
    }
    return true;
  };

  const buildPasswordSignupRequestBody = () => ({
    identifier: model.email,
    password: model.create_password,
    method: 'password' as const,
    traits: {
      email: model.email,
      first_name: model.first_name,
      last_name: model.last_name,
    },
    csrf_token: authRepository.csrfToken.value,
  });

  const getCurrentSiteDomain = () => (
    typeof window === 'undefined' ? '' : window.location.hostname
  );

  const buildSocialSignupRequestBody = (provider: string) => ({
    csrf_token: authRepository.csrfToken.value,
    provider,
    method: 'oidc' as const,
    transient_payload: {
      site_domain: getCurrentSiteDomain(),
    },
  });

  // Signup handlers
  const continueAcceptedInvestor = (
    accepted: UserInvitationAcceptance,
  ): void => {
    if (
      accepted.kind !== 'investor'
      || !accepted.acceptedProfileId
      || !accepted.selectedProfileType
    ) {
      throw new Error('Invitation acceptance did not return an exact profile.');
    }
    if (accepted.selectedProfileType === 'individual') {
      // The registration profile already exists: the invited investor
      // completes it on the KYC page, custom fund questions included.
      navigateToSignupWalletOtp(
        accepted.acceptedProfileId,
        `/profile/${accepted.acceptedProfileId}/kyc`,
      );
      return;
    }
    // Other types collect everything, custom questions included, on the
    // create-new-profile page; it computes its own continuation.
    const query = new URLSearchParams({
      onboarding: 'invitation',
      profileType: accepted.selectedProfileType,
      acceptedProfileId: String(accepted.acceptedProfileId),
    });
    window.location.assign(
      `${dashboardBaseUrl()}/profile/create-new-profile?${query}`,
    );
  };

  const navigateAcceptedInvitation = (accepted: UserInvitationAcceptance): void => {
    if (accepted.kind === 'team') {
      window.location.assign(dashboardBaseUrl());
      return;
    }
    continueAcceptedInvestor(accepted);
  };

  const invitationResponseMatchesPreview = (
    accepted: UserInvitationAcceptance,
    preview: UserInvitationPreview,
  ): boolean => (
    accepted.kind === preview.kind
    && accepted.selectedProfileType === preview.profileType
  );

  const usableSessionEmail = (value: unknown): string => (
    typeof value === 'string' ? value.trim() : ''
  );

  const currentSessionIdentity = () => ({
    id: userSessionStore.userSession?.identity?.id ?? '',
    email: usableSessionEmail(
      userSessionStore.userSession?.identity?.traits?.email,
    ).toLowerCase(),
  });

  const acceptCurrentInvitation = async (): Promise<void> => {
    if (acceptanceLocked) return;
    if (
      invitationEntry.value.status === 'accepted-navigation-failed'
      && acceptedInvitation.value
    ) {
      const cached = acceptedInvitation.value;
      const identity = currentSessionIdentity();
      if (
        cached.generation !== invitationGeneration
        || cached.code !== previewedInvitationCode.value
        || cached.identityId !== identity.id
        || cached.identityEmail !== identity.email
      ) {
        await loadInvitationPreview(resolvedFlowReturnTo.value);
        return;
      }
      try {
        navigateAcceptedInvitation(cached.accepted);
      }
      catch (error) {
        invitationEntry.value = {
          status: 'accepted-navigation-failed',
          message: 'Your invitation was accepted, but navigation could not be started.',
        };
        reportError(error, 'Invitation destination could not be opened', {
          silent: true,
          source: 'invitation-entry',
        });
      }
      return;
    }
    if (!['match', 'accept-error'].includes(invitationEntry.value.status)) return;
    if (
      invitationEntry.value.status === 'accept-error'
      && !invitationEntry.value.retryable
    ) return;
    const preview = invitationPreview.value;
    const code = previewedInvitationCode.value;
    const generation = invitationGeneration;
    const identity = currentSessionIdentity();
    if (!preview || !code || !identity.id || !identity.email) return;

    acceptanceLocked = true;
    invitationEntry.value = { status: 'accepting' };
    try {
      const selectedType = preview.kind === 'investor'
        ? parseSignupProfileType(preview.profileType ?? '') ?? undefined
        : undefined;
      const accepted = await invitationsRepository.accept(code, selectedType);
      if (!invitationResponseMatchesPreview(accepted, preview)) {
        const mismatch = new Error('The invitation response did not match the preview.');
        mismatch.name = 'InvitationAcceptanceResponseMismatch';
        throw mismatch;
      }
      acceptedInvitation.value = {
        accepted,
        generation,
        code,
        identityId: identity.id,
        identityEmail: identity.email,
      };

      const currentIdentity = currentSessionIdentity();
      if (
        generation !== invitationGeneration
        || code !== previewedInvitationCode.value
      ) {
        return;
      }
      if (
        currentIdentity.id !== identity.id
        || currentIdentity.email !== identity.email
      ) {
        await loadInvitationPreview(resolvedFlowReturnTo.value);
        return;
      }
      try {
        navigateAcceptedInvitation(accepted);
      }
      catch (error) {
        invitationEntry.value = {
          status: 'accepted-navigation-failed',
          message: 'Your invitation was accepted, but navigation could not be started.',
        };
        reportError(error, 'Invitation destination could not be opened', {
          silent: true,
          source: 'invitation-entry',
        });
      }
    }
    catch (error) {
      if (
        generation !== invitationGeneration
        || code !== previewedInvitationCode.value
      ) return;
      const currentIdentity = currentSessionIdentity();
      if (
        currentIdentity.id !== identity.id
        || currentIdentity.email !== identity.email
      ) {
        await loadInvitationPreview(resolvedFlowReturnTo.value);
        return;
      }
      const statusCode = normalizeError(error, 'Invitation could not be accepted').statusCode;
      if (statusCode === 401) {
        try {
          await resetAllData();
        }
        catch (resetError) {
          if (generation === invitationGeneration && code === previewedInvitationCode.value) {
            invitationEntry.value = {
              status: 'accept-error',
              message: 'Your account state could not be reset. Try again.',
              retryable: true,
            };
            reportError(resetError, 'Invitation session reset failed', {
              silent: true,
              source: 'invitation-entry',
            });
          }
          return;
        }
        if (generation !== invitationGeneration || code !== previewedInvitationCode.value) return;
        const returnPath = buildCanonicalInvitationPath(code);
        if (returnPath) navigateWithQueryParams(urlSignin, { redirect: returnPath });
        return;
      }
      if (statusCode === 403) {
        invitationEntry.value = { status: 'mismatch' };
        return;
      }
      if (statusCode === 404) {
        invitationEntry.value = { status: 'unavailable' };
        return;
      }
      const errorCode = error && typeof error === 'object' && 'code' in error
        ? String(error.code)
        : '';
      const errorName = error instanceof Error ? error.name : '';
      const retryable = errorName !== 'InvitationAcceptanceResponseMismatch'
        && (
          statusCode === 429
          || statusCode === undefined
          || statusCode === 0
          || (typeof statusCode === 'number' && statusCode >= 500)
          || ['SDK_NETWORK_FAILED', 'SDK_OFFLINE', 'SDK_TIMEOUT'].includes(errorCode)
        );
      const message = errorName === 'InvitationAcceptanceResponseMismatch'
        ? 'The acceptance result could not be verified. Return to Dashboard before trying again.'
        : statusCode === 400
          ? 'This invitation cannot be applied to the current account.'
          : statusCode === 409
            ? 'Complete the required account profile before accepting this invitation.'
            : statusCode === 429
              ? 'Too many attempts. Wait a moment, then try again.'
              : 'The invitation could not be accepted. Try again.';
      invitationEntry.value = { status: 'accept-error', message, retryable };
      reportError(error, 'Invitation could not be accepted', {
        silent: true,
        source: 'invitation-entry',
      });
    }
    finally {
      acceptanceLocked = false;
    }
  };

  const handleSignupSuccess = async () => {
    continuationError.value = '';
    if (invitationPreview.value) {
      invitationEntry.value = { status: 'match' };
      return;
    }
    // Direct signup only. An invitation always arrives with its type: the
    // preview formatter rejects an investor response whose profileType is
    // missing or unrecognized, so no investor preview reaches this branch. The
    // guard above stays as a cheap defence if that ever loosens.
    selectedProfileType.value = '';
    signupStep.value = 'choose-profile';
  };

  const continueWithProfileType = async () => {
    if (!selectedProfileType.value || signupStep.value !== 'choose-profile') return;
    signupStep.value = 'resolving';
    continuationError.value = '';

    try {
      if (selectedProfileType.value === 'individual') {
        await profiles.init({ force: true });
        const individual = profiles.getUserProfiles().find(profile => (
          profile.type === 'individual' && Number(profile.id) > 0
        ));
        if (!individual) {
          throw new Error('Your individual investment profile is still being prepared. Try again.');
        }
        navigateToSignupWalletOtp(Number(individual.id));
        return;
      }

      const query = new URLSearchParams({
        onboarding: 'signup',
        profileType: selectedProfileType.value,
        next: '/profile',
      });
      window.location.assign(`${dashboardBaseUrl()}/profile/create-new-profile?${query}`);
    }
    catch (caught) {
      continuationError.value = caught instanceof Error
        ? caught.message
        : 'Profile onboarding could not be started.';
      signupStep.value = 'error';
    }
  };

  // An invitation already fixes the outcome: a team invitation has no profile
  // to pick, and a previewed investor invitation always carries its type (the
  // formatter rejects one without). Such a signup must never see the chooser,
  // not even for the instant between account creation and the redirect.
  const isInvitationContinuation = computed(() => (
    invitationPreview.value?.kind === 'team' || Boolean(invitationPreview.value?.profileType)
  ));

  /**
   * The invited account exists and its redirect is already in flight. The
   * signup form stays on screen for this instant rather than swapping in a
   * progress panel nobody has time to read, but it must not look ready to
   * accept a second submission.
   */
  const isInvitationContinuationPending = computed(() => (
    isInvitationContinuation.value && signupStep.value === 'resolving'
  ));

  const retryProfileContinuation = () => {
    continuationError.value = '';
    // Every invitation resumes where it failed. Only direct signup falls back
    // to the chooser.
    if (isInvitationContinuation.value) {
      void handleSignupSuccess();
      return;
    }
    signupStep.value = 'choose-profile';
  };

  const signupPasswordHandler = async () => {
    if (!checkbox.value) return;
    if (!validateForm()) return;

    if (invitationEntry.value.status === 'anonymous') {
      try {
        const currentSession = await authRepository.getSession();
        if (currentSession?.active) {
          userSessionStore.updateSession(currentSession);
          const email = usableSessionEmail(currentSession.identity?.traits?.email);
          verifiedSessionEmail.value = email;
          invitationEntry.value = email
            && email.toLowerCase() === invitationPreview.value?.email.toLowerCase()
            ? { status: 'match' }
            : email
              ? { status: 'mismatch' }
              : { status: 'session-error', message: 'Your account email could not be verified.' };
          return;
        }
        await resetAllData();
      }
      catch (error) {
        invitationEntry.value = {
          status: 'session-error',
          message: 'Your signed-in account could not be verified. Try again.',
        };
        reportError(error, 'Invitation session could not be verified', {
          silent: true,
          source: 'invitation-entry',
        });
        return;
      }
    }

    let signupRequestBody: ReturnType<typeof buildPasswordSignupRequestBody> | undefined;
    isLoading.value = true;
    try {
      const returnTo = canonicalInvitationUrl.value;
      const flowData = await authRepository.getAuthFlow(
        SELFSERVICE.registration,
        returnTo ? { return_to: returnTo } : undefined,
      );
      oryResponseHandling(flowData);
      rememberCurrentInvitationFlow();
      if (getAuthFlowState.value.error) return;

      signupRequestBody = buildPasswordSignupRequestBody();
      await authRepository.setSignup(authRepository.flowId.value, signupRequestBody);

      if (setSignupState.value.error) {
        void trackSignupEvent(400, signupRequestBody);
        return;
      }
    } catch (error) {
      void trackSignupEvent(400, signupRequestBody ?? buildPasswordSignupRequestBody());
      await oryErrorHandling(
        error as any,
        'signup',
        resetSignupFlow,
        'Failed to signup',
        undefined,
        { postAuthReturnPath: canonicalInvitationPath.value || null },
      );
    } finally {
      isLoading.value = false;
    }

    const signupSession = setSignupState.value.data?.session;
    if (signupSession && signupRequestBody) {
      const completedSignupFlowId = authRepository.flowId.value;
      await resetDataForIdentityChange();
      userSessionStore.updateSession(signupSession);
      notifyNativePushAuthSuccess();
      await trackSignupEvent(200, signupRequestBody, completedSignupFlowId);
      await handleSignupSuccess();
    }
  };

  const signupSocialHandler = async (provider: string) => {
    let signupRequestBody: ReturnType<typeof buildSocialSignupRequestBody> | undefined;
    isLoading.value = true;
    try {
      const currentFlowId = getQueryParam('flow');
      if (!currentFlowId) {
        const returnTo = canonicalInvitationUrl.value;
        const flowData = await authRepository.getAuthFlow(
          SELFSERVICE.registration,
          returnTo ? { return_to: returnTo } : undefined,
        );
        oryResponseHandling(flowData);
        rememberCurrentInvitationFlow();
        if (getAuthFlowState.value.error) return;
      }

      signupRequestBody = buildSocialSignupRequestBody(provider);
      await authRepository.setSignup(
        currentFlowId || authRepository.flowId.value,
        signupRequestBody,
      );
    } catch (error) {
      void trackSignupEvent(400, signupRequestBody ?? buildSocialSignupRequestBody(provider));
      await oryErrorHandling(
        error as any,
        'signup',
        resetSignupFlow,
        'Failed to signup',
        undefined,
        { postAuthReturnPath: canonicalInvitationPath.value || null },
      );
    } finally {
      isLoading.value = false;
    }
  };

  const demoAccountHandler = async () => demoAccountAuth.authenticate();

  /**
   * Maps form fields from UI nodes to the form model
   * @param nodes - Array of UI nodes containing form field data
   */
  const mapFormFields = (nodes: UINode[]): void => {
    const fieldMappings: FormFieldMapping = {
      'traits.email': (value) => { model.email = value ?? ''; },
      'traits.first_name': (value) => { model.first_name = value ?? ''; },
      'traits.last_name': (value) => { model.last_name = value ?? ''; },
      provider: (value) => { model.provider = value ?? ''; },
    };

    nodes.forEach((item) => {
      const { name, value } = item.attributes;

      if (fieldMappings[name]) {
        fieldMappings[name](value);
      } else if (name === 'traits.name' && !model.first_name && !model.last_name) {
        const nameSplitted = value?.trim().split(/\s+/);
        if (nameSplitted && nameSplitted.length > 0) {
          model.first_name = nameSplitted[0];
          model.last_name = nameSplitted[nameSplitted.length - 1];
        }
      }
    });
  };

  const loadInvitationPreview = async (flowReturnTo?: string | null): Promise<void> => {
    refreshQueryParams();
    if (flowReturnTo !== undefined) resolvedFlowReturnTo.value = flowReturnTo;
    const requestId = ++previewRequestId;
    const generation = ++invitationGeneration;
    const currentUrl = typeof window === 'undefined' ? null : new URL(window.location.href);
    const hasTopLevelInvite = Boolean(currentUrl?.searchParams.has('invite'));
    const topLevelCode = currentUrl?.pathname === '/signup'
      ? parseInvitationCode(currentUrl)
      : null;
    const flowCode = typeof window === 'undefined'
      ? null
      : recoverInvitationCodeFromReturn(flowReturnTo, window.location.origin);
    const code = topLevelCode ?? flowCode ?? '';
    if (code !== lastClassifiedInvitationCode.value) {
      model.first_name = '';
      model.last_name = '';
      model.email = '';
      model.create_password = '';
      model.repeat_password = '';
      model.provider = '';
      checkbox.value = false;
      signupStep.value = 'registration';
      selectedProfileType.value = '';
      continuationError.value = '';
      lastClassifiedInvitationCode.value = code;
    }
    resolvedInvitationCode.value = code;
    previewAbortController?.abort();
    previewAbortController = null;
    acceptedInvitation.value = null;
    invitationPreview.value = null;
    previewedInvitationCode.value = '';
    verifiedSessionEmail.value = '';
    invitationsRepository.resetAll();

    if (!code) {
      invitationEntry.value = hasTopLevelInvite
        ? { status: 'unavailable' }
        : { status: 'direct' };
      return;
    }

    invitationEntry.value = { status: 'checking' };
    previewAbortController = new AbortController();
    const previewPromise = invitationsRepository.preview(
        code,
        previewAbortController.signal,
      );
    const sessionPromise = authRepository.getSession();
    let preview: UserInvitationPreview;
    try {
      preview = await previewPromise;
    }
    catch {
      void sessionPromise.catch(() => undefined);
      if (requestId !== previewRequestId || generation !== invitationGeneration) return;
      previewAbortController = null;
      invitationEntry.value = { status: 'unavailable' };
      return;
    }
    const sessionResult = await Promise.allSettled([sessionPromise]).then(([result]) => result);
    if (requestId !== previewRequestId || generation !== invitationGeneration) return;
    previewAbortController = null;
    model.email = preview.email;
    model.first_name = preview.firstName;
    model.last_name = preview.lastName;
    invitationPreview.value = preview;
    previewedInvitationCode.value = code;

    if (sessionResult.status === 'rejected') {
      invitationEntry.value = {
        status: 'session-error',
        message: 'Your signed-in account could not be verified. Try again.',
      };
      reportError(sessionResult.reason, 'Invitation session could not be verified', {
        silent: true,
        source: 'invitation-entry',
      });
      return;
    }

    const session = sessionResult.value;
    if (!session?.active) {
      try {
        await resetAllData();
      }
      catch (error) {
        if (generation === invitationGeneration) {
          invitationEntry.value = {
            status: 'session-error',
            message: 'Your signed-in account could not be reset. Try again.',
          };
          reportError(error, 'Invitation session reset failed', {
            silent: true,
            source: 'invitation-entry',
          });
        }
        return;
      }
      if (generation === invitationGeneration) {
        invitationEntry.value = { status: 'anonymous' };
      }
      return;
    }

    userSessionStore.updateSession(session);
    const sessionEmail = usableSessionEmail(session.identity?.traits?.email);
    if (!sessionEmail) {
      invitationEntry.value = {
        status: 'session-error',
        message: 'Your account email could not be verified.',
      };
      return;
    }
    verifiedSessionEmail.value = sessionEmail;
    invitationEntry.value = sessionEmail.toLowerCase() === preview.email.toLowerCase()
      ? { status: 'match' }
      : { status: 'mismatch' };
  };

  const retryInvitationVerification = (): Promise<void> => (
    loadInvitationPreview(resolvedFlowReturnTo.value)
  );

  const logoutForCurrentInvitation = async (): Promise<void> => {
    if (logoutLocked || invitationEntry.value.status !== 'mismatch') return;
    const generation = invitationGeneration;
    const invitationAtClick = canonicalInvitationPath.value;
    if (!invitationAtClick) return;
    logoutLocked = true;
    invitationEntry.value = { status: 'logging-out' };
    const outcome = await useLogoutStore().logoutHandler({ redirectTo: invitationAtClick });
    logoutLocked = false;
    if (
      outcome.status === 'failed'
      && generation === invitationGeneration
      && invitationAtClick === canonicalInvitationPath.value
    ) {
      invitationEntry.value = { status: 'mismatch' };
    }
  };

  /**
   * Initializes form data from query flow or an invitation preview.
   */
  const onMountedHandler = (async (): Promise<void> => {
    refreshQueryParams();
    let flowReturnTo: string | null = null;
    if (!queryFlow.value) {
      resolvedFlowReturnTo.value = null;
      if (
        !invitationCode.value
        && typeof window !== 'undefined'
        && shouldAutoAuthenticateDemoAccount(window.location.search)
      ) {
        await demoAccountHandler();
      }
    }
    else {
      flowReturnTo = recoverRememberedInvitationReturn({
        flowId: queryFlow.value,
        origin: currentOrigin(),
      });
      resolvedFlowReturnTo.value = flowReturnTo;
      const rememberedCode = recoverInvitationCodeFromReturn(flowReturnTo, currentOrigin());
      resolvedInvitationCode.value = rememberedCode ?? '';
      try {
        const data = await authRepository.getSignup(queryFlow.value);
        oryResponseHandling(data);

        flowReturnTo = (data as { return_to?: string } | undefined)?.return_to ?? flowReturnTo;
        resolvedFlowReturnTo.value = flowReturnTo;
        const recoveredCode = recoverInvitationCodeFromReturn(flowReturnTo, currentOrigin());
        resolvedInvitationCode.value = recoveredCode ?? '';

        if (getSignupState.value.data?.ui?.nodes) {
          mapFormFields(getSignupState.value.data.ui.nodes);
        }
      } catch (error) {
        await oryErrorHandling(
          error as any,
          'signup',
          resetSignupFlow,
          'Failed to get signup data',
          undefined,
          { postAuthReturnPath: canonicalInvitationPath.value || null },
        );
      }
    }

    await loadInvitationPreview(flowReturnTo);
  });

  const disposeInvitationEntry = () => {
    invitationGeneration += 1;
    previewRequestId += 1;
    previewAbortController?.abort();
    previewAbortController = null;
  };

  onScopeDispose(disposeInvitationEntry);

  return {
    queryParams,
    queryFlow,
    invitationCode,
    canonicalInvitationPath,
    canonicalInvitationUrl,
    signInHref,
    invitationEntry,
    verifiedSessionEmail,
    authHeaderState,
    invitationState,
    invitationPreview,
    invitationPreviewState,
    invitationAcceptState,
    isEmailFixed,
    title,
    isLoading,
    model,
    validation,
    schemaBackend,
    schemaFrontend,
    isDisabledButton,
    setSignupState,
    checkbox,
    onLogin,
    goToDashboard,
    returnHome,
    signupPasswordHandler,
    signupSocialHandler,
    demoAccountHandler,
    isDemoAccountAvailable: demoAccountAuth.isAvailable,
    isDemoAccountLoading: demoAccountAuth.isLoading,
    onMountedHandler,
    onValidate,
    isValid,
    mapFormFields,
    validateForm,
    // Form validation helpers
    formErrors,
    isFieldRequired,
    getErrorText,
    getOptions,
    scrollToError,
    signupStep,
    selectedProfileType,
    continuationError,
    isInvitationContinuation,
    isInvitationContinuationPending,
    continueWithProfileType,
    retryProfileContinuation,
    loadInvitationPreview,
    retryInvitationVerification,
    acceptCurrentInvitation,
    logoutForCurrentInvitation,
    disposeInvitationEntry,
  };
});

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useSignupStore, import.meta.hot));
}
