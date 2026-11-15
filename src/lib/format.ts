/** Accent- and case-insensitive key: "Dëshmorët" ~ "deshmoret", "Çerdhja" ~ "cerdhja". */
export const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/["“”'’.]/g, '')
    .toLowerCase()
    .trim();

export function etaParts(sec: number): { value: string; unit: string; due: boolean } {
  if (sec < 45) return { value: 'Due', unit: '', due: true };
  const m = Math.round(sec / 60);
  return { value: String(Math.max(1, m)), unit: 'min', due: false };
}

export const clock = (unixSec: number) =>
  new Date(unixSec * 1000).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

/** Station names from OSM carry inconsistent quoting; tidy for display. */
export const tidy = (s: string) => s.replace(/"([^"]+)"/g, '“$1”').replace(/\s+/g, ' ');
