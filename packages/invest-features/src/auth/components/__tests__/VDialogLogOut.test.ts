/* @vitest-environment jsdom */

import { mount } from '@vue/test-utils';
import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { reactive, toRefs } from 'vue';
import bundledLogoutImage from '../../assets/logout-modal.svg?url';
import VDialogLogOut from '../VDialogLogOut.vue';

const logoutStore = reactive({
  isLoading: false,
  logoutHandler: vi.fn(),
});

const appConfig = reactive({ isStaticSite: false });

vi.mock('@webdevelop-pro/invest-runtime/application-context', () => ({
  useInvestApplicationContext: () => ({ appConfig }),
}));

vi.mock('pinia', async () => {
  const actual = await vi.importActual<typeof import('pinia')>('pinia');

  return {
    ...actual,
    storeToRefs: (store: Record<string, unknown>) => toRefs(store),
  };
});

vi.mock('../../store/useLogout.ts', () => ({
  useLogoutStore: () => logoutStore,
}));

vi.mock('@global-torque/ui-kit/query-dialog', () => ({
  VQueryDialog: {
    name: 'VQueryDialog',
    props: ['open', 'queryKey', 'queryValue'],
    emits: ['update:open'],
    template: '<div data-testid="dialog"><slot /></div>',
  },
}));
vi.mock('@global-torque/ui-primitives/dialog', () => ({
  DialogContent: {
    name: 'DialogContent',
    props: ['ariaDescribedby'],
    template: '<section data-testid="dialog-content"><slot /></section>',
  },
  DialogFooter: {
    name: 'DialogFooter',
    template: '<footer data-testid="dialog-footer"><slot /></footer>',
  },
  DialogHeader: {
    name: 'DialogHeader',
    template: '<header data-testid="dialog-header"><slot /></header>',
  },
  DialogTitle: {
    name: 'DialogTitle',
    template: '<h2 data-testid="dialog-title"><slot /></h2>',
  },
}));

const mountComponent = () => mount(VDialogLogOut, {
  props: {
    modelValue: true,
  },
});

describe('VDialogLogOut', () => {
  afterEach(() => {
    appConfig.isStaticSite = false;
    logoutStore.isLoading = false;
    logoutStore.logoutHandler.mockReset();
  });

  it.each([
    ['0', { IS_STATIC_SITE: '0' }],
    ['missing', {}],
  ] as const)('uses the bundled logout image when IS_STATIC_SITE is %s', (_label, config) => {
    appConfig.isStaticSite = 'IS_STATIC_SITE' in config && config.IS_STATIC_SITE === '1';

    const wrapper = mountComponent();

    expect(wrapper.get('[data-testid="logout-image"]').attributes('src')).toBe(bundledLogoutImage);
  });

  it('uses the static-site logout image when IS_STATIC_SITE is 1', () => {
    appConfig.isStaticSite = true;

    const wrapper = mountComponent();

    expect(wrapper.get('[data-testid="logout-image"]').attributes('src')).toBe('/images/logout-modal.svg');
  });
});
