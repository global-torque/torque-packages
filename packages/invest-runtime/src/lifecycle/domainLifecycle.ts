type ResetTarget = () => void;
type AsyncResetTarget = () => void | Promise<void>;
export type LogoutRequestOptions = {
  redirectTo?: string;
};
type LogoutRequestHandler = (options?: LogoutRequestOptions) => void | Promise<void>;

const profileResetTargets = new Map<string, ResetTarget>();
const fullResetTargets = new Map<string, AsyncResetTarget>();
const logoutRequestHandlers = new Map<string, LogoutRequestHandler>();

export const registerProfileResetTarget = (id: string, target: ResetTarget) => {
  profileResetTargets.set(id, target);
  return () => profileResetTargets.delete(id);
};

export const registerFullResetTarget = (id: string, target: AsyncResetTarget) => {
  fullResetTargets.set(id, target);
  return () => fullResetTargets.delete(id);
};

export const registerLogoutRequestHandler = (id: string, handler: LogoutRequestHandler) => {
  logoutRequestHandlers.set(id, handler);
  return () => logoutRequestHandlers.delete(id);
};

export const runProfileResetTargets = () => {
  for (const target of profileResetTargets.values()) {
    target();
  }
};

export const runFullResetTargets = async () => {
  for (const target of fullResetTargets.values()) {
    await target();
  }
};

export const requestLogout = async (options?: LogoutRequestOptions) => {
  for (const handler of logoutRequestHandlers.values()) {
    await handler(options);
  }
};

export const clearDomainLifecycleHandlersForTests = () => {
  profileResetTargets.clear();
  fullResetTargets.clear();
  logoutRequestHandlers.clear();
};
