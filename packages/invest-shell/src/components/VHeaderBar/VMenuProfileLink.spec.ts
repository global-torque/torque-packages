/* @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'


const hoisted = vi.hoisted(() => ({
  navigateWithQueryParams: vi.fn(),
}))


vi.mock('@lucide/vue', () => ({
  UserIcon: {
    name: 'UserIconMock',
    template: '<button class="user-icon-mock" @click.stop="$emit(\'click\', $event)"></button>',
  },
}))

vi.mock('@webdevelop-pro/invest-runtime/navigation', () => ({
  navigateWithQueryParams: hoisted.navigateWithQueryParams,
}))


import VMenuProfileLink from './VMenuProfileLink.vue'
import { renderToString } from '@vue/server-renderer'
import { createSSRApp, h } from 'vue'



async function ssrRender(props: Record<string, any>) {
  const app = createSSRApp({
    render: () => h(VMenuProfileLink, props),
  })
  return await renderToString(app)
}



describe('VMenuProfileLink (node / SSR)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('SSR: renders empty when userLoggedIn=false', async () => {
    const html = await ssrRender({ userLoggedIn: false, urlProfile: '/profiles/me' })
    
    expect(html.trim()).toMatch(/^\s*<!--v-if-->\s*$/)
  })

  it('SSR: renders something when userLoggedIn=true', async () => {
    const html = await ssrRender({ userLoggedIn: true, urlProfile: '/profiles/me' })
    expect(html.trim()).not.toBe('')
  })

  it('module loads and is a Vue SFC object (node)', () => {
    expect(VMenuProfileLink).toBeTruthy()
    expect(typeof VMenuProfileLink).toBe('object')
  })

  it('helper is mockable (node, no DOM)', () => {
    hoisted.navigateWithQueryParams('/x')
    expect(hoisted.navigateWithQueryParams).toHaveBeenCalledWith('/x')
  })
})

describe('VMenuProfileLink (jsdom)', () => {

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('module loads and is a Vue SFC object (jsdom)', () => {
    expect(VMenuProfileLink).toBeTruthy()
    expect(typeof VMenuProfileLink).toBe('object')
  })

  it('DOM: click calls navigateWithQueryParams when urlProfile is string', async () => {
    const wrapper = mount(VMenuProfileLink, {
      props: { userLoggedIn: true, urlProfile: '/profiles/me' },
    })

    await wrapper.findComponent({ name: 'UserIconMock' }).trigger('click')

    expect(hoisted.navigateWithQueryParams).toHaveBeenCalled()
    expect(hoisted.navigateWithQueryParams.mock.lastCall).toEqual(['/profiles/me'])
  })

  it('DOM: resolves functional urlProfile before navigation', async () => {
    const resolver = vi.fn().mockReturnValue('/profiles/42')
    const wrapper = mount(VMenuProfileLink, {
      props: { userLoggedIn: true, urlProfile: resolver },
    })

    await wrapper.findComponent({ name: 'UserIconMock' }).trigger('click')

    expect(resolver).toHaveBeenCalledTimes(1)
    expect(hoisted.navigateWithQueryParams).toHaveBeenCalledWith('/profiles/42')
  })

  it('helper is mockable (jsdom, no DOM required)', () => {
    hoisted.navigateWithQueryParams('/y')
    expect(hoisted.navigateWithQueryParams).toHaveBeenCalledWith('/y')
  })
})
