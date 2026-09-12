export interface AuthNavigationPort {
  afterLogout: () => void | Promise<void>;
}

let authNavigation: AuthNavigationPort | undefined;

export const configureAuthNavigation = (navigation: AuthNavigationPort) => {
  authNavigation = navigation;
};

export const getAuthNavigation = (): AuthNavigationPort => {
  if (!authNavigation) {
    throw new Error('Auth navigation must be configured by the host application.');
  }

  return authNavigation;
};

export const resetAuthNavigationForTests = () => {
  authNavigation = undefined;
};
