import assert from 'node:assert/strict';
import test from 'node:test';
import { canonicalJson, sha256Hex } from './redemptionDigest.ts';

test('Canonical JSON Grammar v1 sorts keys, preserves null, and hashes bytes', async () => {
  const document = { z: '9', a: null };
  assert.equal(canonicalJson(document), '{"a":null,"z":"9"}');
  assert.equal(
    await sha256Hex(document),
    '0266a1d96e1d1f21df51f546592b3267ba5ac572baa285b00e4fa5f935da3cad',
  );
});

test('Canonical JSON Grammar v1 rejects non-protocol values and cycles', () => {
  for (const value of [undefined, 1n, Symbol('unsupported'), () => null, NaN, Infinity, '\ud800']) {
    assert.throws(() => canonicalJson(value));
  }
  const cyclic = {};
  cyclic.self = cyclic;
  assert.throws(() => canonicalJson(cyclic), /cycles/u);
  assert.throws(() => canonicalJson({ '\ud800': 1 }));
});
