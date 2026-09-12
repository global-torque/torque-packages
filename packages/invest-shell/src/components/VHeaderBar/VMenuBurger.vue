<script setup lang="ts">
import { MenuIcon, XIcon } from '@lucide/vue';

const modelValue = defineModel<boolean>();
defineEmits(['update:modelValue']);
</script>

<template>
  <component
    :is="modelValue ? XIcon : MenuIcon"
    class="VMenuBurger v-menu-burger"
  />
</template>

<style lang="scss">
$z-index-menu-bg: 99;
$z-index-menu: 999;
$z-index-menu-burger: $z-index-menu + 1;

.v-menu-burger {
  z-index: $z-index-menu-burger;
  color: var(--foreground);
  cursor: pointer;
  transition: color 0.3s;
  width: 24px;
  height: 24px;
}
</style>
