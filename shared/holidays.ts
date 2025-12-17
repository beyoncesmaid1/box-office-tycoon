export interface Holiday {
  name: string;
  week: number;
  month: number;
  icon: string;
  boxOfficeModifier: number;
  description: string;
}

export type Genre = 'action' | 'comedy' | 'drama' | 'horror' | 'scifi' | 'romance' | 'thriller' | 'animation' | 'fantasy' | 'musicals';

export const HOLIDAYS: Holiday[] = [
  { name: "New Year's Day", week: 1, month: 1, icon: "🎉", boxOfficeModifier: 1.15, description: "New Year's boost" },
  { name: "Martin Luther King Jr. Day", week: 3, month: 1, icon: "✊", boxOfficeModifier: 1.10, description: "MLK Weekend boost" },
  { name: "Super Bowl Weekend", week: 6, month: 2, icon: "🏈", boxOfficeModifier: 0.75, description: "Lower turnout due to Super Bowl" },
  { name: "Valentine's Day", week: 7, month: 2, icon: "💕", boxOfficeModifier: 1.20, description: "Date night boost" },
  { name: "Presidents' Day", week: 8, month: 2, icon: "🎩", boxOfficeModifier: 1.15, description: "Long weekend boost" },
  { name: "St. Patrick's Day", week: 11, month: 3, icon: "☘️", boxOfficeModifier: 0.95, description: "Slight dip - bars over movies" },
  { name: "Easter Weekend", week: 16, month: 4, icon: "🐣", boxOfficeModifier: 1.05, description: "Family movie boost" },
  { name: "Memorial Day", week: 22, month: 5, icon: "🇺🇸", boxOfficeModifier: 1.35, description: "Summer blockbuster launch" },
  { name: "Father's Day", week: 25, month: 6, icon: "👔", boxOfficeModifier: 1.10, description: "Family outing boost" },
  { name: "Independence Day", week: 27, month: 7, icon: "🎆", boxOfficeModifier: 1.45, description: "Major summer blockbuster weekend" },
  { name: "Labor Day", week: 36, month: 9, icon: "⚒️", boxOfficeModifier: 1.20, description: "End of summer boost" },
  { name: "Halloween", week: 43, month: 10, icon: "🎃", boxOfficeModifier: 1.30, description: "Horror movie prime time" },
  { name: "Thanksgiving", week: 47, month: 11, icon: "🦃", boxOfficeModifier: 1.40, description: "Major family movie weekend" },
  { name: "Black Friday Weekend", week: 48, month: 11, icon: "🛍️", boxOfficeModifier: 1.25, description: "Holiday shopping + movies" },
  { name: "Christmas Week", week: 52, month: 12, icon: "🎄", boxOfficeModifier: 1.50, description: "Biggest movie week of the year" },
];

