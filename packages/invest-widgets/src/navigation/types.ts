export interface IBreadcrumb {
  text: string;
  href?: string;
  to?: string | object;
}

export interface IBreadcrumbCollapsed extends IBreadcrumb {
  ellipsis?: boolean;
}
export interface IBreadcrumbDropdown extends IBreadcrumb {
  dropdown?: boolean;
}
