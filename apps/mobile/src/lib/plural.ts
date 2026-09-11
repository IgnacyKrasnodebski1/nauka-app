/** Polska liczba mnoga: pl(1, "temat", "tematy", "tematów") → "1 temat"; pl(5, …) → "5 tematów". */
export function pl(n: number, one: string, few: string, many: string, withNumber = true): string {
  const a = Math.abs(n) % 100;
  const b = a % 10;
  const w = n === 1 ? one : a > 10 && a < 20 ? many : b >= 2 && b <= 4 ? few : many;
  return withNumber ? `${n} ${w}` : w;
}
export const dni = (n: number) => pl(n, "dzień", "dni", "dni", false);
