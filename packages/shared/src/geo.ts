/**
 * Données géographiques de référence (partagées web + mobile).
 * - Pays du monde entier (ISO 3166-1 alpha-2) : code, nom FR/EN, continent.
 * - Helpers : drapeau, continent par code, recherche de pays.
 * Les villes ne sont volontairement PAS embarquées ici (millions d'entrées) :
 * elles sont cherchées à la volée via le géocodage Mapbox (voir
 * `geocodeCityWithCountry` / `suggestCities` dans le client), ce qui couvre
 * le monde entier avec une fraîcheur permanente.
 */

export type Continent = 'AF' | 'AS' | 'EU' | 'NA' | 'SA' | 'OC' | 'AN'

export interface CountryInfo {
  /** Code ISO 3166-1 alpha-2 (FR, NG, BJ…). */
  code: string
  /** Nom français (France, Nigéria, Bénin…). */
  fr: string
  /** Nom anglais (France, Nigeria, Benin…). */
  en: string
  /** Continent (code ISO 3166-1 alpha-2 du continent). */
  continent: Continent
}

export const CONTINENT_NAMES: Record<Continent, { fr: string; en: string }> = {
  AF: { fr: 'Afrique', en: 'Africa' },
  AS: { fr: 'Asie', en: 'Asia' },
  EU: { fr: 'Europe', en: 'Europe' },
  NA: { fr: 'Amérique du Nord', en: 'North America' },
  SA: { fr: 'Amérique du Sud', en: 'South America' },
  OC: { fr: 'Océanie', en: 'Oceania' },
  AN: { fr: 'Antarctique', en: 'Antarctica' },
}

/**
 * Pays du monde (ISO 3166-1 alpha-2). Liste exhaustive des États souverains
 * reconnus par l'ONU + territoires fréquemment utilisés (métropoles,
 * départements d'outre-mer, dépendances notables).
 */
