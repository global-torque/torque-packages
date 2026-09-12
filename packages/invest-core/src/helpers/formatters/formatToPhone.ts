export function formatPhoneNumber(input: string | number): string {
  const digits = input.toString().replace(/\D/g, '');

  if (digits.length !== 11 || !digits.startsWith('1')) {
    return '';
  }

  const areaCode = digits.slice(1, 4);
  const centralOfficeCode = digits.slice(4, 7);
  const lineNumber = digits.slice(7, 11);

  return `+1 (${areaCode}) ${centralOfficeCode} - ${lineNumber}`;
}
