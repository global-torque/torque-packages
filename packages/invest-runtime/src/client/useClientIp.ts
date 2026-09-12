import { ref } from 'vue';

const ip = ref<string | null>(null);
const loading = ref(false);

let inFlight: Promise<void> | null = null;

async function resolveFromCloudflare(): Promise<string | null> {
  const res = await fetch('https://www.cloudflare.com/cdn-cgi/trace', {
    credentials: 'omit',
  });

  const text = await res.text();
  const line = text
    .split('\n')
    .find((row) => row.startsWith('ip='));

  if (!line) return null;
  const value = line.slice(3).trim();
  return value || null;
}

async function resolveFromIpify(): Promise<string | null> {
  const res = await fetch('https://api.ipify.org?format=json', {
    credentials: 'omit',
  });
  const data = (await res.json()) as { ip?: string };
  return typeof data.ip === 'string' && data.ip ? data.ip : null;
}

async function doFetchIp(): Promise<void> {
  if (typeof window === 'undefined') return;

  loading.value = true;
  try {
    let value: string | null = null;

    try {
      value = await resolveFromCloudflare();
    } catch {
      // Ignore and fall back to ipify
    }

    if (!value) {
      try {
        value = await resolveFromIpify();
      } catch {
        // Final failure; keep value as null
      }
    }

    ip.value = value;

    if (typeof window !== 'undefined' && value) {
      (window as any).__CLIENT_IP__ = value;
    }
  } finally {
    loading.value = false;
    inFlight = null;
  }
}

export function useClientIp() {
  const fetchIp = async () => {
    if (ip.value || loading.value) {
      return inFlight ?? Promise.resolve();
    }

    inFlight = doFetchIp();
    return inFlight;
  };

  return {
    ip,
    loading,
    fetchIp,
  };
}

