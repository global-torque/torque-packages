/// <reference types="vite/client" />

interface ImportMeta {
  readonly env: Record<string, string | boolean | undefined>;
  readonly hot?: {
    accept: (...args: any[]) => void;
  };
  readonly vitest?: unknown;
  glob?: (...args: any[]) => Record<string, unknown>;
}

declare module '*.scss';
declare module '*.css';
declare module '*.svg';
declare module '*.svg?url';
declare module '*.svg?component';
declare module '*.mp4';
