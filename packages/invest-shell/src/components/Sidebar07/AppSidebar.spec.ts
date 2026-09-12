import { mount, config, enableAutoUnmount, flushPromises } from '@vue/test-utils';
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { defineComponent, markRaw, nextTick } from 'vue';
import { createMemoryHistory, createRouter } from 'vue-router';
import { AvatarImage } from '@global-torque/ui-primitives/avatar';
import AppSidebar from './components/AppSidebar.vue';
import VHeaderAuthorized from '../VHeaderBar/VHeaderAuthorized.vue';
import VHeaderGuest from '../VHeaderBar/VHeaderGuest.vue';

enableAutoUnmount(afterEach);

vi.stubGlobal('matchMedia', (query: string) => {
  const callbacks = new Map<EventListener, EventListener>();
  const matches = () => query === '(width < 768px)' && window.innerWidth < 768;
  return {
    media: query,
    get matches() { return matches(); },
    addEventListener(_type: string, listener: EventListener) {
      const notify = () => listener(Object.assign(new Event('change'), { matches: matches() }));
      callbacks.set(listener, notify);
      window.addEventListener('resize', notify);
    },
    removeEventListener(_type: string, listener: EventListener) {
      const notify = callbacks.get(listener);
      if (notify) window.removeEventListener('resize', notify);
      callbacks.delete(listener);
    },
  } as MediaQueryList;
});

