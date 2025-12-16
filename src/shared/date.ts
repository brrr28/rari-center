export function getFromQuery(key: string): string {
  const p = new URLSearchParams(window.location.search);
  return p.get(key) || "";
}

export function getPsyIdFromQuery(): string {
  return getFromQuery("psyId") || getFromQuery("psy_id");
}

export function isoUtcNowPlus4hours(): string {
  const d = new Date();
  d.setUTCHours(d.getUTCHours() + 6);
  return d.toISOString();
}

export function isoUtcPlusDays(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString();
}
