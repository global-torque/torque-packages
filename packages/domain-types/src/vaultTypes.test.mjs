import assert from 'node:assert/strict';
import test from 'node:test';
import { VaultProtocolStates } from './vaultTypes.ts';

test('VaultProtocolState includes the unconfirmed redemption baseline', () => {
  assert.equal(VaultProtocolStates.none, 'none');
  assert.equal(VaultProtocolStates.quarantined, 'quarantined');
});
