const FULL_DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
});

const SHORT_MONTH_DATE_YEAR_FORMATTER = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

export type DateTimeInput = Date | string;

const toDate = (value: DateTimeInput): Date => (
  value instanceof Date ? value : new Date(value)
);

export const formatToFullDate = (
  value?: DateTimeInput | null,
  fallback = '-',
): string => {
  if (!value) return fallback;

  const date = toDate(value);
  if (Number.isNaN(date.getTime())) return fallback;

  return FULL_DATE_FORMATTER.format(date);
};

export const formatToShortMonthDateYear = (value: DateTimeInput): string => (
  SHORT_MONTH_DATE_YEAR_FORMATTER
    .format(toDate(value))
    .replace(/^[A-Z]/, (match) => match)
);

export const formatLocalHoursMinutes = (value: DateTimeInput): string => {
  const date = toDate(value);
  const hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, '0');

  return `${hours}:${minutes}`;
};
