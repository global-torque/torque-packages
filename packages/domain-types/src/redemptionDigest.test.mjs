import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  CanonicalJsonError,
  canonicalJson,
  canonicalJsonFromRaw,
  sha256Hex,
  sha256HexFromRaw,
} from './redemptionDigest.ts';

function assertCanonicalError(action, code) {
  assert.throws(action, (error) => (
    error instanceof CanonicalJsonError && error.code === code
  ));
}

test('Canonical JSON Grammar v1 sorts keys, preserves null, and hashes bytes', async () => {
  const document = { z: '9', a: null };
  assert.equal(canonicalJson(document), '{"a":null,"z":"9"}');
  assert.equal(
    await sha256Hex(document),
    '0266a1d96e1d1f21df51f546592b3267ba5ac572baa285b00e4fa5f935da3cad',
  );
});

test('Canonical JSON Grammar v1 classifies programmatic validation failures', () => {
  for (const value of [undefined, 1n, Symbol('unsupported'), () => null]) {
    assertCanonicalError(() => canonicalJson(value), 'unsupported_value');
  }
  for (const value of [NaN, Infinity, 1.5]) {
    assertCanonicalError(() => canonicalJson(value), 'invalid_number');
  }
  assertCanonicalError(() => canonicalJson(2 ** 53), 'unsafe_integer');
  const cyclic = {};
  cyclic.self = cyclic;
  assertCanonicalError(() => canonicalJson(cyclic), 'cycle');
  assertCanonicalError(() => canonicalJson([, 1]), 'sparse_array');
  assertCanonicalError(() => canonicalJson(Object.assign([], { extra: true })), 'array_property');
  assertCanonicalError(() => canonicalJson({ get value() { return 1; } }), 'accessor_property');
  assertCanonicalError(() => canonicalJson({ [Symbol('unsupported')]: 1 }), 'symbol_property');
  assertCanonicalError(() => canonicalJson({ '\ud800': 1 }), 'invalid_surrogate');
});

test('Canonical JSON Grammar v1 sorts object keys by UTF-8 bytes', () => {
  assert.equal(canonicalJson({ 'é': 1, e: 2, '😀': 3 }), '{"e":2,"é":1,"😀":3}');
});

test('Canonical JSON Grammar v1 validates raw tokens before parsing', async () => {
  const valid = '{"z":1,"a":[null,true,"ok"]}';
  assert.equal(canonicalJsonFromRaw(valid), '{"a":[null,true,"ok"],"z":1}');
  assert.equal(await sha256HexFromRaw(valid), await sha256Hex({ z: 1, a: [null, true, 'ok'] }));
  const fixture = JSON.parse(readFileSync(new URL('./__fixtures__/stablecoin_redemption_digest_fixtures.json', import.meta.url), 'utf8'));
  const expectedCodes = {
    'duplicate-key': 'duplicate_key',
    'negative-zero': 'negative_zero',
    fraction: 'invalid_number',
    exponent: 'invalid_number',
    'unsafe-integer': 'unsafe_integer',
    'lone-surrogate': 'invalid_surrogate',
  };
  for (const { name, raw } of fixture.invalidRaw) {
    assertCanonicalError(() => canonicalJsonFromRaw(raw), expectedCodes[name]);
  }
  for (const raw of ['[1,]', '{"a":1} trailing']) {
    assertCanonicalError(() => canonicalJsonFromRaw(raw), 'invalid_raw_json');
  }
});
