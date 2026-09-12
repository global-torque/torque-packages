export function numberFormatter(value: number | string) {
  return +value.toString().replace(/[^0-9.]/g, '');
}

