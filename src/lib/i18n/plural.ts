/** Russian plural form: 1 трек, 2 трека, 5 треков, 21 трек, 11 треков. */
export function pluralRu(count: number, one: string, few: string, many: string): string {
  const n = Math.abs(Math.trunc(count));
  const lastTwo = n % 100;
  const last = n % 10;
  if (lastTwo >= 11 && lastTwo <= 14) return many;
  if (last === 1) return one;
  if (last >= 2 && last <= 4) return few;
  return many;
}
