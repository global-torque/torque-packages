import type { Component } from 'vue';

export type MenuItem = {
  name?: string;
  href?: string;
  to?: string;
  text: string;
  children?: MenuItem[];
  link?: string;
  active?: boolean;
  class?: string;
  icon?: Component;
};
