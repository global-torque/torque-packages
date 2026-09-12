<script setup lang="ts">
import { Button } from '@global-torque/ui-primitives/button';
import type { Component } from 'vue';

export type AuthSocialProvider = 'google' | 'github' | 'linkedin';
export type AuthSocialIcons = Readonly<Record<AuthSocialProvider, Readonly<{
  icon: Component;
  iconHover: Component;
}>>>;

const props = defineProps<{
  socialIcons: AuthSocialIcons;
}>();

const emit = defineEmits<{(e: 'click', provider: string): void;
}>();

const socialSignin = [
  {
    provider: 'google',
    label: 'Google',
    classes: 'login-social-google',
  },
  // {
  //   icon: FacebookIcon,
  //   iconHover: FacebookHoverIcon,
  //   provider: 'facebook',
  //   classes: 'login-social-facebook',
  // },
  {
    provider: 'github',
    label: 'GitHub',
    classes: 'login-social-github',
  },
  {
    provider: 'linkedin',
    label: 'LinkedIn',
    classes: 'login-social-linkedin',
  },
] as const;
</script>

<template>
  <div class="VFormAuthSocial social-form">
    <Button
      v-for="item in socialSignin"
      :key="item.provider"
      type="button"
      class="social-form__item bg-accent"
      :class="item.classes"
      :aria-label="`Continue with ${item.label}`"
      @click.stop.prevent="emit('click', item.provider)"
      variant="ghost"
      size="lg"
    >
      <template v-if="props.socialIcons?.[item.provider]?.icon && props.socialIcons?.[item.provider]?.iconHover">
        <component
          :is="props.socialIcons[item.provider].icon"
          class="social-form__item-icon"
          aria-hidden="true"
        />
        <component
          :is="props.socialIcons[item.provider].iconHover"
          class="social-form__item-icon-hover"
          aria-hidden="true"
        />
      </template>
      <span
        v-else
        class="social-form__item-label"
      >
        {{ item.label }}
      </span>
    </Button>
  </div>
</template>

<style lang="scss">
.social-form {
  display: flex;
  justify-content: center;
  align-items: flex-start;
  gap: 40px;
  align-self: stretch;
  width: 100%;

  &__item-icon,
  &__item-icon-hover {
    width: var(--ui-social-auth-icon-size, 20px);
    height: var(--ui-social-auth-icon-size, 20px);
    transition: all 0.3s ease;
  }

  &__item-label {
    color: inherit;
  }

  &__item-icon-hover {
    display: none;
  }

  &__item {
    @media screen and (width > 768px){
      flex: 1 1 auto;
    }

    &:hover {
      .social-form__item-icon {
        display: none;
      }

      .social-form__item-icon-hover {
        display: block;
      }
    }
  }
}
</style>
