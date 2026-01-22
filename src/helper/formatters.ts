/**
 * Formats a number or string with comma separators for thousands.
 * @param x - The number or string to format
 * @returns The formatted string with commas (e.g., "1,000" or "1,234,567")
 * @example
 * numberWithCommas(1000)
 * numberWithCommas("1234567")
 */
export function numberWithCommas(x: number | string): string {
  return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}