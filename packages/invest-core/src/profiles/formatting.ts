import { formatToShortMonthDateYear } from '../formatting/dateTime.ts';

export const formatProfileDateToShortMonthDateYear = formatToShortMonthDateYear;

export function formatProfileUserPhoneNumber(input: string | number): string | undefined {
  const digits = input.toString().replace(/\D/g, '');

  if (digits.length !== 11 || !digits.startsWith('1')) {
    return undefined;
  }

  const areaCode = digits.slice(1, 4);
  const centralOfficeCode = digits.slice(4, 7);
  const lineNumber = digits.slice(7, 11);

  return `+1 (${areaCode}) ${centralOfficeCode} - ${lineNumber}`;
}

export function formatProfilePhoneNumberForDisplay(
  input?: string | number | null,
): string | undefined {
  if (input === undefined || input === null || input === '') return undefined;

  const cleaned = String(input).replace(/\D/g, '');
  let countryCode = '';
  let number = cleaned;

  if (cleaned.length > 10) {
    countryCode = `+${cleaned.slice(0, cleaned.length - 10)} `;
    number = cleaned.slice(-10);
  }

  const areaCode = number.slice(0, 3);
  const middlePart = number.slice(3, 6);
  const lastPart = number.slice(6);

  return `${countryCode}(${areaCode}) ${middlePart}-${lastPart}`;
}
