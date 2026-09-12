import type { Component } from 'vue';

export type SocialNetworkName = 'linkedin' | 'facebook' | 'instagram' | 'twitter' | 'github';
export type SocialIcon = Component | string;
export type SocialIconMap = Readonly<Record<SocialNetworkName, SocialIcon>>;

export interface SocialNetwork {
  iconName: string;
  name: string;
  shareHref?: string;
}

export type SocialLinkDestination = SocialNetwork & {
  href: string;
};

export interface SocialLink extends SocialLinkDestination {
  icon: SocialIcon;
}

export const socials: Record<SocialNetworkName, SocialNetwork> = {
  linkedin: {
    iconName: 'linkedin',
    name: 'LinkedIn',
    shareHref: 'https://www.linkedin.com/sharing/share-offsite/?url=',
  },
  facebook: {
    iconName: 'facebook',
    name: 'Facebook',
    shareHref: 'https://www.facebook.com/sharer.php?u=',
  },
  instagram: {
    iconName: 'instagram',
    name: 'Instagram',
  },
  twitter: {
    iconName: 'twitter',
    shareHref: 'https://twitter.com/intent/tweet?url=',
    name: 'Twitter',
  },
  github: {
    iconName: 'github',
    name: 'Github',
  },
};

/** Preserve host supplied icons, destinations, and custom network metadata. */
export const resolveSocialList = (list: readonly SocialLink[]): SocialLink[] => list.map(item => ({ ...item }));
