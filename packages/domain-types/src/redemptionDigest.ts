/**
 * Canonical JSON Grammar v1 shared by redemption commands and scope hashes.
 *
 * This is an intentionally small application protocol. It is not RFC 8785/JCS:
 * callers must use decimal strings for protocol quantities and this encoder
 * rejects values which cannot be represented identically by every owner.
 */

const MAX_SAFE_INTEGER = Number.MAX_SAFE_INTEGER;
const JSON_WHITESPACE = new Set([' ', '\t', '\n', '\r']);

/** Stable classifications emitted by Canonical JSON Grammar v1 validation. */
export type CanonicalJsonErrorCode =
  | 'unsupported_value'
  | 'invalid_number'
  | 'unsafe_integer'
  | 'negative_zero'
  | 'invalid_surrogate'
  | 'cycle'
  | 'sparse_array'
  | 'accessor_property'
  | 'symbol_property'
  | 'array_property'
  | 'non_plain_object'
  | 'duplicate_key'
  | 'invalid_raw_json';

/**
 * Typed validation failure for Canonical JSON Grammar v1.
 *
 * The `code` is the stable cross-runtime contract. Messages are diagnostic
 * only and must not be used for programmatic classification.
 */
export class CanonicalJsonError extends TypeError {
  public readonly code: CanonicalJsonErrorCode;

  public constructor(code: CanonicalJsonErrorCode, message: string) {
    super(message);
    this.name = 'CanonicalJsonError';
    this.code = code;
  }
}

function fail(code: CanonicalJsonErrorCode, message: string): never {
  throw new CanonicalJsonError(code, message);
}

function assertUnicodeScalars(text: string): void {
  for (let index = 0; index < text.length; index += 1) {
    const codeUnit = text.charCodeAt(index);
    if (codeUnit < 0xd800 || codeUnit > 0xdfff) continue;
    const next = index + 1 < text.length ? text.charCodeAt(index + 1) : 0;
    if (codeUnit > 0xdbff || next < 0xdc00 || next > 0xdfff) {
      fail('invalid_surrogate', 'Canonical JSON does not accept lone UTF-16 surrogates.');
    }
    index += 1;
  }
}

function utf8Compare(left: string, right: string): number {
  const leftBytes = new TextEncoder().encode(left);
  const rightBytes = new TextEncoder().encode(right);
  const length = Math.min(leftBytes.length, rightBytes.length);
  for (let index = 0; index < length; index += 1) {
    if (leftBytes[index] !== rightBytes[index]) return leftBytes[index]! - rightBytes[index]!;
  }
  return leftBytes.length - rightBytes.length;
}

function assertPlainObjectProperties(value: object): void {
  if (Object.getOwnPropertySymbols(value).length > 0) {
    fail('symbol_property', 'Canonical JSON does not accept symbol properties.');
  }
  for (const [key, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(value))) {
    if ('get' in descriptor || 'set' in descriptor) {
      fail('accessor_property', `Canonical JSON does not accept accessor properties: ${key}.`);
    }
  }
}

function assertDenseArray(value: unknown[]): void {
  if (Object.getOwnPropertySymbols(value).length > 0) {
    fail('symbol_property', 'Canonical JSON does not accept symbol properties.');
  }
  for (let index = 0; index < value.length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (!descriptor) fail('sparse_array', 'Canonical JSON does not accept sparse arrays.');
    if ('get' in descriptor || 'set' in descriptor) {
      fail('accessor_property', 'Canonical JSON does not accept accessor properties.');
    }
  }
  for (const key of Object.getOwnPropertyNames(value)) {
    if (key === 'length' || /^(?:0|[1-9]\d*)$/u.test(key) && Number(key) < value.length) continue;
    fail('array_property', `Canonical JSON does not accept array property: ${key}.`);
  }
}

