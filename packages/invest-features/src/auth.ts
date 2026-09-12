export { default as VDialogLogOut } from './auth/components/VDialogLogOut.vue';
export { default as VDialogRefreshSession } from './auth/components/VDialogRefreshSession.vue';
export { default as VFormAuthVerification } from './auth/components/VFormAuthVerification.vue';
export { default as VFormAuthForgot } from './auth/components/VFormAuthForgot.vue';
export { default as VFormAuthSocial } from './auth/components/VFormAuthSocial.vue';
export type { AuthSocialIcons, AuthSocialProvider } from './auth/components/VFormAuthSocial.vue';
export { default as VFormAuthLogIn } from './auth/components/VFormAuthLogIn.vue';
export { default as VFormAuthAuthenticator } from './auth/components/VFormAuthAuthenticator.vue';
export { default as VFormAuthSignUp } from './auth/components/VFormAuthSignUp.vue';
export { useLoginStore } from './auth/store/useLogin.ts';
export { useSignupStore } from './auth/store/useSignup.ts';
export { useLogoutStore } from './auth/store/useLogout.ts';
export { useRepositoryAuth } from './auth/data/auth.repository.ts';
export {
  configureAuthNavigation,
  resetAuthNavigationForTests,
  type AuthNavigationPort,
} from './auth/navigation.ts';