export const HOLIDAY_GENRE_MODIFIERS: Record<string, Partial<Record<Genre, number>>> = {
  "New Year's Day": {
    animation: 1.15, fantasy: 1.10, musicals: 1.10, comedy: 1.08, action: 1.05,
    horror: 0.90, thriller: 0.95
  },
  "Martin Luther King Jr. Day": {
    drama: 1.15, musicals: 1.10, animation: 1.08,
    horror: 0.90
  },
  "Super Bowl Weekend": {
    romance: 1.15, comedy: 1.10, drama: 1.05,
    action: 0.80, scifi: 0.85, thriller: 0.85
  },
  "Valentine's Day": {
    romance: 1.50, comedy: 1.20, drama: 1.15, musicals: 1.10,
    horror: 0.80, action: 0.90, scifi: 0.90
  },
  "Presidents' Day": {
    action: 1.20, scifi: 1.15, thriller: 1.10, fantasy: 1.08,
    romance: 0.95, horror: 0.90
  },
  "St. Patrick's Day": {
    comedy: 1.10, horror: 1.05,
    drama: 0.90, romance: 0.90
  },
  "Easter Weekend": {
    animation: 1.30, fantasy: 1.20, musicals: 1.15, comedy: 1.10,
    horror: 0.75, thriller: 0.85
  },
  "Memorial Day": {
    action: 1.30, scifi: 1.25, thriller: 1.15, fantasy: 1.10,
    horror: 0.85, romance: 0.90
  },
  "Father's Day": {
    action: 1.15, animation: 1.12, comedy: 1.10, scifi: 1.08,
    romance: 0.90
  },
  "Independence Day": {
    action: 1.35, scifi: 1.30, thriller: 1.15, fantasy: 1.10,
    horror: 0.85, romance: 0.85, drama: 0.90
  },
  "Labor Day": {
    horror: 1.15, thriller: 1.10, comedy: 1.08,
    drama: 0.92, romance: 0.95
  },
  "Halloween": {
    horror: 1.70, thriller: 1.25, fantasy: 1.10, scifi: 1.05,
    romance: 0.75, animation: 0.90, musicals: 0.85
  },
  "Thanksgiving": {
    animation: 1.35, fantasy: 1.20, musicals: 1.20, comedy: 1.18, drama: 1.12,
    horror: 0.75, thriller: 0.85
  },
  "Black Friday Weekend": {
    animation: 1.15, action: 1.12, comedy: 1.10, fantasy: 1.08,
    horror: 0.85
  },
  "Christmas Week": {
    animation: 1.45, fantasy: 1.30, musicals: 1.25, romance: 1.15, drama: 1.12, comedy: 1.10,
    horror: 0.70, thriller: 0.80
  },
};

export const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

export function getHolidayForWeek(week: number): Holiday | undefined {
  return HOLIDAYS.find(h => h.week === week);
}

export function getHolidayModifier(week: number): number {
  const holiday = getHolidayForWeek(week);
  return holiday?.boxOfficeModifier ?? 1.0;
}

export function getGenreHolidayModifier(week: number, genre: string): number {
  const holiday = getHolidayForWeek(week);
  if (!holiday) return 1.0;
  
  const baseModifier = holiday.boxOfficeModifier;
  const genreModifiers = HOLIDAY_GENRE_MODIFIERS[holiday.name];
  const genreMultiplier = genreModifiers?.[genre as Genre] ?? 1.0;
  
  return baseModifier * genreMultiplier;
}

export function getGenreModifierOnly(holidayName: string, genre: string): number {
  const genreModifiers = HOLIDAY_GENRE_MODIFIERS[holidayName];
  return genreModifiers?.[genre as Genre] ?? 1.0;
}

export function getWeeksForMonth(month: number): number[] {
  const weeksPerMonth: Record<number, number[]> = {
    1: [1, 2, 3, 4, 5],
    2: [5, 6, 7, 8, 9],
    3: [9, 10, 11, 12, 13],
    4: [14, 15, 16, 17, 18],
    5: [18, 19, 20, 21, 22],
    6: [22, 23, 24, 25, 26],
    7: [27, 28, 29, 30, 31],
    8: [31, 32, 33, 34, 35],
    9: [35, 36, 37, 38, 39],
    10: [40, 41, 42, 43, 44],
    11: [44, 45, 46, 47, 48],
    12: [48, 49, 50, 51, 52],
  };
  return weeksPerMonth[month] || [];
}

export function getMonthFromWeek(week: number): number {
  if (week <= 4) return 1;
  if (week <= 8) return 2;
  if (week <= 13) return 3;
  if (week <= 17) return 4;
  if (week <= 22) return 5;
  if (week <= 26) return 6;
  if (week <= 30) return 7;
  if (week <= 35) return 8;
  if (week <= 39) return 9;
  if (week <= 43) return 10;
  if (week <= 47) return 11;
  return 12;
}

export function getSeasonIcon(month: number): { icon: string; name: string } {
  if (month >= 3 && month <= 5) return { icon: "🌸", name: "Spring" };
  if (month >= 6 && month <= 8) return { icon: "☀️", name: "Summer" };
  if (month >= 9 && month <= 11) return { icon: "🍂", name: "Fall" };
  return { icon: "❄️", name: "Winter" };
}
