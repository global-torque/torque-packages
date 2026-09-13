<script setup lang="ts">
// @ts-nocheck
import { computed, type Component } from 'vue';
import { Avatar, AvatarFallback, AvatarImage } from '@global-torque/ui-primitives/avatar';
import { Button } from '@global-torque/ui-primitives/button';
import { SettingsMenuIcon as GearIcon } from '@global-torque/invest-widgets/icons';
import {
  ChevronRightIcon as ArrowRight,
  ContactMenuIcon as ContactIcon,
  FaqMenuIcon as FaqIcon,
  HelpMenuIcon as HelpIcon,
  LogoutMenuIcon as LogoutIcon,
  UserMenuIcon as UserIcon,
} from '@global-torque/invest-widgets/icons/navigation';

const props = defineProps<{
  email?: string;
  avatarSrc?: string;
  avatarInitial?: string;
  avatarLoading?: boolean;
  accountDetailsHref?: string;
  mfaHref?: string;
  securityHref?: string;
  howItWorksHref?: string;
  faqHref?: string;
  contactHref?: string;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'logout'): void;
  (e: 'switch-profile-open'): void;
}>();

type OverlayItemBase = {
  id: string;
  label: string;
  icon: Component;
  className?: string;
};

type OverlayLinkItem = OverlayItemBase & {
  type: 'link';
  href: string;
};

type OverlayActionItem = OverlayItemBase & {
  type: 'action';
  action: 'logout';
};

type OverlayItem = OverlayLinkItem | OverlayActionItem;

type OverlayGroup = {
  id: string;
  ariaLabel: string;
  sectionClassName?: string;
  items: OverlayItem[];
};

const toLinkItem = (item: Omit<OverlayLinkItem, 'type'>): OverlayLinkItem | null => {
  if (!item.href) {
    return null;
  }

  return {
    ...item,
    type: 'link',
  };
};

const isOverlayItem = (item: OverlayItem | null): item is OverlayItem => item !== null;

const overlayGroups = computed<OverlayGroup[]>(() => [
  {
    id: 'settings',
    ariaLabel: 'Account settings',
    items: [
      toLinkItem({
        id: 'mfa',
        href: props.mfaHref ?? '',
        label: 'MFA & Password',
        icon: UserIcon,
      }),
      toLinkItem({
        id: 'security',
        href: props.securityHref ?? '',
        label: 'Account Security',
        icon: GearIcon,
      }),
    ].filter(isOverlayItem),
  },
  {
    id: 'support',
    ariaLabel: 'Support',
    items: [
      toLinkItem({
        id: 'how-it-works',
        href: props.howItWorksHref ?? '',
        label: 'How It Works',
        icon: HelpIcon,
      }),
      toLinkItem({
        id: 'faq',
        href: props.faqHref ?? '',
        label: 'FAQ',
        icon: FaqIcon,
      }),
      toLinkItem({
        id: 'contact',
        href: props.contactHref ?? '',
        label: 'Contact Us',
        icon: ContactIcon,
      }),
    ].filter(isOverlayItem),
  },
  {
    id: 'account-actions',
    ariaLabel: 'Account actions',
    sectionClassName: 'v-header-profile-pwa__overlay-section--logout',
    items: [
      {
        id: 'logout',
        type: 'action',
        action: 'logout',
        label: 'Log Out',
        icon: LogoutIcon,
        className: 'v-header-profile-pwa__overlay-item--logout',
      },
    ],
  },
].filter((group) => group.items.length));

const onOverlayItemClick = (item: OverlayActionItem) => {
  if (item.action === 'logout') {
    emit('logout');
  }
};
</script>

