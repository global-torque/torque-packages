/**
 * Canonical JSON Grammar v1 shared by redemption commands and scope hashes.
 *
 * This is an intentionally small protocol grammar. It is not RFC 8785/JCS:
 * callers must use decimal strings for protocol quantities and this encoder
 * rejects values which cannot be represented identically by every owner.
 */
export const canonicalJson = (value: unknown): string => {
  const active = new Set<object>();
  const compareKeys = (left: string, right: string): number => {
    const leftCodePoints = [...left];
    const rightCodePoints = [...right];
    const length = Math.min(leftCodePoints.length, rightCodePoints.length);
    for (let index = 0; index < length; index += 1) {
      const leftPoint = leftCodePoints[index]!.codePointAt(0)!;
      const rightPoint = rightCodePoints[index]!.codePointAt(0)!;
      if (leftPoint !== rightPoint) return leftPoint - rightPoint;
    }
    return leftCodePoints.length - rightCodePoints.length;
  };
  const assertUnicodeScalars = (text: string): void => {
    for (let index = 0; index < text.length; index += 1) {
      const codeUnit = text.charCodeAt(index);
      if (codeUnit >= 0xd800 && codeUnit <= 0xdfff) {
        const next = index + 1 < text.length ? text.charCodeAt(index + 1) : 0;
        if (codeUnit > 0xdbff || next < 0xdc00 || next > 0xdfff) {
          throw new TypeError('Canonical JSON does not accept lone UTF-16 surrogates.');
        }
        index += 1;
      }
    }
  };
  const encode = (item: unknown): string => {
    if (item === null) return 'null';
    if (typeof item === 'string') {
      assertUnicodeScalars(item);
      return JSON.stringify(item);
    }
    if (typeof item === 'boolean') return JSON.stringify(item);
    if (typeof item === 'number') {
      if (!Number.isFinite(item)) throw new TypeError('Canonical JSON does not accept non-finite numbers.');
      return Object.is(item, -0) ? '0' : JSON.stringify(item);
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
      return `{${Object.keys(object).sort(compareKeys).map((key) => {
        assertUnicodeScalars(key);
        return `${JSON.stringify(key)}:${encode(object[key])}`;
      }).join(',')}}`;
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
