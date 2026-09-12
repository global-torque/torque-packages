import type { Component } from 'vue';
import type { RouteLocationRaw } from 'vue-router';
import type { SidebarProps } from '@global-torque/ui-primitives/sidebar';

export interface SidebarNavItem {
  id?: string;
  title: string;
  href?: string;
  to?: RouteLocationRaw;
  icon?: Component;
  badge?: string | number;
  active?: boolean;
  disabled?: boolean;
  queryOnly?: boolean;
  items?: SidebarNavItem[];
}

export interface SidebarUser {
  name: string;
  email?: string;
  role?: string;
  avatarSrc?: string;
  avatarText?: string;
  showPhotoAction?: boolean;
}

export type SidebarUserAction = 'photo' | 'settings' | 'password' | 'logout';

export interface SidebarTeam {
  id: string | number;
  title: string;
  subtitle?: string;
  avatarSrc?: string;
  avatarText?: string;
  active?: boolean;
}

export interface Sidebar07Props extends Pick<SidebarProps, 'side' | 'collapsible'> {
  title?: string;
  subtitle?: string;
  mainNav?: SidebarNavItem[];
  projects?: SidebarNavItem[];
  teams?: SidebarTeam[];
  teamDropdownComponent?: Component;
  teamDropdownProps?: Record<string, unknown>;
  user?: SidebarUser | null;
  defaultOpen?: boolean;
  showHeaderOnMobile?: boolean;
}
