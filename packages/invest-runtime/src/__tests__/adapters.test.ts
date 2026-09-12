import {
  afterEach,
  describe,
  expect,
  it,
} from 'vitest';
import {
  configureInvestRuntimeAdapters,
  getInvestRuntimeAdapters,
  getRequiredInvestRuntimeAdapter,
  resetInvestRuntimeAdaptersForTests,
} from '../adapters.ts';

describe('invest runtime adapters', () => {
  afterEach(() => {
    resetInvestRuntimeAdaptersForTests();
  });

  it('merges adapter registrations', () => {
    const getSession = async () => null;
    const resetAll = () => {};

    configureInvestRuntimeAdapters({
      auth: { getSession },
    });
    configureInvestRuntimeAdapters({
      repositories: {
        resetProfileRepositories: resetAll,
        resetFullRepositories: resetAll,
      },
    });

    expect(getInvestRuntimeAdapters().auth?.getSession).toBe(getSession);
    expect(getInvestRuntimeAdapters().repositories?.resetFullRepositories).toBe(resetAll);
  });

  it('throws for required missing adapters', () => {
    expect(() => getRequiredInvestRuntimeAdapter('auth')).toThrow(
      'Invest runtime adapter "auth" has not been configured.',
    );
  });
});

