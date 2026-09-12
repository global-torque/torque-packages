import type { MenuItem } from './VHeaderNavigation.vue';

export type { MenuItem } from './VHeaderNavigation.vue';

export type VHeaderVariant = 'guest' | 'authorized';

export interface VHeaderProps {
  showNavigation?: boolean;
  logoHref?: string;
  brandName?: string;
  menu?: MenuItem[];
  isMobilePWA?: boolean;
  showProfileLink?: boolean;
  urlProfile?: string | (() => string);
  userLoggedIn?: boolean;
  showMobileSidebar?: boolean;
  variant?: VHeaderVariant;
}

export type VHeaderVariantProps = Omit<VHeaderProps, 'variant'>;