function encodeProgrammatic(value: unknown, active: Set<object>): string {
  if (value === null) return 'null';
  if (typeof value === 'string') {
    assertUnicodeScalars(value);
    return JSON.stringify(value);
  }
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) fail('invalid_number', 'Canonical JSON does not accept non-finite numbers.');
    if (!Number.isInteger(value)) fail('invalid_number', 'Canonical JSON accepts integer numbers only.');
    if (!Number.isSafeInteger(value)) fail('unsafe_integer', 'Canonical JSON accepts safe integers only.');
    // A programmatic negative zero has no distinct value in the grammar and
    // is normalized to the sole integer token. Raw JSON uses a stricter rule.
    return Object.is(value, -0) ? '0' : String(value);
  }
  if (typeof value !== 'object') {
    fail('unsupported_value', `Canonical JSON does not accept ${typeof value}.`);
  }
  if (active.has(value)) fail('cycle', 'Canonical JSON does not accept cycles.');
  active.add(value);
  try {
    if (Array.isArray(value)) {
      assertDenseArray(value);
      return `[${value.map(item => encodeProgrammatic(item, active)).join(',')}]`;
    }
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      fail('non_plain_object', 'Canonical JSON accepts only plain objects.');
    }
    assertPlainObjectProperties(value);
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object).sort(utf8Compare).map((key) => {
      assertUnicodeScalars(key);
      return `${JSON.stringify(key)}:${encodeProgrammatic(object[key], active)}`;
    }).join(',')}}`;
  } finally {
    active.delete(value);
  }
}

/** Encode a programmatic value under Canonical JSON Grammar v1. */
export const canonicalJson = (value: unknown): string => encodeProgrammatic(value, new Set());

class RawJsonParser {
  private index = 0;
  private readonly input: string;

  public constructor(input: string) {
    this.input = input;
  }

  public parse(): unknown {
    assertUnicodeScalars(this.input);
    const value = this.parseValue();
    this.skipWhitespace();
    if (this.index !== this.input.length) fail('invalid_raw_json', 'Canonical JSON raw input has trailing data.');
    return value;
  }

  private skipWhitespace(): void {
    while (this.index < this.input.length && JSON_WHITESPACE.has(this.input[this.index]!)) this.index += 1;
  }

  private parseValue(): unknown {
    this.skipWhitespace();
    const token = this.input[this.index];
    if (token === '{') return this.parseObject();
    if (token === '[') return this.parseArray();
    if (token === '"') return this.parseString();
    if (token === 'n' && this.input.startsWith('null', this.index)) {
      this.index += 4;
      return null;
    }
    if (token === 't' && this.input.startsWith('true', this.index)) {
      this.index += 4;
      return true;
    }
    if (token === 'f' && this.input.startsWith('false', this.index)) {
      this.index += 5;
      return false;
    }
    if (token === '-' || (token !== undefined && token >= '0' && token <= '9')) return this.parseInteger();
    fail('invalid_raw_json', `Canonical JSON raw input has an invalid token at character ${this.index}.`);
  }

  private parseString(): string {
    const start = this.index;
    this.index += 1;
    let escaped = false;
    while (this.index < this.input.length) {
      const codeUnit = this.input.charCodeAt(this.index);
      if (codeUnit < 0x20) fail('invalid_raw_json', 'Canonical JSON raw strings contain an unescaped control character.');
      if (escaped) {
        if ('"\\/bfnrt'.includes(this.input[this.index] ?? '')) {
          escaped = false;
          this.index += 1;
          continue;
        }
        if (this.input[this.index] === 'u') {
          if (!/^[0-9a-f]{4}$/iu.test(this.input.slice(this.index + 1, this.index + 5))) {
            fail('invalid_raw_json', 'Canonical JSON raw strings contain an invalid Unicode escape.');
          }
          this.index += 5;
          escaped = false;
          continue;
        }
        fail('invalid_raw_json', 'Canonical JSON raw strings contain an invalid escape.');
      }
      if (codeUnit === 0x5c) {
        escaped = true;
        this.index += 1;
        continue;
      }
      if (codeUnit === 0x22) {
        this.index += 1;
        const token = this.input.slice(start, this.index);
        const value = JSON.parse(token) as string;
        assertUnicodeScalars(value);
        return value;
      }
      this.index += 1;
    }
    fail('invalid_raw_json', 'Canonical JSON raw string is unterminated.');
  }

  private parseInteger(): number {
    const start = this.index;
    if (this.input[this.index] === '-') this.index += 1;
    if (this.input[this.index] === '0') {
      this.index += 1;
      if (this.input[this.index] >= '0' && this.input[this.index] <= '9') {
        fail('invalid_raw_json', 'Canonical JSON raw integers may not contain leading zeroes.');
      }
    } else {
      if (!/[1-9]/u.test(this.input[this.index] ?? '')) {
        fail('invalid_raw_json', 'Canonical JSON raw input has an invalid integer.');
      }
      while (this.input[this.index] !== undefined && /\d/u.test(this.input[this.index]!)) this.index += 1;
    }
    const token = this.input.slice(start, this.index);
    if (token === '-0') fail('negative_zero', 'Canonical JSON raw input does not accept negative zero.');
    if (this.input[this.index] === '.' || this.input[this.index] === 'e' || this.input[this.index] === 'E') {
      fail('invalid_number', 'Canonical JSON raw input accepts integer numbers only.');
    }
    const integer = BigInt(token);
    if (integer < BigInt(-MAX_SAFE_INTEGER) || integer > BigInt(MAX_SAFE_INTEGER)) {
      fail('unsafe_integer', 'Canonical JSON raw integer is outside the safe integer range.');
    }
    return Number(integer);
  }

  private parseArray(): unknown[] {
    this.index += 1;
    const result: unknown[] = [];
    this.skipWhitespace();
    if (this.input[this.index] === ']') {
      this.index += 1;
      return result;
    }
    while (true) {
      result.push(this.parseValue());
      this.skipWhitespace();
      if (this.input[this.index] === ']') {
        this.index += 1;
        return result;
      }
      if (this.input[this.index] !== ',') fail('invalid_raw_json', 'Canonical JSON raw array is malformed.');
      this.index += 1;
    }
  }

  private parseObject(): Record<string, unknown> {
    this.index += 1;
    const result: Record<string, unknown> = Object.create(null);
    const keys = new Set<string>();
    this.skipWhitespace();
    if (this.input[this.index] === '}') {
      this.index += 1;
      return result;
    }
    while (true) {
      this.skipWhitespace();
      if (this.input[this.index] !== '"') fail('invalid_raw_json', 'Canonical JSON raw object key is missing.');
      const key = this.parseString();
      if (keys.has(key)) fail('duplicate_key', `Canonical JSON raw object contains duplicate key: ${key}.`);
      keys.add(key);
      this.skipWhitespace();
      if (this.input[this.index] !== ':') fail('invalid_raw_json', 'Canonical JSON raw object is missing a colon.');
      this.index += 1;
      result[key] = this.parseValue();
      this.skipWhitespace();
      if (this.input[this.index] === '}') {
        this.index += 1;
        return result;
      }
      if (this.input[this.index] !== ',') fail('invalid_raw_json', 'Canonical JSON raw object is malformed.');
      this.index += 1;
    }
  }
}

/**
 * Parse and canonicalize raw JSON without allowing parser normalization to
 * hide duplicate keys or non-canonical numeric tokens.
 */
export const canonicalJsonFromRaw = (raw: string): string => {
  if (typeof raw !== 'string') fail('invalid_raw_json', 'Canonical JSON raw input must be a string.');
  return canonicalJson(new RawJsonParser(raw).parse());
};

export const sha256Hex = async (value: unknown): Promise<string> => {
  const bytes = new TextEncoder().encode(canonicalJson(value));
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map(part => part.toString(16).padStart(2, '0')).join('');
};

export const sha256HexFromRaw = async (raw: string): Promise<string> => {
  const bytes = new TextEncoder().encode(canonicalJsonFromRaw(raw));
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map(part => part.toString(16).padStart(2, '0')).join('');
};
