const BASE_OPTIONS = {
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
} as const;

const HOURS_OPTIONS = {
  ...BASE_OPTIONS,
  hour: 'numeric',
  minute: 'numeric',
} as const;

const ONLY_HOURS_OPTIONS = {
  hour: 'numeric',
  minute: 'numeric',
} as const;

export const formatToDate = (ISOString: string, withHours = false) => (
  new Intl.DateTimeFormat('en-US', withHours ? HOURS_OPTIONS : BASE_OPTIONS)
    .format(new Date(ISOString))
);

export const formatToFullDate = (ISOString: string) => (
  new Intl.DateTimeFormat('en-US', BASE_OPTIONS)
    .format(new Date(ISOString))
);

export const formatToTime = (ISOString: string) => (
  new Intl.DateTimeFormat('en-US', ONLY_HOURS_OPTIONS)
    .format(new Date(ISOString))
);

export const formatToShortMonth = (ISOString: string) => (
  new Intl.DateTimeFormat('en-US', { month: 'short' }).format(new Date(ISOString))
);

export function formatDateToShortMonthDateYear(dateInput: Date | string): string {
  const date = new Date(dateInput);
  const options: Intl.DateTimeFormatOptions = {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  };

  const formatted = date.toLocaleDateString('en-US', options);
  return formatted.replace(/^[A-Z]/, (m) => m); // lowercase the first letter of the month
}
