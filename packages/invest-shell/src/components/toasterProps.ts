// Props for the app Toaster from @global-torque/ui-primitives/sonner: <Toaster v-bind="toasterProps" />.
// Sonner's --error-border shares its name with the token, so the error border reads --destructive.
// The wrapper's --gray2 (close button hover) is invalid with full-color tokens, so it reads --accent.
export const toasterProps = {
  position: 'top-right',
  closeButton: true,
  closeButtonPosition: 'top-right',
  richColors: true,
  style: {
    '--success-bg': 'var(--positive-background)',
    '--success-border': 'var(--success)',
    '--success-text': 'var(--foreground)',
    '--info-bg': 'var(--popover)',
    '--info-border': 'var(--border)',
    '--info-text': 'var(--popover-foreground)',
    '--warning-bg': 'var(--warning-background)',
    '--warning-border': 'var(--warning)',
    '--warning-text': 'var(--foreground)',
    '--error-bg': 'var(--error-background)',
    '--error-border': 'var(--destructive)',
    '--error-text': 'var(--error-foreground)',
    '--gray2': 'var(--accent)',
    'fontFamily': 'inherit',
  },
  toastOptions: {
    style: { alignItems: 'flex-start' },
    classes: { icon: 'mt-0.5' },
  },
} as const;
