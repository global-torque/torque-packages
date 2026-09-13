import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { useHeaderUser } from '../useHeaderUser.ts';

type UserSessionTraits = {
  email?: string;
  name?: {
    first?: string;
    last?: string;
  };
};

type UserState = {
  data?: {
    fullName?: string | null;
    image_link_id?: number | null;
  };
};

const state = vi.hoisted(() => ({
  filerUrl: 'https://files.example.test',
  userSessionTraits: { value: undefined as UserSessionTraits | undefined },
  getUserState: { value: {} as UserState },
  storeToRefs: vi.fn((store: Record<string, unknown>) => store),
  useSessionStore: vi.fn(),
  useRepositoryProfiles: vi.fn(),
  notificationFieldsState: { value: { data: undefined } },
}));

vi.mock('@global-torque/invest-runtime/application-context', () => ({
  useInvestApplicationContext: () => ({
    appConfig: {
      urls: {
        api: {
          filer: state.filerUrl,
        },
      },
    },
  }),
}));

vi.mock('pinia', () => ({
  storeToRefs: state.storeToRefs,
}));

vi.mock('@global-torque/invest-runtime/session', () => ({
  useSessionStore: state.useSessionStore,
}));

vi.mock('@global-torque/invest-runtime/adapters', () => ({
  getRequiredInvestRuntimeAdapter: () => ({
    getStore: state.useRepositoryProfiles,
  }),
}));

vi.mock('@global-torque/invest-runtime/filer', () => ({
  useFilerModel: () => ({
    notificationFieldsState: state.notificationFieldsState,
  }),
}));

describe('useHeaderUser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.filerUrl = 'https://files.example.test';
    state.userSessionTraits.value = {
      email: 'ada@example.test',
      name: {
        first: 'Ada',
        last: 'Lovelace',
      },
    };
    state.getUserState.value = {
      data: {
        fullName: 'Ada Profile',
        image_link_id: 55,
      },
    };
    state.notificationFieldsState.value = { data: undefined };
    state.storeToRefs.mockImplementation((store: Record<string, unknown>) => store);
    state.useSessionStore.mockReturnValue({
      userSessionTraits: state.userSessionTraits,
    });
    state.useRepositoryProfiles.mockReturnValue({
      getUserState: state.getUserState,
    });
  });

  it('builds avatarSrc from investment config for a positive image id', () => {
    const headerUser = useHeaderUser();

    expect(headerUser.avatarSrc.value).toBe(
      'https://files.example.test/auth/files/55?size=small&v=0',
    );
  });

  it.each([
    ['missing', undefined],
    ['zero', 0],
    ['negative', -1],
  ])('returns undefined avatarSrc for a %s image id', (_label, imageId) => {
    state.getUserState.value = {
      data: imageId === undefined
        ? {}
        : {
            image_link_id: imageId,
          },
    };

    const headerUser = useHeaderUser();

    expect(headerUser.avatarSrc.value).toBeUndefined();
  });

  it('keeps display-name precedence from profile full name to session name to email', () => {
    state.getUserState.value = {
      data: {
        fullName: '  Ada Profile  ',
        image_link_id: 55,
      },
    };
    expect(useHeaderUser().userDisplayName.value).toBe('Ada Profile');

    state.getUserState.value = {
      data: {
        image_link_id: 55,
      },
    };
    expect(useHeaderUser().userDisplayName.value).toBe('Ada Lovelace');

    state.userSessionTraits.value = {
      email: 'ada@example.test',
      name: {
        first: ' ',
        last: '',
      },
    };
    expect(useHeaderUser().userDisplayName.value).toBe('ada@example.test');
  });
});
