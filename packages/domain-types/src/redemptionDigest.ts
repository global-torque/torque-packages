/** Canonical JSON subset shared by redemption command and scope hashes. */
export const canonicalJson = (value: unknown): string => {
  const active = new Set<object>();
  const encode = (item: unknown): string => {
    if (item === null) return 'null';
    if (typeof item === 'string' || typeof item === 'boolean') return JSON.stringify(item);
    if (typeof item === 'number') {
      if (!Number.isFinite(item)) throw new TypeError('Canonical JSON does not accept non-finite numbers.');
      return JSON.stringify(item);
    }
    if (typeof item !== 'object') {
      throw new TypeError(`Canonical JSON does not accept ${typeof item}.`);
    }
    if (active.has(item)) throw new TypeError('Canonical JSON does not accept cycles.');
    active.add(item);
    try {
      if (Array.isArray(item)) return `[${item.map(encode).join(',')}]`;
      const prototype = Object.getPrototypeOf(item);
      if (prototype !== Object.prototype && prototype !== null) {
        throw new TypeError('Canonical JSON accepts only plain objects.');
      }
      const object = item as Record<string, unknown>;
      return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${encode(object[key])}`).join(',')}}`;
    } finally {
      active.delete(item);
    }
  };
  return encode(value);
};

export const sha256Hex = async (value: unknown): Promise<string> => {
  const bytes = new TextEncoder().encode(canonicalJson(value));
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((part) => part.toString(16).padStart(2, '0')).join('');
};