describe('Sidebar07/AppSidebar', () => {
  beforeEach(() => {
    config.global.renderStubDefaultSlot = true;
    config.global.stubs = { teleport: true };
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      writable: true,
      value: 1280,
    });

    window.dispatchEvent(new Event('resize'));
  });

  afterEach(() => {
    config.global.renderStubDefaultSlot = false;
    config.global.stubs = {};
    document.cookie = 'sidebar_state=; path=/; max-age=0';
  });

  it('initially focuses the mobile dialog while retaining its open state and profile layout context', async () => {
    window.innerWidth = 390;
    const wrapper = mount(AppSidebar, {
      attachTo: document.body,
      props: { user: { name: 'Investor' }, mainNav: [{ title: 'Summary', href: '#summary' }] },
    });
    await wrapper.get('[data-sidebar-trigger]').trigger('click');
    await flushPromises();
    const panel = wrapper.get('[data-mobile="true"]');
    await vi.waitFor(() => expect(document.activeElement).toBe(panel.element));
    expect(panel.attributes('data-state')).toBe('open');
    expect(panel.attributes('tabindex')).toBe('-1');
    expect(panel.classes()).toContain('is--desktop-collapsed');
    expect(panel.find('a[href="#summary"]').exists()).toBe(true);
  });

  it.each([false, true])('retains the mobile trigger expansion indicator only when focus-visible=%s', async (focused) => {
    window.innerWidth = 390;
    const wrapper = mount(AppSidebar, {
      attachTo: document.body,
      props: { user: { name: 'Investor' } },
    });
    const trigger = wrapper.get('.v-sidebar-trigger--custom');
    // jsdom does not model browser keyboard modality for :focus-visible.
    const matches = trigger.element.matches.bind(trigger.element);
    vi.spyOn(trigger.element, 'matches').mockImplementation(selector => (
      selector === ':focus-visible' ? focused : matches(selector)
    ));
    await trigger.trigger('click');
    await flushPromises();
    const panel = wrapper.get('[data-mobile="true"]');
    await vi.waitFor(() => expect(document.activeElement).toBe(panel.element));
    expect(trigger.classes().includes('is--open-focus')).toBe(focused);
    await panel.trigger('keydown', { key: 'Escape' });
    await flushPromises();
    expect(trigger.classes()).not.toContain('is--open-focus');
    expect(wrapper.find('[data-mobile="true"]').exists()).toBe(false);
    await vi.waitFor(() => expect(document.activeElement).toBe(trigger.element));
  });

  it('keeps the investor host collapsed without cookies or keyboard shortcuts and exposes a keyboard rail', async () => {
    document.cookie = 'sidebar_state=true; path=/';
    const wrapper = mount(AppSidebar, {
      attachTo: document.body,
      props: { user: { name: 'Investor' }, mainNav: [{ title: 'Summary', href: '#summary' }] },
    });
    const rail = wrapper.get('[data-slot="sidebar-rail"]');
    expect(rail.element.tabIndex).toBe(0);
    expect(rail.element.closest('[data-sidebar="sidebar"]')).not.toBeNull();
    expect(wrapper.get('[data-slot="sidebar-wrapper"]').attributes('data-state')).toBe('collapsed');
    const shortcut = new KeyboardEvent('keydown', { key: 'b', metaKey: true, cancelable: true });
    window.dispatchEvent(shortcut);
    await nextTick();
    expect(shortcut.defaultPrevented).toBe(false);
    expect(wrapper.get('[data-slot="sidebar-wrapper"]').attributes('data-state')).toBe('collapsed');
    await rail.trigger('click');
    expect(wrapper.get('[data-slot="sidebar-wrapper"]').attributes('data-state')).toBe('expanded');
    expect(document.cookie).toContain('sidebar_state=true');
    await rail.trigger('click');
    expect(document.cookie).toContain('sidebar_state=true');
  });

  it('renders collapsed Dashboard, Settings and project routes as working router anchors', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: ['/start', '/dashboard', '/settings', '/project'].map(path => ({ path, component: { template: '<div />' } })),
    });
    await router.push('/start');
    await router.isReady();
    const wrapper = mount(AppSidebar, {
      attachTo: document.body,
      props: {
        user: { name: 'Investor' },
        mainNav: [
          { title: 'Dashboard', to: '/dashboard', items: [{ title: 'Summary', to: '/dashboard' }] },
          { title: 'Settings', to: '/settings', items: [{ title: 'Security', to: '/settings' }] },
        ],
        projects: [{ title: 'Project', to: '/project' }],
      },
      global: { plugins: [router] },
    });
    expect(wrapper.find('router-link').exists()).toBe(false);
    for (const path of ['/dashboard', '/settings', '/project']) {
      const link = wrapper.get(`a[href="${path}"]`);
      await link.trigger('click');
      await flushPromises();
      expect(router.currentRoute.value.path).toBe(path);
    }
  });

  it('keeps none mode fixed and expanded on desktop while mobile remains a closed drawer', async () => {
    const wrapper = mount(AppSidebar, {
      attachTo: document.body,
      props: { user: { name: 'Investor' }, collapsible: 'none', side: 'right' },
    });
    expect(wrapper.get('[data-slot="sidebar-container"]').classes()).toContain('fixed');
    expect(wrapper.get('[data-slot="sidebar-wrapper"]').attributes('style')).toContain('row-reverse');
    await wrapper.get('[data-slot="sidebar-rail"]').trigger('click');
    expect(wrapper.get('[data-slot="sidebar"]').attributes('data-state')).toBe('expanded');
    window.innerWidth = 390;
    window.dispatchEvent(new Event('resize'));
    await nextTick();
    await flushPromises();
    expect(wrapper.find('[data-mobile="true"]').exists()).toBe(false);
    const decoration = wrapper.get('.sidebar-07-closed-shadow');
    expect(decoration.attributes('aria-hidden')).toBe('true');
    expect(decoration.attributes('data-side')).toBe('right');
    expect(decoration.element.children).toHaveLength(0);
    expect(decoration.element.tabIndex).toBe(-1);
    await wrapper.get('[data-sidebar-trigger]').trigger('click');
    await flushPromises();
    expect(wrapper.find('[data-mobile="true"]').exists()).toBe(true);
    expect(wrapper.find('.sidebar-07-closed-shadow').exists()).toBe(false);
    window.innerWidth = 768;
    window.dispatchEvent(new Event('resize'));
    await nextTick();
    await flushPromises();
    expect(wrapper.get('[data-slot="sidebar-container"]').classes()).toContain('fixed');
    expect(wrapper.find('.sidebar-07-closed-shadow').exists()).toBe(false);
    window.innerWidth = 390;
    window.dispatchEvent(new Event('resize'));
    await nextTick();
    await flushPromises();
    expect(wrapper.find('[data-mobile="true"]').exists()).toBe(false);
  });

  it('passes authenticated user and profile avatar sources to real images', () => {
    const avatarSrc = 'https://filer.example.test/auth/files/946906?size=small&v=0';
    const wrapper = mount(AppSidebar, {
      attachTo: document.body,
      props: { user: { name: 'Investor', avatarSrc }, teams: [{ id: 'primary', title: 'Primary', avatarSrc }] },
    });
    expect(wrapper.findAllComponents(AvatarImage).map(image => image.props('src'))).toEqual([avatarSrc, avatarSrc]);
  });

  it('renders the standard sections from typed props', () => {
    const wrapper = mount(AppSidebar, {
      attachTo: document.body,
      props: {
        title: 'Acme',
        subtitle: 'Operations',
        defaultOpen: true,
        mainNav: [{ title: 'Overview', href: '#overview', active: true }],
        projects: [{ title: 'Treasury', href: '#treasury' }],
        user: { name: 'Avery Stone', email: 'avery@acme.test' },
      },
      slots: {
        default: '<div data-testid="page-content">Page content</div>',
      },
    });

    expect(wrapper.text()).toContain('Acme');
    expect(wrapper.text()).toContain('Overview');
    expect(wrapper.text()).toContain('Treasury');
    expect(wrapper.text()).toContain('Avery Stone');
    expect(wrapper.text()).toContain('Page content');
    expect(wrapper.findComponent(VHeaderAuthorized).exists()).toBe(true);
    expect(wrapper.findComponent(VHeaderGuest).exists()).toBe(false);
  });

  it('shows the guest header and hides the sidebar for guests', () => {
    const wrapper = mount(AppSidebar, {
      attachTo: document.body,
      props: {
        title: 'Acme',
        mainNav: [{ title: 'Overview', href: '#overview', active: true }],
        projects: [{ title: 'Treasury', href: '#treasury' }],
        user: null,
      },
      slots: {
        default: '<div data-testid="page-content">Page content</div>',
      },
    });

    expect(wrapper.findComponent(VHeaderGuest).exists()).toBe(true);
    expect(wrapper.findComponent(VHeaderAuthorized).exists()).toBe(false);
    expect(wrapper.find('[data-sidebar="sidebar"]').exists()).toBe(false);
    expect(wrapper.text()).not.toContain('Overview');
    expect(wrapper.text()).not.toContain('Treasury');
    expect(wrapper.text()).toContain('Page content');
  });

  it('prefers named slot overrides over the default section presenters', () => {
    const wrapper = mount(AppSidebar, {
      attachTo: document.body,
      props: {
        title: 'Acme',
        mainNav: [{ title: 'Overview', href: '#overview' }],
        user: { name: 'Avery Stone', email: 'avery@acme.test' },
      },
      slots: {
        header: '<div data-testid="custom-header">Custom Header</div>',
        projects: '<div data-testid="custom-projects">Custom Projects</div>',
      },
    });

    expect(wrapper.find('[data-testid="custom-header"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="custom-projects"]').exists()).toBe(true);
    expect(wrapper.text()).not.toContain('Sidebar block');
  });

  it('collapses the desktop sidebar content when the trigger is clicked', async () => {
    const wrapper = mount(AppSidebar, {
      attachTo: document.body,
      props: {
        title: 'Acme',
        defaultOpen: true,
        mainNav: [{ title: 'Overview', href: '#overview' }],
        projects: [{ title: 'Treasury', href: '#treasury' }],
        user: { name: 'Avery Stone', email: 'avery@acme.test' },
      },
    });

    expect(wrapper.text()).toContain('Overview');

    await wrapper.get('[data-sidebar-trigger]').trigger('click');
    await nextTick();
    await flushPromises();

    expect(wrapper.text()).not.toContain('Overview');
    expect(wrapper.text()).not.toContain('Treasury');
    expect(wrapper.text()).not.toContain('Avery Stone');
  });

  it('renders the mobile drawer expanded and can hide the sidebar header', async () => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      writable: true,
      value: 390,
    });

    const wrapper = mount(AppSidebar, {
      attachTo: document.body,
      props: {
        title: 'Acme',
        mainNav: [{ title: 'Overview', href: '#overview' }],
        user: { name: 'Avery Stone', email: 'avery@acme.test' },
        showHeaderOnMobile: false,
      },
    });

    window.dispatchEvent(new Event('resize'));
    await nextTick();
    await flushPromises();

    expect(wrapper.find('.v-avatar-identity').exists()).toBe(true);

    await wrapper.get('[data-sidebar-trigger]').trigger('click');
    await nextTick();
    await flushPromises();

    expect(wrapper.text()).toContain('Overview');
    expect(wrapper.text()).toContain('Avery Stone');
    expect(wrapper.text()).not.toContain('Acme');
  });

  it('closes the mobile drawer after selecting a navigation item', async () => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      writable: true,
      value: 390,
    });

    const wrapper = mount(AppSidebar, {
      attachTo: document.body,
      props: {
        mainNav: [{ title: 'Overview', href: '#overview' }],
        user: { name: 'Avery Stone', email: 'avery@acme.test' },
      },
    });

    window.dispatchEvent(new Event('resize'));
    await nextTick();
    await flushPromises();

    await wrapper.get('[data-sidebar-trigger]').trigger('click');
    await nextTick();
    await flushPromises();

    expect(wrapper.find('[data-mobile="true"]').exists()).toBe(true);

    await wrapper.get('.nav-main__button').trigger('click');
    await nextTick();
    await flushPromises();

    expect(wrapper.find('[data-mobile="true"]').exists()).toBe(false);
  });

  it('keeps the mobile drawer open when a grouped navigation trigger is clicked', async () => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      writable: true,
      value: 390,
    });

    const wrapper = mount(AppSidebar, {
      attachTo: document.body,
      props: {
        mainNav: [
          {
            title: 'Portfolio',
            href: '#portfolio',
            items: [{ title: 'Positions', href: '#positions' }],
          },
        ],
        user: { name: 'Avery Stone', email: 'avery@acme.test' },
      },
    });

    window.dispatchEvent(new Event('resize'));
    await nextTick();
    await flushPromises();

    await wrapper.get('[data-sidebar-trigger]').trigger('click');
    await nextTick();
    await flushPromises();

    const groupTrigger = wrapper.get('.nav-main__button');
    expect(groupTrigger.element.tagName).toBe('BUTTON');
    expect(groupTrigger.attributes('aria-expanded')).toBe('false');
    expect(groupTrigger.find('button').exists()).toBe(false);
    expect(groupTrigger.element.parentElement?.closest('button')).toBeNull();
    await groupTrigger.trigger('click');
    await nextTick();
    await flushPromises();

    expect(wrapper.find('[data-mobile="true"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('Positions');
  });

  it('renders query-only items as buttons and still emits select', async () => {
    const wrapper = mount(AppSidebar, {
      attachTo: document.body,
      props: {
        defaultOpen: true,
        mainNav: [
          {
            title: 'Summary',
            to: '/dashboard?tab=summary',
            queryOnly: true,
          },
        ],
        user: { name: 'Avery Stone', email: 'avery@acme.test' },
      },
    });

    const queryButton = wrapper.get('.nav-main__button');

    expect(queryButton.element.tagName).toBe('BUTTON');

    await queryButton.trigger('click');

    expect(wrapper.emitted('select')).toEqual([
      [
        expect.objectContaining({
          title: 'Summary',
          to: '/dashboard?tab=summary',
          queryOnly: true,
        }),
      ],
    ]);
  });

  it('closes the mobile drawer after selecting a user dropdown action', async () => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      writable: true,
      value: 390,
    });

    const wrapper = mount(AppSidebar, {
      attachTo: document.body,
      props: {
        user: {
          name: 'Avery Stone', email: 'avery@acme.test', showPhotoAction: true,
        },
      },
      global: {
        stubs: {
          DropdownMenu: {
            template: '<div data-testid="dropdown-root"><slot /></div>',
          },
          DropdownMenuContent: {
            template: '<div data-testid="dropdown-content"><slot /></div>',
          },
          DropdownMenuItem: {
            template: '<button type="button" @click="$emit(\'select\')"><slot /></button>',
          },
          DropdownMenuTrigger: {
            template: '<div data-testid="dropdown-trigger"><slot /></div>',
          },
        },
      },
    });

    window.dispatchEvent(new Event('resize'));
    await nextTick();
    await flushPromises();

    await wrapper.get('[data-sidebar-trigger]').trigger('click');
    await nextTick();
    await flushPromises();

    expect(wrapper.find('[data-mobile="true"]').exists()).toBe(true);

    const photoAction = wrapper.findAll('button')
      .find(button => button.text().includes('Change account photo'));

    expect(photoAction).toBeDefined();

    await photoAction!.trigger('click');
    await nextTick();
    await flushPromises();

    expect(wrapper.emitted('userAction')).toEqual([['photo']]);
    expect(wrapper.find('[data-mobile="true"]').exists()).toBe(false);

    await wrapper.get('[data-sidebar-trigger]').trigger('click');
    await nextTick();
    await flushPromises();

    const settingsAction = wrapper.findAll('button')
      .find(button => button.text().includes('User settings'));

    expect(settingsAction).toBeDefined();

    await settingsAction!.trigger('click');
    await nextTick();
    await flushPromises();

    expect(wrapper.emitted('userAction')).toEqual([['photo'], ['settings']]);
    expect(wrapper.find('[data-mobile="true"]').exists()).toBe(false);
  });

  it('maps a custom team dropdown component back to sidebar events', async () => {
    const CustomTeamDropdown = markRaw(defineComponent({
      emits: ['select'],
      template: `
        <div data-testid="custom-team-dropdown">
          <button
            data-testid="select-profile"
            type="button"
            @click="$emit('select', '2')"
          >
            Select profile
          </button>
          <button
            data-testid="create-profile"
            type="button"
            @click="$emit('select', 'new')"
          >
            Create profile
          </button>
        </div>
      `,
    }));

    const wrapper = mount(AppSidebar, {
      attachTo: document.body,
      props: {
        teams: [
          { id: 1, title: 'Profile 1', active: true },
          { id: 2, title: 'Profile 2' },
        ],
        teamDropdownComponent: CustomTeamDropdown,
        user: { name: 'Avery Stone', email: 'avery@acme.test' },
      },
      global: {
        stubs: {
          DropdownMenu: {
            template: '<div data-testid="dropdown-root"><slot /></div>',
          },
          DropdownMenuContent: {
            template: '<div data-testid="dropdown-content"><slot /></div>',
          },
          DropdownMenuItem: {
            template: '<div data-testid="dropdown-item"><slot /></div>',
          },
          DropdownMenuTrigger: {
            template: '<div data-testid="dropdown-trigger"><slot /></div>',
          },
        },
      },
    });

    expect(wrapper.find('[data-testid="custom-team-dropdown"]').exists()).toBe(true);

    await wrapper.get('[data-testid="select-profile"]').trigger('click');

    expect(wrapper.emitted('teamSelect')).toEqual([
      [{ id: 2, title: 'Profile 2' }],
    ]);

    await wrapper.get('[data-testid="create-profile"]').trigger('click');

    expect(wrapper.emitted('teamCreate')).toHaveLength(1);
  });
});
