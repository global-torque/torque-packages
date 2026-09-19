import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  canonicalJson,
  canonicalJsonFromRaw,
  sha256Hex,
  sha256HexFromRaw,
} from './redemptionDigest.ts';

test('Canonical JSON Grammar v1 sorts keys, preserves null, and hashes bytes', async () => {
  const document = { z: '9', a: null };
  assert.equal(canonicalJson(document), '{"a":null,"z":"9"}');
  assert.equal(
    await sha256Hex(document),
    '0266a1d96e1d1f21df51f546592b3267ba5ac572baa285b00e4fa5f935da3cad',
  );
});

test('Canonical JSON Grammar v1 rejects non-protocol values and cycles', () => {
  for (const value of [undefined, 1n, Symbol('unsupported'), () => null, NaN, Infinity, 1.5, 2 ** 53]) {
    assert.throws(() => canonicalJson(value));
  }
  const cyclic = {};
  cyclic.self = cyclic;
  assert.throws(() => canonicalJson(cyclic), /cycles/u);
  assert.throws(() => canonicalJson([, 1]), /sparse/u);
  assert.throws(() => canonicalJson(Object.assign([], { extra: true })), /array property/u);
  assert.throws(() => canonicalJson({ get value() { return 1; } }), /accessor/u);
  assert.throws(() => canonicalJson({ [Symbol('unsupported')]: 1 }), /symbol/u);
  assert.throws(() => canonicalJson({ '\ud800': 1 }));
});

test('Canonical JSON Grammar v1 sorts object keys by UTF-8 bytes', () => {
  assert.equal(canonicalJson({ 'é': 1, e: 2, '😀': 3 }), '{"e":2,"é":1,"😀":3}');
});

test('Canonical JSON Grammar v1 validates raw tokens before parsing', async () => {
  const valid = '{"z":1,"a":[null,true,"ok"]}';
  assert.equal(canonicalJsonFromRaw(valid), '{"a":[null,true,"ok"],"z":1}');
  assert.equal(await sha256HexFromRaw(valid), await sha256Hex({ z: 1, a: [null, true, 'ok'] }));
  const fixture = JSON.parse(readFileSync(new URL('./__fixtures__/stablecoin_redemption_digest_fixtures.json', import.meta.url), 'utf8'));
  for (const { raw } of fixture.invalidRaw) {
    assert.throws(() => canonicalJsonFromRaw(raw), undefined, raw);
  }
  for (const raw of ['[1,]', '{"a":1} trailing']) assert.throws(() => canonicalJsonFromRaw(raw));
});
