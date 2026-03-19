export function numberWithCommas(x: number | string): string {
  const value = String(x);
  const isNegative = value.startsWith('-');
  const unsigned = isNegative ? value.slice(1) : value;
  const [integerPart, fractionalPart] = unsigned.split('.');
  const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');

  const result =
    fractionalPart !== undefined ? `${formattedInteger}.${fractionalPart}` : formattedInteger;
  return isNegative ? `-${result}` : result;
}