<template>
  <Teleport to="body">
    <div
      class="VHeaderProfileOverlayPWA v-header-profile-pwa__overlay"
      role="dialog"
      aria-modal="true"
    >
      <div class="v-header-profile-pwa__overlay-header">
        <button
          type="button"
          class="v-header-profile-pwa__overlay-close"
          aria-label="Close"
          @click="emit('close')"
        >
          ✕
        </button>
      </div>
      <div class="v-header-profile-pwa__overlay-body">
        <div class="v-header-profile-pwa__overlay-content">
          <section class="v-header-profile-pwa__overlay-profile-panel">
            <div class="v-header-profile-pwa__overlay-profile">
              <a
                v-if="accountDetailsHref"
                :href="accountDetailsHref"
                class="v-header-profile-pwa__overlay-avatar-btn"
                aria-label="Change account photo"
              >
                <Avatar class="v-header-profile-pwa__overlay-avatar size-8">
                  <AvatarImage
                    :src="avatarSrc"
                    alt="avatar image"
                  />
                  <AvatarFallback>{{ avatarInitial }}</AvatarFallback>
                </Avatar>
                <span class="v-header-profile-pwa__overlay-avatar-action">
                  Change account photo
                </span>
              </a>
              <Avatar
                v-else
                class="v-header-profile-pwa__overlay-avatar size-8"
              >
                <AvatarImage
                  :src="avatarSrc"
                  alt="avatar image"
                />
                <AvatarFallback>{{ avatarInitial }}</AvatarFallback>
              </Avatar>
              <div class="v-header-profile-pwa__overlay-email is--h6__title">
                {{ email }}
              </div>
              <Button
                v-if="accountDetailsHref"
                as="a"
                :href="accountDetailsHref"
                class="v-header-profile-pwa__overlay-link"
                variant="link"
                size="sm"
              >
                Account Details
              </Button>
            </div>
          </section>

          <section class="v-header-profile-pwa__overlay-section">
            <button
              type="button"
              class="v-header-profile-pwa__overlay-switch-trigger"
              @click="emit('switch-profile-open')"
            >
              <span class="v-header-profile-pwa__overlay-switch-text is--h6__title">
                Switch profile
              </span>
              <ArrowRight
                class="v-header-profile-pwa__overlay-switch-chevron"
                aria-hidden="true"
              />
            </button>
          </section>

          <section
            class="v-header-profile-pwa__overlay-section"
          >
            <div
              v-for="group in overlayGroups"
              :key="group.id"
              class="v-header-profile-pwa__overlay-group"
              :class="group.sectionClassName"
              :aria-label="group.ariaLabel"
            >
              <template
                v-for="item in group.items"
                :key="item.id"
              >
                <a
                  v-if="item.type === 'link'"
                  :href="item.href"
                  class="v-header-profile-pwa__overlay-item"
                  :class="item.className"
                >
                  <span class="v-header-profile-pwa__overlay-icon-box">
                    <component
                      :is="item.icon"
                      class="v-header-profile-pwa__overlay-icon"
                      aria-hidden="true"
                    />
                  </span>
                  <span class="v-header-profile-pwa__overlay-item-label is--h6__title">
                    {{ item.label }}
                  </span>
                  <ArrowRight
                    class="v-header-profile-pwa__overlay-chevron"
                    aria-hidden="true"
                  />
                </a>
                <button
                  v-else
                  type="button"
                  class="v-header-profile-pwa__overlay-item"
                  :class="item.className"
                  @click="onOverlayItemClick(item)"
                >
                  <span class="v-header-profile-pwa__overlay-icon-box">
                    <component
                      :is="item.icon"
                      class="v-header-profile-pwa__overlay-icon"
                      aria-hidden="true"
                    />
                  </span>
                  <span class="v-header-profile-pwa__overlay-item-label is--h6__title">
                    {{ item.label }}
                  </span>
                  <ArrowRight
                    class="v-header-profile-pwa__overlay-chevron"
                    aria-hidden="true"
                  />
                </button>
              </template>
            </div>
          </section>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style lang="scss">
.v-header-profile-pwa {
  &__overlay {
    position: fixed;
    inset: 0;
    z-index: 2000;
    display: flex;
    flex-direction: column;
    align-items: stretch;
    justify-content: flex-start;
    background: var(--background);
    padding: 0;
  }

  &__overlay-header {
    min-height: 64px;
    display: flex;
    align-items: center;
    padding: 0 16px;
    background: var(--background);
    box-shadow: 0 2px 5px 1px rgb(18 22 31 / 3%), 0 2px 3px -2px rgb(18 22 31 / 15%);
    position: relative;
    z-index: 1;
  }

  &__overlay-body {
    flex: 1;
    overflow: auto;
    background: var(--background);
  }

  &__overlay-content {
    display: flex;
    flex-direction: column;
    min-height: calc(100vh - 64px);
    padding-bottom: 32px;
  }

  &__overlay-close {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border: none;
    border-radius: 16px;
    background: transparent;
    color: #343A40;
    font-size: 22px;
    line-height: 1;
    cursor: pointer;
    padding: 0;
  }

  &__overlay-avatar {
    margin-bottom: 0;
  }

  &__overlay-avatar-btn {
    display: inline-flex;
    align-items: center;
    flex-direction: column;
    gap: 6px;
    padding: 0;
    background: transparent;
    color: var(--primary);
    cursor: pointer;
    text-decoration: none;

    &:focus-visible {
      outline: 2px solid var(--primary);
      outline-offset: 4px;
    }
  }

  &__overlay-avatar-action {
    font-size: 12px;
  }

  &__overlay-profile-panel {
    display: flex;
    justify-content: center;
    padding: 24px;
    background: var(--muted);
  }

  &__overlay-profile {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    width: 100%;
    max-width: 320px;
    text-align: center;
  }

  &__overlay-email {
    overflow-wrap: anywhere;
  }

  &__overlay-link {
    margin-top: 4px;
  }

  &__overlay-section {
    width: 100%;
    padding: 5px 0;
  }

  &__overlay-switch-trigger {
    display: flex;
    align-items: center;
    gap: 8px;
    width: calc(100% - 32px);
    margin: 0 16px;
    border: 1px solid var(--border);
    border-radius: 2px;
    background: var(--muted);
    padding: 12px 14px;
    color: var(--foreground);
    cursor: pointer;
    text-align: left;
  }

  &__overlay-switch-text {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__overlay-switch-chevron {
    margin-left: auto;
    width: 18px;
    height: 18px;
    color: var(--muted-foreground);
    flex-shrink: 0;
  }

  &__overlay-group {
    padding: 20px 12px;
    display: flex;
    flex-direction: column;
    gap: 20px;
    border-top: 1px solid var(--border);

    &:first-of-type {
      border-top: none;
    }
  }

  &__overlay-item {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 8px 12px;
    color: var(--foreground);
    cursor: pointer;
    text-decoration: none;
  }

  &__overlay-icon-box {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border: 1px solid var(--border);
    border-radius: 4px;
    background: var(--background);
    color: #343A40;
    flex-shrink: 0;
  }

  &__overlay-icon {
    width: 16px;
    height: 16px;
  }

  &__overlay-chevron {
    margin-left: auto;
    width: 18px;
    height: 18px;
    color: var(--muted-foreground);
    flex-shrink: 0;
    margin-right: 4px;
  }
}
</style>
