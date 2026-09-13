/* eslint-disable vue/one-component-per-file */
/* @vitest-environment jsdom */

import { mount } from '@vue/test-utils'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { cloneVNode, defineComponent, h, isVNode, ref } from 'vue'

vi.mock('vue-router', async () => {
  const actual = await vi.importActual('vue-router')

  return {
    ...actual,
    RouterLink: defineComponent({
      name: 'RouterLink',
      props: {
        to: { type: String, required: true },
      },
      setup(props, { slots, attrs }) {
        return () => h('a', { href: props.to, 'data-router-link': 'true', ...attrs }, slots.default?.())
      },
    }),
  }
})

const hoisted = vi.hoisted(() => ({
  mockIcon: (name: string) =>
    defineComponent({ name, setup: () => () => h('i', { 'data-icon': name }) }),
}))

vi.mock('@global-torque/invest-widgets/icons/navigation', () => ({
  EarnMenuIcon: hoisted.mockIcon('EarnIcon'),
  FaqMenuIcon: hoisted.mockIcon('FaqIcon'),
  HelpMenuIcon: hoisted.mockIcon('HelpIcon'),
  HomeMenuIcon: hoisted.mockIcon('HomeIcon'),
  InvestmentMenuIcon: hoisted.mockIcon('InvestmentIcon'),
  PortfolioMenuIcon: hoisted.mockIcon('PortfolioIcon'),
  WalletMenuIcon: hoisted.mockIcon('WalletIcon'),
}))

vi.mock('../navigation/links.ts', () => ({
  urlHome: '/home',
  urlOffers: '/offers',
  urlHowItWorks: '/how-it-works',
  urlFaq: '/faq',
  urlProfilePortfolio:   (id: string | number | null | undefined) => `/profile/${id}/portfolio`,
  urlProfileSummary:     (id: string | number | null | undefined) => `/profile/${id}/summary`,
  urlProfileWallet:      (id: string | number | null | undefined) => `/profile/${id}/wallet`,
  urlProfileEarn:        (id: string | number | null | undefined) => `/profile/${id}/earn`,
  urlProfileTabSummary:  (id: string | number | null | undefined) => `/profile/${id}/account?tab=summary`,
  urlProfileTabPortfolio:(id: string | number | null | undefined) => `/profile/${id}/account?tab=portfolio`,
  urlProfileTabWallet:   (id: string | number | null | undefined) => `/profile/${id}/account?tab=wallet`,
  urlProfileTabEarn:     (id: string | number | null | undefined) => `/profile/${id}/account?tab=earn`,
}))

const userLoggedInRef = ref(false)
const selectedUserProfileIdRef = ref<string | number>('u-1')
const notificationsSidebarOpenRef = ref(false)

vi.mock('@global-torque/invest-runtime/application-context', () => ({
  useInvestApplicationContext: () => ({
    appConfig: { urls: { frontend: 'https://example.test/dashboard' } },
  }),
}))

vi.mock('@global-torque/invest-runtime/session', () => ({
  useSessionStore: () => ({ userLoggedIn: userLoggedInRef }),
}))
vi.mock('@global-torque/invest-runtime/profiles', () => ({
  useProfilesStore: () => ({ selectedUserProfileId: selectedUserProfileIdRef }),
}))

vi.mock('@global-torque/invest-widgets/notifications', () => ({
  useNotificationsSidebarWidget: () => ({
    isSidebarOpen: notificationsSidebarOpenRef,
  }),
}))

vi.mock('pinia', async () => {
  const actual = await vi.importActual('pinia')
  return {
    ...actual,
    storeToRefs: (store: any) => {
      if (!store) return {}
      const refs: any = {}
      for (const key in store) {
        if (store[key] && typeof store[key] === 'object' && 'value' in store[key]) {
          refs[key] = store[key]
        } else if (store[key] !== null && store[key] !== undefined) {
          refs[key] = { value: store[key] }
        }
      }
      return refs
    },
  }
})

