let plaidScriptLoaded = false;
let plaidScriptLoadingPromise: Promise<void> | null = null;

export function loadPlaidScriptOnce(): Promise<void> {
  if (plaidScriptLoaded) return Promise.resolve();
  if (plaidScriptLoadingPromise) return plaidScriptLoadingPromise;
  plaidScriptLoadingPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[src="https://cdn.plaid.com/link/v2/stable/link-initialize.js"]');
    if (existing) {
      plaidScriptLoaded = true;
      resolve();
      return;
    }
    const plaidScript = document.createElement('script');
    plaidScript.setAttribute('src', 'https://cdn.plaid.com/link/v2/stable/link-initialize.js');
    plaidScript.onload = () => { plaidScriptLoaded = true; resolve(); };
    plaidScript.onerror = () => reject(new Error('Failed to load Plaid script'));
    document.head.appendChild(plaidScript);
  });
  return plaidScriptLoadingPromise;
}

export type PlaidHandler = { open: () => void };
