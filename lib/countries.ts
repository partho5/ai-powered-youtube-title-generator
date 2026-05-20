export type Country = {
  code: string; // ISO 3166-1 alpha-2 (used for gl, regionCode)
  name: string;
  defaultLang: string; // ISO 639-1 (used for hl, relevanceLanguage)
};

export const COUNTRIES: Country[] = [
  { code: "US", name: "United States", defaultLang: "en" },
  { code: "GB", name: "United Kingdom", defaultLang: "en" },
  { code: "CA", name: "Canada", defaultLang: "en" },
  { code: "AU", name: "Australia", defaultLang: "en" },
  { code: "IN", name: "India", defaultLang: "en" },
  { code: "DE", name: "Germany", defaultLang: "de" },
  { code: "FR", name: "France", defaultLang: "fr" },
  { code: "ES", name: "Spain", defaultLang: "es" },
  { code: "IT", name: "Italy", defaultLang: "it" },
  { code: "BR", name: "Brazil", defaultLang: "pt" },
  { code: "MX", name: "Mexico", defaultLang: "es" },
  { code: "JP", name: "Japan", defaultLang: "ja" },
  { code: "KR", name: "South Korea", defaultLang: "ko" },
  { code: "ID", name: "Indonesia", defaultLang: "id" },
  { code: "PH", name: "Philippines", defaultLang: "en" },
  { code: "NL", name: "Netherlands", defaultLang: "nl" },
  { code: "PL", name: "Poland", defaultLang: "pl" },
  { code: "TR", name: "Turkey", defaultLang: "tr" },
  { code: "BD", name: "Bangladesh", defaultLang: "bn" },
  { code: "PK", name: "Pakistan", defaultLang: "en" },
];

export function findCountry(code: string): Country {
  return COUNTRIES.find((c) => c.code === code.toUpperCase()) ?? COUNTRIES[0];
}