export const COUNTRIES: CountryInfo[] = [
  { code: 'AF', fr: 'Afghanistan', en: 'Afghanistan', continent: 'AS' },
  { code: 'AL', fr: 'Albanie', en: 'Albania', continent: 'EU' },
  { code: 'DZ', fr: 'Algérie', en: 'Algeria', continent: 'AF' },
  { code: 'AD', fr: 'Andorre', en: 'Andorra', continent: 'EU' },
  { code: 'AO', fr: 'Angola', en: 'Angola', continent: 'AF' },
  { code: 'AG', fr: 'Antigua-et-Barbuda', en: 'Antigua and Barbuda', continent: 'NA' },
  { code: 'AR', fr: 'Argentine', en: 'Argentina', continent: 'SA' },
  { code: 'AM', fr: 'Arménie', en: 'Armenia', continent: 'AS' },
  { code: 'AU', fr: 'Australie', en: 'Australia', continent: 'OC' },
  { code: 'AT', fr: 'Autriche', en: 'Austria', continent: 'EU' },
  { code: 'AZ', fr: 'Azerbaïdjan', en: 'Azerbaijan', continent: 'AS' },
  { code: 'BS', fr: 'Bahamas', en: 'Bahamas', continent: 'NA' },
  { code: 'BH', fr: 'Bahreïn', en: 'Bahrain', continent: 'AS' },
  { code: 'BD', fr: 'Bangladesh', en: 'Bangladesh', continent: 'AS' },
  { code: 'BB', fr: 'Barbade', en: 'Barbados', continent: 'NA' },
  { code: 'BY', fr: 'Biélorussie', en: 'Belarus', continent: 'EU' },
  { code: 'BE', fr: 'Belgique', en: 'Belgium', continent: 'EU' },
  { code: 'BZ', fr: 'Belize', en: 'Belize', continent: 'NA' },
  { code: 'BJ', fr: 'Bénin', en: 'Benin', continent: 'AF' },
  { code: 'BT', fr: 'Bhoutan', en: 'Bhutan', continent: 'AS' },
  { code: 'BO', fr: 'Bolivie', en: 'Bolivia', continent: 'SA' },
  { code: 'BA', fr: 'Bosnie-Herzégovine', en: 'Bosnia and Herzegovina', continent: 'EU' },
  { code: 'BW', fr: 'Botswana', en: 'Botswana', continent: 'AF' },
  { code: 'BR', fr: 'Brésil', en: 'Brazil', continent: 'SA' },
  { code: 'BN', fr: 'Brunei', en: 'Brunei', continent: 'AS' },
  { code: 'BG', fr: 'Bulgarie', en: 'Bulgaria', continent: 'EU' },
  { code: 'BF', fr: 'Burkina Faso', en: 'Burkina Faso', continent: 'AF' },
  { code: 'BI', fr: 'Burundi', en: 'Burundi', continent: 'AF' },
  { code: 'CV', fr: 'Cap-Vert', en: 'Cape Verde', continent: 'AF' },
  { code: 'KH', fr: 'Cambodge', en: 'Cambodia', continent: 'AS' },
  { code: 'CM', fr: 'Cameroun', en: 'Cameroon', continent: 'AF' },
  { code: 'CA', fr: 'Canada', en: 'Canada', continent: 'NA' },
  { code: 'CF', fr: 'République centrafricaine', en: 'Central African Republic', continent: 'AF' },
  { code: 'TD', fr: 'Tchad', en: 'Chad', continent: 'AF' },
  { code: 'CL', fr: 'Chili', en: 'Chile', continent: 'SA' },
  { code: 'CN', fr: 'Chine', en: 'China', continent: 'AS' },
  { code: 'CO', fr: 'Colombie', en: 'Colombia', continent: 'SA' },
  { code: 'KM', fr: 'Comores', en: 'Comoros', continent: 'AF' },
  { code: 'CG', fr: 'République du Congo', en: 'Republic of the Congo', continent: 'AF' },
  { code: 'CD', fr: 'République démocratique du Congo', en: 'Democratic Republic of the Congo', continent: 'AF' },
  { code: 'CR', fr: 'Costa Rica', en: 'Costa Rica', continent: 'NA' },
  { code: 'CI', fr: "Côte d'Ivoire", en: "Ivory Coast", continent: 'AF' },
  { code: 'HR', fr: 'Croatie', en: 'Croatia', continent: 'EU' },
  { code: 'CU', fr: 'Cuba', en: 'Cuba', continent: 'NA' },
  { code: 'CY', fr: 'Chypre', en: 'Cyprus', continent: 'AS' },
  { code: 'CZ', fr: 'Tchéquie', en: 'Czechia', continent: 'EU' },
  { code: 'DK', fr: 'Danemark', en: 'Denmark', continent: 'EU' },
  { code: 'DJ', fr: 'Djibouti', en: 'Djibouti', continent: 'AF' },
  { code: 'DM', fr: 'Dominique', en: 'Dominica', continent: 'NA' },
  { code: 'DO', fr: 'République dominicaine', en: 'Dominican Republic', continent: 'NA' },
  { code: 'TL', fr: 'Timor oriental', en: 'East Timor', continent: 'AS' },
  { code: 'EC', fr: 'Équateur', en: 'Ecuador', continent: 'SA' },
  { code: 'EG', fr: 'Égypte', en: 'Egypt', continent: 'AF' },
  { code: 'SV', fr: 'Salvador', en: 'El Salvador', continent: 'NA' },
  { code: 'GQ', fr: 'Guinée équatoriale', en: 'Equatorial Guinea', continent: 'AF' },
  { code: 'ER', fr: 'Érythrée', en: 'Eritrea', continent: 'AF' },
  { code: 'EE', fr: 'Estonie', en: 'Estonia', continent: 'EU' },
  { code: 'SZ', fr: 'Eswatini', en: 'Eswatini', continent: 'AF' },
  { code: 'ET', fr: 'Éthiopie', en: 'Ethiopia', continent: 'AF' },
  { code: 'FJ', fr: 'Fidji', en: 'Fiji', continent: 'OC' },
  { code: 'FI', fr: 'Finlande', en: 'Finland', continent: 'EU' },
  { code: 'FR', fr: 'France', en: 'France', continent: 'EU' },
  { code: 'GA', fr: 'Gabon', en: 'Gabon', continent: 'AF' },
  { code: 'GM', fr: 'Gambie', en: 'Gambia', continent: 'AF' },
  { code: 'GE', fr: 'Géorgie', en: 'Georgia', continent: 'AS' },
  { code: 'DE', fr: 'Allemagne', en: 'Germany', continent: 'EU' },
  { code: 'GH', fr: 'Ghana', en: 'Ghana', continent: 'AF' },
  { code: 'GR', fr: 'Grèce', en: 'Greece', continent: 'EU' },
  { code: 'GD', fr: 'Grenade', en: 'Grenada', continent: 'NA' },
  { code: 'GT', fr: 'Guatemala', en: 'Guatemala', continent: 'NA' },
  { code: 'GN', fr: 'Guinée', en: 'Guinea', continent: 'AF' },
  { code: 'GW', fr: 'Guinée-Bissau', en: 'Guinea-Bissau', continent: 'AF' },
  { code: 'GY', fr: 'Guyana', en: 'Guyana', continent: 'SA' },
  { code: 'HT', fr: 'Haïti', en: 'Haiti', continent: 'NA' },
  { code: 'HN', fr: 'Honduras', en: 'Honduras', continent: 'NA' },
  { code: 'HU', fr: 'Hongrie', en: 'Hungary', continent: 'EU' },
  { code: 'IS', fr: 'Islande', en: 'Iceland', continent: 'EU' },
  { code: 'IN', fr: 'Inde', en: 'India', continent: 'AS' },
  { code: 'ID', fr: 'Indonésie', en: 'Indonesia', continent: 'AS' },
  { code: 'IR', fr: 'Iran', en: 'Iran', continent: 'AS' },
  { code: 'IQ', fr: 'Irak', en: 'Iraq', continent: 'AS' },
  { code: 'IE', fr: 'Irlande', en: 'Ireland', continent: 'EU' },
  { code: 'IL', fr: 'Israël', en: 'Israel', continent: 'AS' },
  { code: 'IT', fr: 'Italie', en: 'Italy', continent: 'EU' },
  { code: 'JM', fr: 'Jamaïque', en: 'Jamaica', continent: 'NA' },
  { code: 'JP', fr: 'Japon', en: 'Japan', continent: 'AS' },
  { code: 'JO', fr: 'Jordanie', en: 'Jordan', continent: 'AS' },
  { code: 'KZ', fr: 'Kazakhstan', en: 'Kazakhstan', continent: 'AS' },
  { code: 'KE', fr: 'Kenya', en: 'Kenya', continent: 'AF' },
  { code: 'KI', fr: 'Kiribati', en: 'Kiribati', continent: 'OC' },
  { code: 'KW', fr: 'Koweït', en: 'Kuwait', continent: 'AS' },
  { code: 'KG', fr: 'Kirghizistan', en: 'Kyrgyzstan', continent: 'AS' },
  { code: 'LA', fr: 'Laos', en: 'Laos', continent: 'AS' },
  { code: 'LV', fr: 'Lettonie', en: 'Latvia', continent: 'EU' },
  { code: 'LB', fr: 'Liban', en: 'Lebanon', continent: 'AS' },
  { code: 'LS', fr: 'Lesotho', en: 'Lesotho', continent: 'AF' },
  { code: 'LR', fr: 'Liberia', en: 'Liberia', continent: 'AF' },
  { code: 'LY', fr: 'Libye', en: 'Libya', continent: 'AF' },
  { code: 'LI', fr: 'Liechtenstein', en: 'Liechtenstein', continent: 'EU' },
  { code: 'LT', fr: 'Lituanie', en: 'Lithuania', continent: 'EU' },
  { code: 'LU', fr: 'Luxembourg', en: 'Luxembourg', continent: 'EU' },
  { code: 'MG', fr: 'Madagascar', en: 'Madagascar', continent: 'AF' },
  { code: 'MW', fr: 'Malawi', en: 'Malawi', continent: 'AF' },
  { code: 'MY', fr: 'Malaisie', en: 'Malaysia', continent: 'AS' },
  { code: 'MV', fr: 'Maldives', en: 'Maldives', continent: 'AS' },
  { code: 'ML', fr: 'Mali', en: 'Mali', continent: 'AF' },
  { code: 'MT', fr: 'Malte', en: 'Malta', continent: 'EU' },
  { code: 'MH', fr: 'Îles Marshall', en: 'Marshall Islands', continent: 'OC' },
  { code: 'MR', fr: 'Mauritanie', en: 'Mauritania', continent: 'AF' },
  { code: 'MU', fr: 'Maurice', en: 'Mauritius', continent: 'AF' },
  { code: 'MX', fr: 'Mexique', en: 'Mexico', continent: 'NA' },
  { code: 'FM', fr: 'Micronésie', en: 'Micronesia', continent: 'OC' },
  { code: 'MD', fr: 'Moldavie', en: 'Moldova', continent: 'EU' },
  { code: 'MC', fr: 'Monaco', en: 'Monaco', continent: 'EU' },
  { code: 'MN', fr: 'Mongolie', en: 'Mongolia', continent: 'AS' },
  { code: 'ME', fr: 'Monténégro', en: 'Montenegro', continent: 'EU' },
  { code: 'MA', fr: 'Maroc', en: 'Morocco', continent: 'AF' },
  { code: 'MZ', fr: 'Mozambique', en: 'Mozambique', continent: 'AF' },
  { code: 'MM', fr: 'Myanmar', en: 'Myanmar', continent: 'AS' },
  { code: 'NA', fr: 'Namibie', en: 'Namibia', continent: 'AF' },
  { code: 'NR', fr: 'Nauru', en: 'Nauru', continent: 'OC' },
  { code: 'NP', fr: 'Népal', en: 'Nepal', continent: 'AS' },
  { code: 'NL', fr: 'Pays-Bas', en: 'Netherlands', continent: 'EU' },
  { code: 'NZ', fr: 'Nouvelle-Zélande', en: 'New Zealand', continent: 'OC' },
  { code: 'NI', fr: 'Nicaragua', en: 'Nicaragua', continent: 'NA' },
  { code: 'NE', fr: 'Niger', en: 'Niger', continent: 'AF' },
  { code: 'NG', fr: 'Nigéria', en: 'Nigeria', continent: 'AF' },
  { code: 'KP', fr: 'Corée du Nord', en: 'North Korea', continent: 'AS' },
  { code: 'MK', fr: 'Macédoine du Nord', en: 'North Macedonia', continent: 'EU' },
  { code: 'NO', fr: 'Norvège', en: 'Norway', continent: 'EU' },
  { code: 'OM', fr: 'Oman', en: 'Oman', continent: 'AS' },
  { code: 'PK', fr: 'Pakistan', en: 'Pakistan', continent: 'AS' },
  { code: 'PW', fr: 'Palaos', en: 'Palau', continent: 'OC' },
  { code: 'PS', fr: 'Palestine', en: 'Palestine', continent: 'AS' },
  { code: 'PA', fr: 'Panama', en: 'Panama', continent: 'NA' },
  { code: 'PG', fr: 'Papouasie-Nouvelle-Guinée', en: 'Papua New Guinea', continent: 'OC' },
  { code: 'PY', fr: 'Paraguay', en: 'Paraguay', continent: 'SA' },
  { code: 'PE', fr: 'Pérou', en: 'Peru', continent: 'SA' },
  { code: 'PH', fr: 'Philippines', en: 'Philippines', continent: 'AS' },
  { code: 'PL', fr: 'Pologne', en: 'Poland', continent: 'EU' },
  { code: 'PT', fr: 'Portugal', en: 'Portugal', continent: 'EU' },
  { code: 'QA', fr: 'Qatar', en: 'Qatar', continent: 'AS' },
  { code: 'RO', fr: 'Roumanie', en: 'Romania', continent: 'EU' },
  { code: 'RU', fr: 'Russie', en: 'Russia', continent: 'EU' },
  { code: 'RW', fr: 'Rwanda', en: 'Rwanda', continent: 'AF' },
  { code: 'KN', fr: 'Saint-Christophe-et-Niévès', en: 'Saint Kitts and Nevis', continent: 'NA' },
  { code: 'LC', fr: 'Sainte-Lucie', en: 'Saint Lucia', continent: 'NA' },
  { code: 'VC', fr: 'Saint-Vincent-et-les-Grenadines', en: 'Saint Vincent and the Grenadines', continent: 'NA' },
  { code: 'WS', fr: 'Samoa', en: 'Samoa', continent: 'OC' },
  { code: 'SM', fr: 'Saint-Marin', en: 'San Marino', continent: 'EU' },
  { code: 'ST', fr: 'Sao Tomé-et-Principe', en: 'Sao Tome and Principe', continent: 'AF' },
  { code: 'SA', fr: 'Arabie saoudite', en: 'Saudi Arabia', continent: 'AS' },
  { code: 'SN', fr: 'Sénégal', en: 'Senegal', continent: 'AF' },
  { code: 'RS', fr: 'Serbie', en: 'Serbia', continent: 'EU' },
  { code: 'SC', fr: 'Seychelles', en: 'Seychelles', continent: 'AF' },
  { code: 'SL', fr: 'Sierra Leone', en: 'Sierra Leone', continent: 'AF' },
  { code: 'SG', fr: 'Singapour', en: 'Singapore', continent: 'AS' },
  { code: 'SK', fr: 'Slovaquie', en: 'Slovakia', continent: 'EU' },
  { code: 'SI', fr: 'Slovénie', en: 'Slovenia', continent: 'EU' },
  { code: 'SB', fr: 'Îles Salomon', en: 'Solomon Islands', continent: 'OC' },
  { code: 'SO', fr: 'Somalie', en: 'Somalia', continent: 'AF' },
  { code: 'ZA', fr: 'Afrique du Sud', en: 'South Africa', continent: 'AF' },
  { code: 'KR', fr: 'Corée du Sud', en: 'South Korea', continent: 'AS' },
  { code: 'SS', fr: 'Soudan du Sud', en: 'South Sudan', continent: 'AF' },
  { code: 'ES', fr: 'Espagne', en: 'Spain', continent: 'EU' },
  { code: 'LK', fr: 'Sri Lanka', en: 'Sri Lanka', continent: 'AS' },
  { code: 'SD', fr: 'Soudan', en: 'Sudan', continent: 'AF' },
  { code: 'SR', fr: 'Suriname', en: 'Suriname', continent: 'SA' },
  { code: 'SE', fr: 'Suède', en: 'Sweden', continent: 'EU' },
  { code: 'CH', fr: 'Suisse', en: 'Switzerland', continent: 'EU' },
  { code: 'SY', fr: 'Syrie', en: 'Syria', continent: 'AS' },
  { code: 'TW', fr: 'Taïwan', en: 'Taiwan', continent: 'AS' },
  { code: 'TJ', fr: 'Tadjikistan', en: 'Tajikistan', continent: 'AS' },
  { code: 'TZ', fr: 'Tanzanie', en: 'Tanzania', continent: 'AF' },
  { code: 'TH', fr: 'Thaïlande', en: 'Thailand', continent: 'AS' },
  { code: 'TG', fr: 'Togo', en: 'Togo', continent: 'AF' },
  { code: 'TO', fr: 'Tonga', en: 'Tonga', continent: 'OC' },
  { code: 'TT', fr: 'Trinité-et-Tobago', en: 'Trinidad and Tobago', continent: 'NA' },
  { code: 'TN', fr: 'Tunisie', en: 'Tunisia', continent: 'AF' },
  { code: 'TR', fr: 'Turquie', en: 'Turkey', continent: 'AS' },
  { code: 'TM', fr: 'Turkménistan', en: 'Turkmenistan', continent: 'AS' },
  { code: 'TV', fr: 'Tuvalu', en: 'Tuvalu', continent: 'OC' },
  { code: 'UG', fr: 'Ouganda', en: 'Uganda', continent: 'AF' },
  { code: 'UA', fr: 'Ukraine', en: 'Ukraine', continent: 'EU' },
  { code: 'AE', fr: 'Émirats arabes unis', en: 'United Arab Emirates', continent: 'AS' },
  { code: 'GB', fr: 'Royaume-Uni', en: 'United Kingdom', continent: 'EU' },
  { code: 'US', fr: 'États-Unis', en: 'United States', continent: 'NA' },
  { code: 'UY', fr: 'Uruguay', en: 'Uruguay', continent: 'SA' },
  { code: 'UZ', fr: 'Ouzbékistan', en: 'Uzbekistan', continent: 'AS' },
  { code: 'VU', fr: 'Vanuatu', en: 'Vanuatu', continent: 'OC' },
  { code: 'VA', fr: 'Vatican', en: 'Vatican City', continent: 'EU' },
  { code: 'VE', fr: 'Venezuela', en: 'Venezuela', continent: 'SA' },
  { code: 'VN', fr: 'Vietnam', en: 'Vietnam', continent: 'AS' },
  { code: 'YE', fr: 'Yémen', en: 'Yemen', continent: 'AS' },
  { code: 'ZM', fr: 'Zambie', en: 'Zambia', continent: 'AF' },
  { code: 'ZW', fr: 'Zimbabwe', en: 'Zimbabwe', continent: 'AF' },
  // Territoires et dépendances notables
  { code: 'HK', fr: 'Hong Kong', en: 'Hong Kong', continent: 'AS' },
  { code: 'MO', fr: 'Macao', en: 'Macau', continent: 'AS' },
  { code: 'PR', fr: 'Porto Rico', en: 'Puerto Rico', continent: 'NA' },
  { code: 'GP', fr: 'Guadeloupe', en: 'Guadeloupe', continent: 'NA' },
  { code: 'MQ', fr: 'Martinique', en: 'Martinique', continent: 'NA' },
  { code: 'GF', fr: 'Guyane française', en: 'French Guiana', continent: 'SA' },
  { code: 'RE', fr: 'La Réunion', en: 'Réunion', continent: 'AF' },
  { code: 'YT', fr: 'Mayotte', en: 'Mayotte', continent: 'AF' },
  { code: 'PF', fr: 'Polynésie française', en: 'French Polynesia', continent: 'OC' },
  { code: 'NC', fr: 'Nouvelle-Calédonie', en: 'New Caledonia', continent: 'OC' },
  { code: 'WF', fr: 'Wallis-et-Futuna', en: 'Wallis and Futuna', continent: 'OC' },
  { code: 'GL', fr: 'Groenland', en: 'Greenland', continent: 'NA' },
  { code: 'BM', fr: 'Bermudes', en: 'Bermuda', continent: 'NA' },
  { code: 'KY', fr: 'Îles Caïmans', en: 'Cayman Islands', continent: 'NA' },
  { code: 'VI', fr: 'Îles Vierges américaines', en: 'U.S. Virgin Islands', continent: 'NA' },
  { code: 'VG', fr: 'Îles Vierges britanniques', en: 'British Virgin Islands', continent: 'NA' },
  { code: 'AW', fr: 'Aruba', en: 'Aruba', continent: 'NA' },
  { code: 'CW', fr: 'Curaçao', en: 'Curaçao', continent: 'NA' },
  { code: 'AI', fr: 'Anguilla', en: 'Anguilla', continent: 'NA' },
  { code: 'MS', fr: 'Montserrat', en: 'Montserrat', continent: 'NA' },
  { code: 'TC', fr: 'Îles Turques-et-Caïques', en: 'Turks and Caicos Islands', continent: 'NA' },
  { code: 'FK', fr: 'Îles Malouines', en: 'Falkland Islands', continent: 'SA' },
  { code: 'SH', fr: 'Sainte-Hélène', en: 'Saint Helena', continent: 'AF' },
  { code: 'FO', fr: 'Îles Féroé', en: 'Faroe Islands', continent: 'EU' },
  { code: 'GI', fr: 'Gibraltar', en: 'Gibraltar', continent: 'EU' },
  { code: 'IM', fr: 'Île de Man', en: 'Isle of Man', continent: 'EU' },
  { code: 'JE', fr: 'Jersey', en: 'Jersey', continent: 'EU' },
  { code: 'GG', fr: 'Guernesey', en: 'Guernsey', continent: 'EU' },
]

