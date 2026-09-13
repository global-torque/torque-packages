import { useInvestApplicationContext } from '@global-torque/invest-runtime/application-context';

type SameSiteOption = 'none' | 'lax' | 'strict';

// Vite injects `import.meta.env` in browser builds, while SSR and direct Node
// imports may evaluate this module without that object. Keep production cookie
// semantics without making module evaluation depend on Vite's transform.
const mode = (import.meta as ImportMeta & { env?: { MODE?: string } }).env?.MODE;
const isProd = mode === 'production' || mode === 'prod';

export const cookiesOptions = (expireDate?: Date) => {
  const sameSite: SameSiteOption = isProd ? 'none' : 'lax';
  const domain = useInvestApplicationContext().appConfig.cookieDomain || undefined;

  return {
    ...(domain ? { domain } : {}),
    path: '/',
    ...(expireDate ? { expires: expireDate } : {}),
    sameSite,
    // Always Secure: dev/stage/prod all run HTTPS (mkcert locally).
    // `HttpOnly` cannot be set from JS by spec — only a server's Set-Cookie
    // header can mark a cookie HttpOnly. Cookies set client-side here will
    // remain JS-readable; if HttpOnly is required, the backend must issue
    // these cookies in its responses.
    secure: true,
  };
};
