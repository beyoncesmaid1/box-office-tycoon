// Major box office markets by country with realistic market share percentages
// Based on 2024 global box office data from Box Office Mojo, The Numbers, and Deadline
// Total global box office 2024: ~$30 billion

export const BOX_OFFICE_COUNTRIES = [
  // North America: Boosted to 35% base (range 20-75% for strong domestic performance)
  { code: 'NA', name: 'North America', percentage: 0.35, minPct: 0.20, maxPct: 0.75 },
  
  // China: $5.8B = 19% (high variance 0-35%: some films don't release, others dominate)
  { code: 'CN', name: 'China', percentage: 0.19, minPct: 0.02, maxPct: 0.32 },
  
  // UK/Ireland: $1.4B = 4.7% (stable market, 3-7% range)
  { code: 'GB', name: 'UK & Ireland', percentage: 0.047, minPct: 0.03, maxPct: 0.07 },
  
  // France: $1.4B = 4.7% (strong local film culture, 3-7% range)
  { code: 'FR', name: 'France', percentage: 0.047, minPct: 0.03, maxPct: 0.07 },
  
  // Japan: $1.4B = 4.7% (anime dominance affects Hollywood, 2-9% range)
  { code: 'JP', name: 'Japan', percentage: 0.047, minPct: 0.02, maxPct: 0.09 },
  
  // Germany: $0.9B = 3% (2-5% range)
  { code: 'DE', name: 'Germany', percentage: 0.03, minPct: 0.02, maxPct: 0.05 },
  
  // South Korea: $0.85B = 2.8% (recovering market, 2-5% range)
  { code: 'KR', name: 'South Korea', percentage: 0.028, minPct: 0.018, maxPct: 0.05 },
  
  // Mexico: $0.8B = 2.7% (largest Latin American market, 2-4.5% range)
  { code: 'MX', name: 'Mexico', percentage: 0.027, minPct: 0.018, maxPct: 0.045 },
  
  // Australia: $0.65B = 2.2% (1.5-3.5% range)
  { code: 'AU', name: 'Australia', percentage: 0.022, minPct: 0.015, maxPct: 0.035 },
  
  // India: $1.4B = 4.7% but Hollywood only gets ~15-20% of that market
  // Effective Hollywood share: ~0.7-1% (Bollywood dominates, range 0.3-2.5%)
  { code: 'IN', name: 'India', percentage: 0.01, minPct: 0.003, maxPct: 0.025 },
  
  // Other Territories: ~26% (Italy $550M, Spain $540M, Brazil $300M, 
  // Russia excluded, rest of EMEA, Latin America, SEA, etc.)
  { code: 'OTHER', name: 'Other Territories', percentage: 0.262, minPct: 0.18, maxPct: 0.34 },
];

export type BoxOfficeCountry = (typeof BOX_OFFICE_COUNTRIES)[number];

// Generate a highly randomized percentage within a country's min/max range
// Uses multiple random components to ensure each film gets a unique distribution
function getRandomizedPercentage(country: BoxOfficeCountry): number {
  const range = country.maxPct - country.minPct;
  
  // Multiple random factors for more variation
  const baseRandom = Math.random();
  const fineRandom = Math.random() * 0.1; // Additional fine-grained variance
  const microRandom = Math.random() * 0.01; // Micro variance for uniqueness
  
  // Apply a curve to make extreme values less common, but still possible
  const curvedRandom = Math.pow(baseRandom, 0.7 + Math.random() * 0.3);
  const direction = Math.random() > 0.5 ? 1 : -1;
  
  // Combine all variance factors
  const variance = (curvedRandom * direction * range * 0.6) + 
                   (fineRandom * direction * range * 0.3) +
                   (microRandom * (Math.random() > 0.5 ? 1 : -1) * range);
  
  const result = country.percentage + variance;
  
  // Add a tiny unique offset to prevent identical distributions (up to 0.01%)
  const uniqueOffset = (Math.random() - 0.5) * 0.0002;
  
  return Math.max(country.minPct, Math.min(country.maxPct, result + uniqueOffset));
}

// Distribute a total box office amount across countries with randomized percentages
export function distributeBoxOfficeByCountry(total: number): Record<string, number> {
  // Generate randomized percentages for each country
  const randomizedPcts: { name: string; pct: number }[] = BOX_OFFICE_COUNTRIES.map(country => ({
    name: country.name,
    pct: getRandomizedPercentage(country),
  }));
  
  // Normalize so percentages sum to 1.0
  const totalPct = randomizedPcts.reduce((sum, c) => sum + c.pct, 0);
  const normalizedPcts = randomizedPcts.map(c => ({
    name: c.name,
    pct: c.pct / totalPct,
  }));
  
  // Distribute the total amount
  const result: Record<string, number> = {};
  let distributed = 0;
  
  for (let i = 0; i < normalizedPcts.length - 1; i++) {
    const amount = Math.floor(total * normalizedPcts[i].pct);
    result[normalizedPcts[i].name] = amount;
    distributed += amount;
  }
  
  // Give remaining to last country to avoid rounding errors
  result[normalizedPcts[normalizedPcts.length - 1].name] = total - distributed;
  
  return result;
}