/** Index rapide par code ISO. */
const BY_CODE = new Map(COUNTRIES.map((c) => [c.code, c]))

/** Index rapide par nom (normalisé, sans accents). */
const BY_NAME = new Map<string, CountryInfo>()

function normName(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

for (const country of COUNTRIES) {
  BY_NAME.set(normName(country.fr), country)
  BY_NAME.set(normName(country.en), country)
  BY_NAME.set(country.code.toLowerCase(), country)
}

/** Emoji drapeau d'un code ISO 3166-1 alpha-2 (« BJ » → 🇧🇯). */
export function flagFor(code: string | null | undefined): string {
  if (!code || code.length !== 2) return '🌍'
  const base = 0x1f1e6
  return String.fromCodePoint(
    base + code.charCodeAt(0) - 65,
    base + code.charCodeAt(1) - 65,
  )
}

/** Résout un pays par code ISO ou par nom (FR/EN, variantes sans accents). */
export function countryByCode(code: string | null | undefined): CountryInfo | undefined {
  if (!code) return undefined
  return BY_CODE.get(code.trim().toUpperCase())
}

export function countryByName(raw: string | null | undefined): CountryInfo | undefined {
  if (!raw) return undefined
  const normalized = normName(raw)
  return BY_NAME.get(normalized)
}

/** Recherche de pays par requête (nom FR, nom EN, code). */
export function searchCountries(query: string): CountryInfo[] {
  const q = normName(query)
  if (!q) return []
  const scored = COUNTRIES.map((c) => {
    const fr = normName(c.fr)
    const en = normName(c.en)
    let score = -1
    if (fr === q || en === q) score = 100
    else if (fr.startsWith(q) || en.startsWith(q)) score = 60
    else if (fr.includes(q) || en.includes(q)) score = 30
    else if (c.code.toLowerCase() === q) score = 80
    return { c, score }
  })
    .filter((x) => x.score >= 0)
    .sort((a, b) => b.score - a.score)
  return scored.map((x) => x.c)
}

/** Continent d'un code pays (via le dataset). */
export function continentOf(code: string | null | undefined): Continent | undefined {
  return countryByCode(code)?.continent
}

/** Nom du continent dans la langue demandée. */
export function continentName(continent: Continent | undefined, lang: 'fr' | 'en' = 'fr'): string {
  if (!continent) return ''
  return CONTINENT_NAMES[continent][lang]
}

/** Nom lisible d'un pays (FR ou EN) à partir d'un code ISO. */
export function countryName(
  code: string | null | undefined,
  lang: 'fr' | 'en' = 'fr',
): string {
  const country = countryByCode(code)
  if (!country) return code ?? ''
  return country[lang]
}

/**
 * Villes connues du catalogue → code ISO du pays où elles se trouvent
 * GÉOGRAPHIQUEMENT. Sert au clustering de la carte : un artiste de la
 * diaspora (ex. cap-verdien installé à Dakar) doit compter dans le cluster
 * du Sénégal, pas dans celui de son pays d'origine.
 */
const CITY_TO_COUNTRY: Record<string, string> = {
  'Abidjan': 'CI',
  'Accra': 'GH',
  'Conakry': 'GN',
  'Cotonou': 'BJ',
  'Dakar': 'SN',
  'Kinshasa': 'CD',
  'Lagos': 'NG',
  'London': 'GB',
  'Nairobi': 'KE',
  'New York': 'US',
  'Ouagadougou': 'BF',
  'Paris': 'FR',
  'Porto Alegre': 'BR',
  'Trappes': 'FR',
}

/**
 * Pays géographique d'un artiste : dérivé de la ville connue (localisation
 * réelle), sinon repli sur le pays déclaré. Empêche les clusters « fantômes »
 * (ex. « US — 3 » posé au-dessus de l'Afrique parce que des artistes
 * d'origine US vivent à Accra).
 */
export function geoCountryOf(
  city: string | null | undefined,
  declared: string | null | undefined,
): string {
  const c = (city ?? '').trim()
  if (c && CITY_TO_COUNTRY[c]) return CITY_TO_COUNTRY[c]
  const d = (declared ?? '').trim()
  if (!d) return ''
  if (d.length === 2) return d.toUpperCase()
  // Nom complet (« Côte d'Ivoire ») ou code ISO : résout via le dataset.
  return countryByName(d)?.code ?? countryByCode(d)?.code ?? d.toUpperCase()
}
