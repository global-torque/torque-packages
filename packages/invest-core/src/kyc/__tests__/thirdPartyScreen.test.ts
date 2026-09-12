import { describe, expect, it } from 'vitest';
import { formatKycThirdPartyScreen } from '../thirdPartyScreen.ts';

describe('formatKycThirdPartyScreen', () => {
  it('returns the launching screen copy', () => {
    expect(formatKycThirdPartyScreen('launching')).toEqual({
      title: 'Opening identity verification',
      description: 'Please wait while we connect you to our verification partner.',
    });
  });

  it('uses the same fallback copy for terminal error states', () => {
    expect(formatKycThirdPartyScreen('invalidToken')).toEqual(formatKycThirdPartyScreen('error'));
    expect(formatKycThirdPartyScreen('incomplete')).toEqual(formatKycThirdPartyScreen('error'));
  });
});
