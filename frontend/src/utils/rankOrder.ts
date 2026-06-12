// Dienstgrad-Reihenfolge: Index 0 = höchster Rang
export const RANK_ORDER = [
  'LBD',
  'LBDSTV',
  'BR',
  'OBR',
  'ABI',
  'HBI',
  'OBI',
  'BI',
  'HV',
  'OV',
  'V',
  'HBM',
  'OBM',
  'BM',
  'HLM',
  'OLM',
  'LM',
  'HFM',
  'OFM',
  'FM',
  'PFM',
];

// Extrahiert das Kürzel aus "BM: Brandmeister" → "BM"
export function getRankCode(rank: string | null | undefined): string {
  if (!rank) return '';
  return rank.split(':')[0].trim().toUpperCase();
}

export function getRankIndex(rank: string | null | undefined): number {
  const code = getRankCode(rank);
  const idx = RANK_ORDER.indexOf(code);
  return idx === -1 ? 999 : idx; // Unbekannte Ränge ans Ende
}

// Sortiert ein Array von Objekten nach Dienstgrad (höchster zuerst)
export function sortByRank<T extends { rank?: string | null }>(arr: T[]): T[] {
  return [...arr].sort((a, b) => getRankIndex(a.rank) - getRankIndex(b.rank));
}
