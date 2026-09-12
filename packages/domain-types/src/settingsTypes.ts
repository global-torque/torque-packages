import type { ISession } from './authTypes.ts';

export type { IAuthFlow, ILogoutFlow, ISession } from './authTypes.ts';

export interface IActivityRow {
  date: string;
  time: string;
  ip: string;
  browser: string;
  id: string;
  current?: boolean;
}

export type ISessionDevice = ISession['devices'][number];

export interface ISessionFormatted extends ISession {
  authenticatedAtDate: string;
  authenticatedAtTime: string;
  devicesFormatted: IActivityRow[];
}