import PWAFooterMenu from './PWAFooterMenu.vue'

const mountMenu = (props?: Record<string, any>) =>
  mount(PWAFooterMenu, {
    props,
    attachTo: document.body,
  })

function pwafMenuTests() {
  beforeEach(() => {
    userLoggedInRef.value = false
    selectedUserProfileIdRef.value = 'u-1'
    notificationsSidebarOpenRef.value = false
  })

  it('renders guest menu (4 items) when logged out', () => {
    const wrapper = mountMenu({ currentPath: '/home' })

    const ul = wrapper.get('ul.pwa-footer-menu__list')
    expect(ul.classes()).toContain('pwa-footer-menu__list--cols-4')

    const links = wrapper.findAll('a.pwa-footer-menu__link')
    expect(links.length).toBe(4)

    const labels = links.map((a) => a.text().trim())
    expect(labels).toEqual(['Home', 'Invest', 'Help', 'FAQ'])

    const hrefs = links.map((a) => a.attributes('href'))
    expect(hrefs).toEqual(['/home', '/offers', '/how-it-works', '/faq'])
  })

  it('renders auth menu (5 items) when logged in', () => {
    userLoggedInRef.value = true
    selectedUserProfileIdRef.value = 'abc'

    const wrapper = mountMenu({ currentPath: '/profile/abc/portfolio' })

    const ul = wrapper.get('ul.pwa-footer-menu__list')
    expect(ul.classes()).toContain('pwa-footer-menu__list--cols-5')

    const hrefs = wrapper.findAll('a.pwa-footer-menu__link').map((a) => a.attributes('href'))
    expect(hrefs).toEqual([
      '/profile/abc/account?tab=summary',
      '/profile/abc/account?tab=portfolio',
      '/offers',
      '/profile/abc/account?tab=wallet',
      '/profile/abc/account?tab=earn',
    ])

    const labels = wrapper.findAll('.pwa-footer-menu__label').map((n) => n.text())
    expect(labels).toEqual(['Home', 'Portfolio', 'Invest', 'Wallet', 'Earn'])
    expect(wrapper.find('[data-router-link="true"]').exists()).toBe(false)
  })

  it('renders full menu when currentPath equals offers target', () => {
    const wrapper = mountMenu({ currentPath: '/offers' })
    const links = wrapper.findAll('a.pwa-footer-menu__link')

    expect(links.map((a) => a.text().trim())).toEqual(['Home', 'Invest', 'Help', 'FAQ'])
    expect(links.find((a) => a.text().includes('Invest'))?.classes())
      .toContain('pwa-footer-menu__link--active')
  })

  it('renders full menu when currentPath is within offers subpath', () => {
    const wrapper = mountMenu({ currentPath: '/offers/deal-1?x=1#hash' })
    const links = wrapper.findAll('a.pwa-footer-menu__link')

    expect(links.map((a) => a.text().trim())).toEqual(['Home', 'Invest', 'Help', 'FAQ'])
    expect(links.find((a) => a.text().includes('Invest'))?.classes())
      .toContain('pwa-footer-menu__link--active')
  })

  it('marks Portfolio active on account route for profile section mapping', () => {
    userLoggedInRef.value = true
    selectedUserProfileIdRef.value = 'abc'
    const wrapper = mountMenu({ currentPath: '/profile/abc/account?tab=portfolio' })
    const portfolio = wrapper.findAll('a.pwa-footer-menu__link').find((a) => a.attributes('href') === '/profile/abc/account?tab=portfolio')!
    expect(portfolio.classes()).toContain('pwa-footer-menu__link--active')
  })

  it('uses withBase only for active detection (href remains raw)', () => {
    userLoggedInRef.value = true
    selectedUserProfileIdRef.value = 'abc'
    const withBase = (to: string) => `/base${to}`
    const wrapper = mountMenu({ currentPath: '/base/profile/abc/account?tab=wallet', withBase })

    const el = wrapper.findAll('a.pwa-footer-menu__link').find((a) => a.text().includes('Wallet'))!
    expect(el.attributes('href')).toBe('/profile/abc/account?tab=wallet')
    expect(el.classes()).toContain('pwa-footer-menu__link--active')
  })

  it('uses router links only when explicitly enabled', () => {
    userLoggedInRef.value = true
    selectedUserProfileIdRef.value = 'abc'

    const wrapper = mountMenu({
      currentPath: '/profile/abc/account?tab=wallet',
      useRouterLinks: true,
    })

    const routerLinks = wrapper.findAll('[data-router-link="true"]')
    expect(routerLinks.length).toBe(4)
    expect(routerLinks.map((a) => a.attributes('href'))).toEqual([
      '/profile/abc/account?tab=summary',
      '/profile/abc/account?tab=portfolio',
      '/profile/abc/account?tab=wallet',
      '/profile/abc/account?tab=earn',
    ])
  })

  it('matches dashboard-prefixed paths against internal menu links', () => {
    userLoggedInRef.value = true
    selectedUserProfileIdRef.value = '1049'

    const wrapper = mountMenu({ currentPath: '/dashboard/profile/1049/account?tab=earn' })

    const earn = wrapper.findAll('a.pwa-footer-menu__link').find(a => a.attributes('href') === '/profile/1049/account?tab=earn')!
    expect(earn.classes()).toContain('pwa-footer-menu__link--active')
  })

  it('updates links when selectedUserProfileId changes without keeping a stale active state', async () => {
    userLoggedInRef.value = true
    selectedUserProfileIdRef.value = 'p1'
    const wrapper = mountMenu({ currentPath: '/profile/p1/account?tab=wallet' })

    let wallet = wrapper.findAll('a.pwa-footer-menu__link').find((a) => a.text().includes('Wallet'))!
    expect(wallet.attributes('href')).toBe('/profile/p1/account?tab=wallet')
    expect(wallet.classes()).toContain('pwa-footer-menu__link--active')

    selectedUserProfileIdRef.value = 'p2'
    await wrapper.vm.$nextTick()

    wallet = wrapper.findAll('a.pwa-footer-menu__link').find((a) => a.text().includes('Wallet'))!
    expect(wallet.attributes('href')).toBe('/profile/p2/account?tab=wallet')
    expect(wallet.classes()).not.toContain('pwa-footer-menu__link--active')
  })

  it('structural sanity: nav/ul/li icons exist', () => {
    const wrapper = mountMenu({ currentPath: '/home' })
    expect(wrapper.get('nav[aria-label="PWA Bottom Menu"]').exists()).toBe(true)

    const items = wrapper.findAll('li.pwa-footer-menu__item')
    expect(items.length).toBe(4)

    items.forEach((li) => {
      const icon = li.find('[data-icon]')
      expect(icon.exists()).toBe(true)
    })
  })

  it.each([
    ['offer list', 'offers'],
    ['offer details', 'offer-single'],
  ])('renders menu on %s layout', (_, currentLayout) => {
    userLoggedInRef.value = true
    selectedUserProfileIdRef.value = 'abc'

    const wrapper = mountMenu({ currentPath: '/offers/some-offer', currentLayout })
    expect(wrapper.get('nav[aria-label="PWA Bottom Menu"]').exists()).toBe(true)
  })

  it('hides menu when notifications sidebar is open', () => {
    notificationsSidebarOpenRef.value = true
    const wrapper = mountMenu({ currentPath: '/home' })
    expect(wrapper.find('nav[aria-label="PWA Bottom Menu"]').exists()).toBe(false)
  })
}

describe('PWAFooterMenu (jsdom)', { environment: 'jsdom' }, () => {
  pwafMenuTests()
})

describe('PWAFooterMenu (node)', { environment: 'node' }, () => {
  pwafMenuTests()
})
