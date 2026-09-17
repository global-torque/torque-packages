/* @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { computed, effectScope, nextTick } from 'vue';
import { useWebSocket } from '@vueuse/core';
import { useCookies } from '@vueuse/integrations/useCookies';
import Cookies from 'universal-cookie';

const scopes: ReturnType<typeof effectScope>[] = [];
const newScope = () => {
  const scope = effectScope();
  scopes.push(scope);
  return scope;
};
afterEach(() => {
  scopes.splice(0).forEach(scope => scope.stop());
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  document.cookie = 'migration-session=; Max-Age=0; path=/';
});

describe('real VueUse integration lifecycle', () => {
  it('reacts to cookie updates and logout and removes its listener on disposal', async () => {
    const jar = new Cookies();
    const removeListener = vi.spyOn(jar, 'removeChangeListener');
    const scope = newScope();
    const { cookies, session } = scope.run(() => {
      const cookies = useCookies(['migration-session'], {}, jar);
      return { cookies, session: computed(() => cookies.get('migration-session')) };
    })!;
    cookies.set('migration-session', { active: true }, { path: '/' });
    await nextTick();
    expect(session.value).toEqual({ active: true });
    expect(document.cookie).toContain('migration-session=');
    cookies.remove('migration-session', { path: '/' });
    await nextTick();
    expect(session.value).toBeUndefined();
    scope.stop();
    expect(removeListener).toHaveBeenCalledOnce();
  });

  it('reconnects a dropped socket and cancels reconnection when its scope is disposed', async () => {
    vi.useFakeTimers();
    const sockets: Socket[] = [];
    class Socket {
      static OPEN = 1;
      readyState = 0;
      onopen: ((event: Event) => void) | null = null;
      onmessage: ((event: MessageEvent) => void) | null = null;
      onclose: ((event: CloseEvent) => void) | null = null;
      send = vi.fn();
      constructor(public url: string) { sockets.push(this); }
      close = vi.fn(() => {
        this.readyState = 3;
        this.onclose?.(new CloseEvent('close', { code: 1000 }));
      });
      connected() { this.readyState = 1; this.onopen?.(new Event('open')); }
    }
    vi.stubGlobal('WebSocket', Socket);
    const scope = newScope();
    const connection = scope.run(() => useWebSocket('wss://example.test/events', {
      autoReconnect: { retries: 2, delay: 50 },
    }))!;
    await nextTick();
    expect(sockets).toHaveLength(1);
    sockets[0].connected();
    expect(connection.status.value).toBe('OPEN');
    sockets[0].onmessage?.(new MessageEvent('message', { data: 'first' }));
    expect(connection.data.value).toBe('first');
    sockets[0].close();
    await vi.advanceTimersByTimeAsync(50);
    expect(sockets).toHaveLength(2);
    sockets[1].connected();
    expect(connection.send('ping')).toBe(true);
    expect(sockets[1].send).toHaveBeenCalledWith('ping');
    scope.stop();
    expect(sockets[1].close).toHaveBeenCalledOnce();
    await vi.runAllTimersAsync();
    expect(sockets).toHaveLength(2);
    expect(connection.status.value).toBe('CLOSED');
  });
});
