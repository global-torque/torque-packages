<script setup lang="ts">
import { computed, type PropType } from 'vue';
import { UserIcon as userIcon } from '@lucide/vue';
import { navigateWithQueryParams } from '@global-torque/invest-runtime/navigation';

const props = defineProps({
  urlProfile: {
    type: [String, Function] as PropType<string | (() => string)>,
    default: '',
  },
  userLoggedIn: {
    type: Boolean,
    default: false,
  },
});

const profileHref = computed(() => {
  if (typeof props.urlProfile === 'function') {
    try {
      return props.urlProfile();
    } catch (error) {
      console.error('[VMenuProfileLink] Failed to resolve urlProfile()', error);
      return '';
    }
  }
  return props.urlProfile ?? '';
});

function handleClick() {
  if (!profileHref.value) {
    return;
  }
  navigateWithQueryParams(profileHref.value);
}

</script>

<template>
  <component
    :is="userIcon"
    v-if="userLoggedIn && profileHref"
    class="VMenuProfileLink v-menu-profile"
    @click="handleClick"
  />
</template>

<style lang="scss">
$z-index-menu-bg: 99;
$z-index-menu: 999;
$z-index-menu-profile: $z-index-menu + 1;

.v-menu-profile {
  z-index: $z-index-menu-profile;
  color: var(--foreground);
  cursor: pointer;
  transition: color 0.3s;
  width: 24px;
  height: 24px;
}
</style>
