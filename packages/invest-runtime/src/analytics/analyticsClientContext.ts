export interface ClientContextLike {
  userAgent?: string;
  language?: string;
  onLine?: boolean;
  timeZone?: string;
  viewport?: { width?: number; height?: number };
  screen?: { width?: number; height?: number; availWidth?: number; availHeight?: number };
  orientation?: { type?: string; angle?: number };
}

export const getClientContext = (): ClientContextLike => {
  return {
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
    language: typeof navigator !== 'undefined' ? navigator.language : '',
    onLine: typeof navigator !== 'undefined' ? navigator.onLine : undefined,
    timeZone:
      typeof Intl !== 'undefined' && Intl.DateTimeFormat
        ? Intl.DateTimeFormat().resolvedOptions().timeZone
        : undefined,
    viewport: {
      width: typeof window !== 'undefined' ? window.innerWidth : undefined,
      height: typeof window !== 'undefined' ? window.innerHeight : undefined,
    },
    screen:
      typeof window !== 'undefined' && window.screen
        ? {
            width: window.screen.width,
            height: window.screen.height,
            availWidth: window.screen.availWidth,
            availHeight: window.screen.availHeight,
          }
        : undefined,
    orientation:
      typeof window !== 'undefined' && (window.screen as any)?.orientation
        ? {
            type: (window.screen as any).orientation.type,
            angle: (window.screen as any).orientation.angle,
          }
        : undefined,
  };
};

