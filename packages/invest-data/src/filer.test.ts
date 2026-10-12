import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { configureInvestDataClientConfig, resetInvestDataClientConfig } from './service/dataClientConfig.ts';
import {
  fetchMyObjectTree,
  fetchObjectTree,
  parseFilerNotificationFields,
  parseFilerObjectTree,
  uploadFilerFile,
} from './filer.ts';

describe('filer request client', () => {
  beforeEach(() => {
    configureInvestDataClientConfig({ apiUrls: { filer: 'https://files.example.test' } });
    vi.stubGlobal('navigator', { onLine: true, userAgent: 'vitest' });
  });

  afterEach(() => {
    resetInvestDataClientConfig();
    vi.unstubAllGlobals();
  });

  it('parses direct-root files, arbitrary nesting, numeric ids, and malformed nodes', () => {
    const parsed = parseFilerObjectTree({
      entities: {
        root: { id: 1, filename: 'root.pdf' },
        folder: {
          name: 'Folder',
          entities: {
            deep: { name: 'Deep', entities: { file: { id: 2, filename: 'deep.pdf' } } },
            malformed: null,
            badId: { id: { nested: true }, filename: 'bad.pdf', entities: ['invalid'] },
          },
        },
      },
    });
    expect(parsed.entities.root.id).toBe(1);
    expect(parsed.entities.folder.entities?.deep.entities?.file.id).toBe(2);
    expect(parsed.entities.folder.entities).not.toHaveProperty('malformed');
    expect(parsed.entities.folder.entities?.badId.id).toBeUndefined();
    expect(parsed.entities.folder.entities?.badId.entities).toBeUndefined();
  });

  it('keeps concurrent public/private requests request-local', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      const id = url.includes('/public/') ? 2 : 1;
      await Promise.resolve();
      return new Response(JSON.stringify({ entities: { [id]: { id, filename: `${id}.pdf` } } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }));

    const [privateTree, publicTree] = await Promise.all([
      fetchObjectTree({ access: 'private', objectName: 'offer', objectId: 10 }),
      fetchObjectTree({ access: 'public', objectName: 'offer', objectId: 10 }),
    ]);
    expect(Object.keys(privateTree.entities)).toEqual(['1']);
    expect(Object.keys(publicTree.entities)).toEqual(['2']);
  });

  it('preserves intentional nested object paths while encoding each segment', async () => {
    const fetchMock = vi.fn(async (_input: string | URL | Request) => new Response(JSON.stringify({ entities: {} }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }));
    vi.stubGlobal('fetch', fetchMock);
    await fetchObjectTree({ access: 'private', objectName: 'user', objectId: 'offer/42' });
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/auth/objects/user/offer/42');
  });

  it('normalizes trailing slashes before appending filer request paths', async () => {
    configureInvestDataClientConfig({ apiUrls: { filer: 'https://files.example.test/api///' } });
    const fetchMock = vi.fn(async (_input: string | URL | Request) => new Response(JSON.stringify({ entities: {} }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }));
    vi.stubGlobal('fetch', fetchMock);

    await fetchObjectTree({ access: 'private', objectName: 'user', objectId: 42 });

    expect(String(fetchMock.mock.calls[0]?.[0]))
      .toBe('https://files.example.test/api/auth/objects/user/42');
  });

  it('loads the authenticated account tree without IDs, query parameters, or a request body', async () => {
    const fetchMock = vi.fn(async (_input: string | URL | Request, _init?: RequestInit) => new Response(JSON.stringify({
      entities: {
        folder: {
          unknown_field: 'preserved',
          entities: {
            file: { id: 17, filename: 'account.pdf' },
          },
        },
      },
    }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchMyObjectTree();

    const [input, init] = fetchMock.mock.calls[0] ?? [];
    expect(String(input)).toBe('https://files.example.test/auth/objects/my');
    expect(init?.method).toBe('GET');
    expect(new URL(String(input)).search).toBe('');
    expect(init?.body).toBeUndefined();
    expect(result.entities.folder.entities?.file.id).toBe(17);
  });

  it('accepts an empty account tree and rejects malformed account tree envelopes before parsing', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({}), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }));
    await expect(fetchMyObjectTree()).resolves.toEqual({ entities: {} });

    for (const malformed of [
      [],
      { unexpected: true },
      { entities: [] },
      { entities: { folder: [] } },
      { entities: { folder: { entities: [] } } },
    ]) {
      fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(malformed), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }));
      await expect(fetchMyObjectTree()).rejects.toThrow('malformed object tree');
    }
  });

  it('forwards account-tree request cancellation to the authenticated filer request', async () => {
    let requestSignal: AbortSignal | undefined;
    const fetchMock = vi.fn((_input: string | URL | Request, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      requestSignal = init?.signal as AbortSignal | undefined;
      if (!requestSignal) {
        reject(new Error('missing request signal'));
        return;
      }
      requestSignal.addEventListener('abort', () => {
        reject(new DOMException('The request was aborted.', 'AbortError'));
      }, { once: true });
    }));
    vi.stubGlobal('fetch', fetchMock);
    const controller = new AbortController();
    const request = fetchMyObjectTree({ signal: controller.signal });

    await vi.waitFor(() => expect(requestSignal).toBeDefined());
    controller.abort();

    await expect(request).rejects.toMatchObject({ name: 'AbortError' });
    expect(requestSignal?.aborted).toBe(true);
  });

  it.each([
    'https://files.example.test/api?tenant=1',
    'https://files.example.test/api#files',
  ])('rejects unusable filer base URL suffixes: %s', async (filer) => {
    configureInvestDataClientConfig({ apiUrls: { filer } });
    await expect(fetchObjectTree({
      access: 'private', objectName: 'user', objectId: 42,
    })).rejects.toThrow('query, or a fragment');
  });

  it('rejects a successful sign response with a missing id', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ meta: {} }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })));
    await expect(uploadFilerFile(new File(['x'], 'x.png', { type: 'image/png' }), {
      objectId: 1,
      objectName: 'user',
      userId: 1,
    })).rejects.toThrow('file id');
  });

  it('rejects a successful sign response with a missing URL', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ meta: { id: 11 } }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })));
    await expect(uploadFilerFile(new File(['x'], 'x.png', { type: 'image/png' }), {
      objectId: 1,
      objectName: 'user',
      userId: 1,
    })).rejects.toThrow('sign URL');
  });

  it('accepts any successful 2xx object upload and returns its own numeric id', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      url: 'https://storage.example.test/upload',
      meta: { id: '44' },
    }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })));
    class FakeXhr {
      status = 201;
      timeout = 0;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      ontimeout: (() => void) | null = null;
      onabort: (() => void) | null = null;
      open() {}
      setRequestHeader() {}
      send() { this.onload?.(); }
      abort() { this.onabort?.(); }
    }
    vi.stubGlobal('XMLHttpRequest', FakeXhr);
    await expect(uploadFilerFile(new File(['x'], 'x.png', { type: 'image/png' }), {
      objectId: 1,
      objectName: 'user',
      userId: 1,
    })).resolves.toEqual({ fileId: 44 });
  });

  it.each([
    ['non-2xx response', 403, 'load', 'status 403'],
    ['network error', 0, 'error', 'Object upload failed'],
    ['timeout', 0, 'timeout', 'timed out'],
  ])('rejects an object upload %s', async (_label, status, event, message) => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      url: 'https://storage.example.test/upload',
      file_id: 51,
    }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })));
    class FakeXhr {
      status = status;
      timeout = 0;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      ontimeout: (() => void) | null = null;
      onabort: (() => void) | null = null;
      open() {}
      setRequestHeader() {}
      send() {
        if (event === 'load') this.onload?.();
        if (event === 'error') this.onerror?.();
        if (event === 'timeout') this.ontimeout?.();
      }
      abort() { this.onabort?.(); }
    }
    vi.stubGlobal('XMLHttpRequest', FakeXhr);
    await expect(uploadFilerFile(new File(['x'], 'x.png', { type: 'image/png' }), {
      objectId: 1,
      objectName: 'user',
      userId: 1,
    })).rejects.toThrow(message);
  });

  it('aborts the object upload through its request signal', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      url: 'https://storage.example.test/upload',
      file_id: 52,
    }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })));
    const controller = new AbortController();
    class FakeXhr {
      status = 0;
      timeout = 0;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      ontimeout: (() => void) | null = null;
      onabort: (() => void) | null = null;
      open() {}
      setRequestHeader() {}
      send() { controller.abort(); }
      abort() { this.onabort?.(); }
    }
    vi.stubGlobal('XMLHttpRequest', FakeXhr);
    const result = uploadFilerFile(new File(['x'], 'x.png', { type: 'image/png' }), {
      objectId: 1,
      objectName: 'user',
      userId: 1,
      signal: controller.signal,
    });
    await expect(result).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('decodes envelope, map-shaped, and legacy array notification fields', () => {
    expect(parseFilerNotificationFields({ data: { fields: { type: 'file_thumbnail', source_file_id: 7 } } }))
      .toMatchObject({ source_file_id: 7 });
    expect(parseFilerNotificationFields({ data: { fields: { seven: { type: 'file', object_id: 7 } } } }))
      .toMatchObject({ object_id: 7 });
    expect(parseFilerNotificationFields({ data: { fields: [{ type: 'file' }, { object_id: 8 }] } }))
      .toMatchObject({ type: 'file', object_id: 8 });
  });
});
