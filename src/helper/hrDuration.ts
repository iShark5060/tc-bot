export function formatHrDuration(startHr: bigint): string {
  const ns = Number(process.hrtime.bigint() - startHr);
  return `${(ns / 1e6).toFixed(3)}ms`;
}
