/** Package-private input contract; ordering is owned by useOffersDetails. */
export type OfferMedia = {
  image?: string;
  video?: string;
  thumb?: string;
  srcset?: string;
  sizes?: string;
  thumbSrcset?: string;
  thumbSizes?: string;
};

export function mediaKeys(files: readonly OfferMedia[]): string[] {
  const occurrences = new Map<string, number>();
  return files.map((file) => {
    const identity = JSON.stringify([file.video ? 'video' : 'image', file.video || file.image || '']);
    const occurrence = occurrences.get(identity) || 0;
    occurrences.set(identity, occurrence + 1);
    return `${identity}:${occurrence}`;
  });
}

export function mediaIndex(value: string, count: number): number {
  if (!/^\d+$/.test(value)) return 0;
  const index = Number(value);
  return Number.isSafeInteger(index) && index < count ? index : 0;
}

export type OfferVideo = { provider: 'youtube' | 'vimeo'; embed: string; page: string; poster?: string };

export function normalizeOfferVideo(input: string): OfferVideo | null {
  // Extract the source only. Supplied markup is never inserted into the DOM.
  let source = input.trim();
  if (source.startsWith('<')) {
    const tag = /^<iframe\b((?:[^>"']|"[^"]*"|'[^']*')*)>/i.exec(source);
    if (!tag) return null;
    const attributes = tag[1].matchAll(/([^\s=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s]+)))?/g);
    source = '';
    for (const attribute of attributes) {
      if (attribute[1].toLowerCase() === 'src') {
        source = (attribute[2] ?? attribute[3] ?? attribute[4] ?? '').replace(/&amp;/gi, '&');
        break;
      }
    }
  }
  if (!source) return null;
  try {
    const url = new URL(source);
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.port) return null;
    const host = url.hostname.toLowerCase();
    const parts = url.pathname.split('/').filter(Boolean);
    if (['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtube-nocookie.com', 'www.youtube-nocookie.com', 'youtu.be'].includes(host)) {
      const id = host === 'youtu.be'
        ? parts[0]
        : parts[0] === 'watch'
          ? url.searchParams.get('v')
          : ['embed', 'shorts', 'live'].includes(parts[0] || '') ? parts[1] : null;
      if (!id || !/^[\w-]{11}$/.test(id)) return null;
      return { provider: 'youtube', embed: `https://www.youtube.com/embed/${id}`, page: `https://www.youtube.com/watch?v=${id}`, poster: `https://i.ytimg.com/vi/${id}/hqdefault.jpg` };
    }
    if (['vimeo.com', 'www.vimeo.com', 'player.vimeo.com'].includes(host)) {
      const id = host === 'player.vimeo.com' && parts[0] === 'video' ? parts[1] : parts[0];
      if (!id || !/^\d+$/.test(id)) return null;
      const hash = url.searchParams.get('h') || (host !== 'player.vimeo.com' ? parts[1] : undefined);
      if (hash && !/^[a-zA-Z0-9]+$/.test(hash)) return null;
      return { provider: 'vimeo', embed: `https://player.vimeo.com/video/${id}${hash ? `?h=${hash}` : ''}`, page: `https://vimeo.com/${id}${hash ? `/${hash}` : ''}` };
    }
  }
  catch { /* Unsupported or malformed provider source. */ }
  return null;
}
