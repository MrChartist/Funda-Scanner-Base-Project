// src/lib/sample/names.ts — invented company names and symbols for the synthetic sample (§F.4).
// Every stem below is an invented syllable combination, reviewed by hand so that it is not a
// well-known Indian company, group or brand. A test checks every generated name and symbol
// against src/test/fixtures/sample/real-name-denylist.ts. An unlisted private company could
// still share a name by chance; the "(fictional)" label and the synthetic flag cover that case.

/** Invented stems, used in roster order (company k gets STEMS[k]). Append only. */
export const STEMS: readonly string[] = [
  "Varnex", "Quelora", "Talith", "Moruvan", "Zeneth", "Kelyra", "Dravik", "Pelulon", "Sovondo", "Vexari",
  "Noravel", "Fuldor", "Brinesk", "Calure", "Devane", "Eklovin", "Fenimba", "Gorix", "Halamar", "Jorora",
  "Kavith", "Lumuvan", "Mireth", "Nevyra", "Praulon", "Qirondo", "Rovtro", "Toravel", "Ulvdor", "Wenure",
  "Yarane", "Zorovin", "Ashimba", "Coramar", "Dunnex", "Elvora", "Falith", "Gavuvan", "Heseth", "Ivryra",
  "Jalvik", "Korulon", "Lirondo", "Mavtro", "Varesk", "Quelure", "Talane", "Morovin", "Zenimba", "Kelix",
  "Pelnex", "Sovora", "Tirith", "Vexuvan", "Noreth", "Fulyra", "Brinvik", "Calulon", "Devondo", "Fenari",
  "Goravel", "Haldor", "Iskesk", "Jorure", "Kavane", "Lumovin", "Mirimba", "Nevix", "Orvamar", "Qirora",
  "Rovith", "Seluvan", "Toreth", "Ulvyra", "Velvik", "Wenulon", "Yarondo", "Zortro", "Ashari", "Belavel",
  "Cordor", "Dunesk", "Elvure", "Falane", "Gavovin", "Hesimba", "Ivrix", "Jalamar", "Lirora", "Mavith",
  "Varvik", "Quelulon", "Talondo", "Mortro", "Kelavel", "Drador", "Pelesk", "Sovure", "Tirane", "Vexovin",
  "Norimba", "Brinamar", "Eklith", "Fenuvan", "Goreth", "Halyra", "Iskvik", "Jorulon", "Kavondo", "Lumtro",
  "Mirari", "Nevavel", "Orvdor", "Praesk", "Qirure", "Rovane", "Selovin", "Torimba", "Ulvix", "Velamar",
  "Yarora", "Zorith", "Ashuvan", "Beleth", "Dunvik", "Elvulon", "Falondo", "Gavtro", "Hesari", "Ivravel",
  "Jaldor", "Koresk", "Lirure", "Mavane", "Varamar", "Talora", "Morith", "Zenuvan", "Keleth", "Drayra",
  "Pelvik", "Sovulon", "Tirondo", "Vextro", "Norari", "Fulavel", "Brindor", "Calesk", "Devure", "Eklane",
  "Fenovin", "Gorimba", "Iskamar", "Jornex", "Kavora", "Lumith", "Miruvan", "Neveth", "Orvyra", "Pravik",
  "Qirulon", "Rovondo", "Seltro", "Torari", "Ulvavel", "Veldor", "Wenesk", "Yarure", "Zorane",
];

/** A sector noun and the letters it adds to a symbol. */
export interface NounSpec {
  noun: string;
  code: string;
}

/** Builds "Varnex Polymers Ltd" from a stem and a sector noun. */
export function companyName(stem: string, noun: NounSpec): string {
  return `${stem} ${noun.noun} Ltd`;
}

/**
 * Builds an invented upper-case symbol of 5–10 letters: the first six letters of the stem plus
 * the noun code, cut to 10 letters.
 */
export function companySymbol(stem: string, noun: NounSpec): string {
  const letters = stem.toUpperCase().replace(/[^A-Z]/g, "");
  return (letters.slice(0, 6) + noun.code).slice(0, 10);
}

/** Zero-padded number used by the stress set: 7 → "0007" (wider when the count needs it). */
export function stressNumber(k: number, count: number): string {
  const width = Math.max(4, String(count).length);
  return String(k).padStart(width, "0");
}

/** Stress-set symbol, e.g. "SYN0001". */
export function stressSymbol(k: number, count: number): string {
  return `SYN${stressNumber(k, count)}`;
}

/** Stress-set name, e.g. "Synthetic Company 0001 (stress test)". */
export function stressName(k: number, count: number): string {
  return `Synthetic Company ${stressNumber(k, count)} (stress test)`;
}