// Generate territory percentages (for first week - these should be stored and reused)
export function generateTerritoryPercentages(): Record<string, number> {
  // Generate randomized percentages for each country
  const randomizedPcts: { name: string; pct: number }[] = BOX_OFFICE_COUNTRIES.map(country => ({
    name: country.name,
    pct: getRandomizedPercentage(country),
  }));
  
  // Normalize so percentages sum to 1.0
  const totalPct = randomizedPcts.reduce((sum, c) => sum + c.pct, 0);
  
  const result: Record<string, number> = {};
  for (const c of randomizedPcts) {
    result[c.name] = c.pct / totalPct;
  }
  
  return result;
}

// Distribute box office using fixed percentages (for subsequent weeks)
export function distributeBoxOfficeWithFixedPercentages(total: number, percentages: Record<string, number>): Record<string, number> {
  const result: Record<string, number> = {};
  let distributed = 0;
  const entries = Object.entries(percentages);
  
  for (let i = 0; i < entries.length - 1; i++) {
    const [country, pct] = entries[i];
    const amount = Math.floor(total * pct);
    result[country] = amount;
    distributed += amount;
  }
  
  // Give remaining to last country to avoid rounding errors
  if (entries.length > 0) {
    result[entries[entries.length - 1][0]] = total - distributed;
  }
  
  return result;
}

// Get country list for dropdown/display
export function getCountryNames(): string[] {
  return BOX_OFFICE_COUNTRIES.map(c => c.name);
}

// Get country code from name
export function getCountryCode(name: string): string | undefined {
  return BOX_OFFICE_COUNTRIES.find(c => c.name === name)?.code;
}

// Get country name from code
export function getCountryName(code: string): string | undefined {
  return BOX_OFFICE_COUNTRIES.find(c => c.code === code)?.name;
}

// Get the base market share percentage for a territory
export function getTerritoryBasePercentage(code: string): number {
  const country = BOX_OFFICE_COUNTRIES.find(c => c.code === code);
  return country?.percentage || 0;
}

// Territory release interface
export interface TerritoryRelease {
  territory: string;
  releaseWeek: number;
  releaseYear: number;
  marketingBudget: number;
  weeksInRelease: number;
  isOpening: boolean;
}

// Calculate box office for a specific territory based on release info
export function calculateTerritoryBoxOffice(
  territoryRelease: TerritoryRelease,
  baseOpeningGross: number,
  filmQuality: number
): number {
  const { territory, marketingBudget, weeksInRelease, isOpening } = territoryRelease;
  
  const country = BOX_OFFICE_COUNTRIES.find(c => c.code === territory);
  if (!country) return 0;
  
  // Get territory's market share (randomized within range)
  const marketShare = getRandomizedPercentage(country);
  
  // Calculate territory's base opening based on market share
  // Marketing budget affects the multiplier
  const marketingMultiplier = Math.min(2.0, (marketingBudget || 5000000) / 30000000);
  const qualityFactor = (filmQuality / 100) * 0.5 + 0.5;
  
  // Opening weekend calculation for this territory
  const territoryBaseOpening = baseOpeningGross * marketShare * marketingMultiplier * qualityFactor;
  
  if (isOpening) {
    // First week - opening weekend with variance
    return Math.floor(territoryBaseOpening * (0.7 + Math.random() * 0.6));
  } else {
    // Subsequent weeks - apply decay based on weeks in release
    // Drop % increases gradually: starts at 15% drop, increases to 45% drop by week 20
    const baseDecay = Math.max(0.5, 0.85 - (weeksInRelease * 0.018));
    const decay = baseDecay + Math.random() * 0.1;
    
    // We need the previous week's gross to calculate decay
    // This function is designed to be called per-week with the previous gross passed in
    // For now, just return 0 - the caller should track previous week's gross
    return 0; // This is handled differently - see calculateTerritoryWeeklyBoxOffice
  }
}


// Distribute box office only to specific released territories
export function distributeBoxOfficeToTerritories(
  total: number,
  releasedTerritories: string[]
): Record<string, number> {
  if (releasedTerritories.length === 0) return {};
  
  // Get countries for released territories
  const countries = BOX_OFFICE_COUNTRIES.filter(c => 
    releasedTerritories.includes(c.code)
  );
  
  if (countries.length === 0) return {};
  
  // Generate randomized percentages for each released country
  const randomizedPcts: { name: string; pct: number }[] = countries.map(country => ({
    name: country.name,
    pct: getRandomizedPercentage(country),
  }));
  
  // Normalize so percentages sum to 1.0
  const totalPct = randomizedPcts.reduce((sum, c) => sum + c.pct, 0);
  const normalizedPcts = randomizedPcts.map(c => ({
    name: c.name,
    pct: c.pct / totalPct,
  }));
  
  // Distribute the total amount
  const result: Record<string, number> = {};
  let distributed = 0;
  
  for (let i = 0; i < normalizedPcts.length - 1; i++) {
    const amount = Math.floor(total * normalizedPcts[i].pct);
    result[normalizedPcts[i].name] = amount;
    distributed += amount;
  }
  
  // Give remaining to last country to avoid rounding errors
  result[normalizedPcts[normalizedPcts.length - 1].name] = total - distributed;
  
  return result;
}
