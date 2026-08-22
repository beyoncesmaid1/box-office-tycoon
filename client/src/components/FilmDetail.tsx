import { useMemo, useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import { 
  ArrowLeft, 
  Trophy, 
  Calendar, 
  Building2, 
  Film as FilmIcon,
  Users,
  Clapperboard,
  PenTool,
  Music,
  Globe,
  TrendingUp,
  DollarSign,
  MapPin,
  Megaphone
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { useGame, formatMoney, genreLabels } from '@/lib/gameState';
import type { Film, Studio, Talent, AwardNomination, FilmRole, FilmRelease } from '@shared/schema';
import { MarketingCampaign } from './MarketingCampaign';

interface FilmDetailProps {
  filmId: string;
}

// Convert week number and year to a readable date
function formatReleaseDate(week: number, year: number): string {
  // Week 1 = first week of January
  const startOfYear = new Date(year, 0, 1);
  const daysToAdd = (week - 1) * 7;
  const releaseDate = new Date(startOfYear.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
  
  return releaseDate.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });
}

function formatCompactMoney(amount: number): string {
  if (amount >= 1000000000) {
    return `$${(amount / 1000000000).toFixed(2)}B`;
  } else if (amount >= 1000000) {
    return `$${(amount / 1000000).toFixed(1)}M`;
  } else if (amount >= 1000) {
    return `$${(amount / 1000).toFixed(0)}K`;
  }
  return `$${amount.toLocaleString()}`;
}

function releaseCalendarWeek(
  releaseWeek: number,
  releaseYear: number,
  weeksAfterOpening: number,
): { week: number; year: number } {
  const absoluteWeek = releaseYear * 52 + (releaseWeek - 1) + weeksAfterOpening;
  return {
    week: (absoluteWeek % 52) + 1,
    year: Math.floor(absoluteWeek / 52),
  };
}

function weeklyDomesticGross(byCountry?: Record<string, number>): number {
  if (!byCountry) return 0;
  return Number(
    byCountry['North America'] ?? byCountry.NA ?? byCountry.Domestic ?? 0,
  );
}

function domesticGrossForFilmWeek(film: Film, weekIndex: number): number {
  if (weekIndex < 0 || weekIndex >= (film.weeklyBoxOffice?.length || 0)) return 0;
  const histories = Array.isArray(film.weeklyBoxOfficeByCountry)
    ? film.weeklyBoxOfficeByCountry as Array<Record<string, number>>
    : [];
  const recorded = weeklyDomesticGross(histories[weekIndex]);
  return recorded > 0
    ? recorded
    : Math.round(Number(film.weeklyBoxOffice?.[weekIndex] || 0) * 0.4);
}

function formatWeekendRange(week: number, year: number): string {
  const start = new Date(year, 0, 1 + (week - 1) * 7);
  const end = new Date(start);
  end.setDate(start.getDate() + 2);
  const startMonth = start.toLocaleDateString('en-US', { month: 'short' });
  const endMonth = end.toLocaleDateString('en-US', { month: 'short' });
  return startMonth === endMonth
    ? `${startMonth} ${start.getDate()}-${end.getDate()}, ${end.getFullYear()}`
    : `${startMonth} ${start.getDate()}-${endMonth} ${end.getDate()}, ${end.getFullYear()}`;
}

function exactMoney(amount: number): string {
  return `$${Math.round(amount).toLocaleString('en-US')}`;
}

const PERFORMANCE_TERRITORIES = [
  { code: 'NA', name: 'North America' },
  { code: 'CN', name: 'China' },
  { code: 'GB', name: 'UK & Ireland' },
  { code: 'FR', name: 'France' },
  { code: 'JP', name: 'Japan' },
  { code: 'DE', name: 'Germany' },
  { code: 'KR', name: 'South Korea' },
  { code: 'MX', name: 'Mexico' },
  { code: 'AU', name: 'Australia' },
  { code: 'IN', name: 'India' },
  { code: 'OTHER', name: 'Other Territories' },
] as const;

type PerformanceView = 'weekend' | 'weekly' | 'daily';

function formatFullWeekRange(week: number, year: number): string {
  const start = new Date(year, 0, 1 + (week - 1) * 7);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  const startMonth = start.toLocaleDateString('en-US', { month: 'short' });
  const endMonth = end.toLocaleDateString('en-US', { month: 'short' });
  return startMonth === endMonth
    ? `${startMonth} ${start.getDate()}-${end.getDate()}, ${end.getFullYear()}`
    : `${startMonth} ${start.getDate()}-${endMonth} ${end.getDate()}, ${end.getFullYear()}`;
}

function dateForReleaseDay(week: number, year: number, dayIndex: number): Date {
  return new Date(year, 0, 1 + (week - 1) * 7 + dayIndex);
}

function territoryGross(
  week: Record<string, number> | undefined,
  territoryCode: string,
): number {
  if (!week) return 0;
  const territory = PERFORMANCE_TERRITORIES.find(item => item.code === territoryCode);
  return Number(week[territory?.name || territoryCode] ?? week[territoryCode] ?? 0);
}

function WeeklyPerformanceTracker({
  filmId,
  weeklyData,
  weeklyByCountry,
  filmReleases,
  allFilms,
  releaseWeek,
  releaseYear,
  ranks,
  theaterCounts,
}: {
  filmId: string;
  weeklyData: number[];
  weeklyByCountry: Array<Record<string, number>>;
  filmReleases: FilmRelease[];
  allFilms: Film[];
  releaseWeek?: number | null;
  releaseYear?: number | null;
  ranks: Array<number | null>;
  theaterCounts: Array<number | null>;
}) {
  const [view, setView] = useState<PerformanceView>('weekend');
  const [territoryCode, setTerritoryCode] = useState('ALL');

  useEffect(() => {
    setView('weekend');
    setTerritoryCode('ALL');
  }, [filmId]);

  const availableTerritories = useMemo(() => PERFORMANCE_TERRITORIES.filter(territory =>
    weeklyByCountry.some(week =>
      Number(week?.[territory.name] ?? week?.[territory.code] ?? 0) > 0,
    )), [weeklyByCountry]);

  const selectedWeeks = useMemo(() => territoryCode === 'ALL'
    ? weeklyData.map(gross => Number(gross || 0))
    : weeklyByCountry.map(week => territoryGross(week, territoryCode)),
  [territoryCode, weeklyData, weeklyByCountry]);

  const selectedTheaterCounts = useMemo(() => {
    if (territoryCode === 'ALL' || territoryCode === 'NA') return theaterCounts;
    const release = filmReleases.find(item => item.territoryCode === territoryCode);
    const history = Array.isArray(release?.weeklyCapacityBreakdown)
      ? release.weeklyCapacityBreakdown as Array<Record<string, unknown>>
      : [];
    return selectedWeeks.map((_, index) => {
      const count = Number(history[index]?.theaterCount || 0);
      return count > 0 ? count : null;
    });
  }, [filmReleases, selectedWeeks, theaterCounts, territoryCode]);

  const selectedRanks = useMemo(() => selectedWeeks.map((_, weekIndex) => {
    if (territoryCode === 'ALL') return ranks[weekIndex] ?? null;
    if (!releaseWeek || !releaseYear) return null;
    const calendarWeek = releaseYear * 52 + releaseWeek - 1 + weekIndex;
    const market = allFilms.map(candidate => {
      if (!candidate.releaseWeek || !candidate.releaseYear) return null;
      const candidateRelease = candidate.releaseYear * 52 + candidate.releaseWeek - 1;
      const candidateWeek = calendarWeek - candidateRelease;
      const histories = Array.isArray(candidate.weeklyBoxOfficeByCountry)
        ? candidate.weeklyBoxOfficeByCountry as Array<Record<string, number>>
        : [];
      if (candidateWeek < 0 || candidateWeek >= histories.length) return null;
      const gross = territoryGross(histories[candidateWeek], territoryCode);
      return gross > 0 ? { id: candidate.id, gross } : null;
    }).filter((entry): entry is { id: string; gross: number } => entry !== null)
      .sort((left, right) => right.gross - left.gross);
    const rank = market.findIndex(entry => entry.id === filmId);
    return rank >= 0 ? rank + 1 : null;
  }), [allFilms, filmId, ranks, releaseWeek, releaseYear, selectedWeeks, territoryCode]);

  const rows = useMemo(() => {
    const generated: Array<{
      key: string;
      date: string;
      gross: number;
      grossToDate: number;
      rank: number | null;
      theaters: number | null;
      previousTheaters: number | null;
      periodLabel: string;
      isPeriodStart: boolean;
    }> = [];
    let runningGross = 0;

    selectedWeeks.forEach((weeklyGross, weekIndex) => {
      const calendar = releaseWeek && releaseYear
        ? releaseCalendarWeek(releaseWeek, releaseYear, weekIndex)
        : null;
      const theaters = selectedTheaterCounts[weekIndex] ?? null;
      const previousTheaters = weekIndex > 0
        ? selectedTheaterCounts[weekIndex - 1] ?? null
        : null;
      const rank = selectedRanks[weekIndex] ?? null;

      if (view === 'daily') {
        const opening = weekIndex === 0;
        const shares = opening
          ? [0.22, 0.28, 0.18, 0.07, 0.07, 0.08, 0.10]
          : [0.20, 0.25, 0.17, 0.08, 0.08, 0.10, 0.12];
        let assigned = 0;
        shares.forEach((share, dayIndex) => {
          const gross = dayIndex === shares.length - 1
            ? Math.max(0, Math.round(weeklyGross) - assigned)
            : Math.round(weeklyGross * share);
          assigned += gross;
          runningGross += gross;
          const date = calendar
            ? dateForReleaseDay(calendar.week, calendar.year, dayIndex)
            : null;
          generated.push({
            key: `${weekIndex}-${dayIndex}`,
            date: date
              ? date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
              : `Week ${weekIndex + 1}, Day ${dayIndex + 1}`,
            gross,
            grossToDate: runningGross,
            rank,
            theaters,
            previousTheaters,
            periodLabel: date
              ? date.toLocaleDateString('en-US', { weekday: 'short' })
              : `D${dayIndex + 1}`,
            isPeriodStart: dayIndex === 0,
          });
        });
        return;
      }

      // The simulation stores one authoritative gross per game week. Keep
      // that number unchanged in both summary views; Daily is the only view
      // that apportions it into smaller display periods.
      const gross = Math.round(weeklyGross);
      runningGross += gross;
      generated.push({
        key: `${weekIndex}`,
        date: calendar
          ? view === 'weekend'
            ? formatWeekendRange(calendar.week, calendar.year)
            : formatFullWeekRange(calendar.week, calendar.year)
          : `${view === 'weekend' ? 'Weekend' : 'Week'} ${weekIndex + 1}`,
        gross,
        grossToDate: runningGross,
        rank,
        theaters,
        previousTheaters,
        periodLabel: `${weekIndex + 1}`,
        isPeriodStart: true,
      });
    });
    return generated;
  }, [releaseWeek, releaseYear, selectedRanks, selectedTheaterCounts, selectedWeeks, view]);

  const title = view === 'weekend'
    ? 'Weekend Box Office'
    : view === 'weekly' ? 'Weekly Box Office' : 'Daily Box Office';
  const grossHeading = view === 'weekend' ? 'Weekend' : view === 'weekly' ? 'Week' : 'Daily';
  const comparisonHeading = view === 'daily' ? '%± YD' : '%± LW';

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            {title}
          </CardTitle>
          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            <div className="flex items-center rounded-md border bg-muted/20 p-0.5">
              {(['weekend', 'weekly', 'daily'] as const).map(option => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setView(option)}
                  aria-pressed={view === option}
                  className={`rounded px-3 py-1.5 font-medium capitalize transition-colors ${
                    view === option
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
            <div className="h-6 w-px bg-border" />
            <Select value={territoryCode} onValueChange={setTerritoryCode}>
              <SelectTrigger
                aria-label="Box office territory"
                className="h-[31px] min-w-36 bg-muted/20 text-[11px]"
              >
                <Globe className="mr-1 h-3.5 w-3.5" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Worldwide</SelectItem>
                {availableTerritories.map(territory => (
                  <SelectItem key={territory.code} value={territory.code}>
                    {territory.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse text-[13px] tabular-nums">
            <thead className="text-muted-foreground">
              <tr>
                <th className="border-b px-2 py-2.5 text-left font-medium">Date</th>
                <th className="border-b px-3 py-2.5 text-center font-medium">Rank</th>
                <th className="border-b px-3 py-2.5 text-right font-medium">{grossHeading}</th>
                <th className="border-b px-3 py-2.5 text-right font-medium">{comparisonHeading}</th>
                <th className="border-b px-3 py-2.5 text-right font-medium">Theaters</th>
                <th className="border-b px-3 py-2.5 text-right font-medium">Change</th>
                <th className="border-b px-3 py-2.5 text-right font-medium">Avg</th>
                <th className="border-b px-3 py-2.5 text-right font-medium">To Date</th>
                <th className="border-b px-2 py-2.5 text-center font-medium">
                  {view === 'daily' ? 'Day' : 'Week'}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => {
                const previousGross = index > 0 ? rows[index - 1].gross : 0;
                const grossChange = index > 0 && previousGross > 0
                  ? ((row.gross - previousGross) / previousGross) * 100
                  : null;
                const theaterChange = row.isPeriodStart && row.theaters !== null && row.previousTheaters !== null
                  ? row.theaters - row.previousTheaters
                  : null;
                const average = row.theaters && row.theaters > 0 ? row.gross / row.theaters : null;

                return (
                  <tr key={row.key} className="hover:bg-muted/20 transition-colors">
                    <td className="whitespace-nowrap border-b px-2 py-3 font-semibold text-primary">
                      {row.date}
                    </td>
                    <td className="border-b px-3 py-3 text-center">
                      {row.rank ?? '—'}
                    </td>
                    <td className="whitespace-nowrap border-b px-3 py-3 text-right font-semibold">
                      {exactMoney(row.gross)}
                    </td>
                    <td className={`whitespace-nowrap border-b px-3 py-3 text-right ${
                      grossChange === null
                        ? 'text-muted-foreground'
                        : grossChange >= 0 ? 'text-green-500' : 'text-red-500'
                    }`}>
                      {grossChange === null ? '—' : `${grossChange >= 0 ? '+' : ''}${grossChange.toFixed(1)}%`}
                    </td>
                    <td className="whitespace-nowrap border-b px-3 py-3 text-right">
                      {row.theaters === null ? '—' : row.theaters.toLocaleString('en-US')}
                    </td>
                    <td className={`whitespace-nowrap border-b px-3 py-3 text-right ${
                      theaterChange === null
                        ? 'text-muted-foreground'
                        : theaterChange >= 0 ? 'text-green-500' : 'text-red-500'
                    }`}>
                      {theaterChange === null ? '—' : `${theaterChange >= 0 ? '+' : ''}${theaterChange.toLocaleString('en-US')}`}
                    </td>
                    <td className="whitespace-nowrap border-b px-3 py-3 text-right">
                      {average === null ? '—' : exactMoney(average)}
                    </td>
                    <td className="whitespace-nowrap border-b px-3 py-3 text-right font-semibold">
                      {exactMoney(row.grossToDate)}
                    </td>
                    <td className="border-b px-2 py-3 text-center">
                      {row.periodLabel}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function ScoreCircle({ score, label, type }: { score: number; label: string; type: 'critic' | 'audience' }) {
  const displayScore = type === 'audience' ? Math.round(score * 10) : Math.round(score);
  const color = displayScore >= 70 ? 'text-green-600 border-green-500 bg-green-50 dark:bg-green-900/20' :
                displayScore >= 50 ? 'text-yellow-600 border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20' :
                'text-red-600 border-red-500 bg-red-50 dark:bg-red-900/20';
  
  return (
    <div className="flex flex-col items-center">
      <div className={`w-20 h-20 rounded-full border-4 flex items-center justify-center ${color}`}>
        <span className="text-2xl font-bold">{displayScore}</span>
      </div>
      <span className="mt-2 text-sm text-muted-foreground">{label}</span>
    </div>
  );
}

export function FilmDetail({ filmId }: FilmDetailProps) {
  const { state } = useGame();
  const [showCampaign, setShowCampaign] = useState(false);
  const [showAllMarkets, setShowAllMarkets] = useState(false);

  const { data: allFilms = [] } = useQuery<Film[]>({
    queryKey: ['/api/all-films', state.studioId],
  });

  const { data: allStudios = [] } = useQuery<Studio[]>({
    queryKey: ['/api/studios', state.studioId],
  });

  const { data: allTalent = [] } = useQuery<Talent[]>({
    queryKey: ['/api/talent'],
  });

  const { data: nominations = [] } = useQuery<AwardNomination[]>({
    queryKey: ['/api/nominations', state.studioId],
    enabled: !!state.studioId,
  });

  const { data: filmRoles = [] } = useQuery<FilmRole[]>({
    queryKey: [`/api/films/${filmId}/roles`],
    enabled: !!filmId,
  });

  const [actualMarketingBudget, setActualMarketingBudget] = useState<number>(0);
  const [filmReleases, setFilmReleases] = useState<FilmRelease[]>([]);

  const film = useMemo(() => allFilms.find(f => f.id === filmId), [allFilms, filmId]);

  useEffect(() => {
    setShowAllMarkets(false);
  }, [filmId]);

  // Fetch marketing budget from releases (same as FilmLibrary)
  useEffect(() => {
    if (film) {
      fetch(`/api/films/${film.id}/releases`)
        .then(res => res.json())
        .then((releases: FilmRelease[]) => {
          setFilmReleases(releases);
          const releaseWithMarketing = releases.find(r => r.marketingBudget && r.marketingBudget > 0);
          const marketingFromReleases = releaseWithMarketing?.marketingBudget || 0;
          setActualMarketingBudget(marketingFromReleases || film.marketingBudget || 0);
        })
        .catch(() => {
          setFilmReleases([]);
          setActualMarketingBudget(film.marketingBudget || 0);
        });
    } else {
      setFilmReleases([]);
      setActualMarketingBudget(0);
    }
  }, [film]);
  const studio = useMemo(() => film ? allStudios.find(s => s.id === film.studioId) : null, [allStudios, film]);
  const talentMap = useMemo(() => new Map(allTalent.map(t => [t.id, t])), [allTalent]);

  const director = useMemo(() => film?.directorId ? talentMap.get(film.directorId) : null, [film, talentMap]);
  const writer = useMemo(() => film?.writerId ? talentMap.get(film.writerId) : null, [film, talentMap]);
  const composer = useMemo(() => film?.composerId ? talentMap.get(film.composerId) : null, [film, talentMap]);
  const cast = useMemo(() => {
    if (!film?.castIds) return [];
    return film.castIds.map(id => {
      const actor = talentMap.get(id);
      if (!actor) return null;
      // Find the role for this actor
      const role = filmRoles.find(r => r.actorId === id);
      return {
        ...actor,
        roleName: role?.roleName || 'Unknown Role',
      };
    }).filter(Boolean) as (Talent & { roleName: string })[];
  }, [film, talentMap, filmRoles]);

  const filmAwards = useMemo(() => {
    if (!film) return { wins: [], nominations: [] };
    const filmNoms = nominations.filter(n => n.filmId === film.id);
    return {
      wins: filmNoms.filter(n => n.isWinner),
      nominations: filmNoms.filter(n => !n.isWinner),
    };
  }, [film, nominations]);

  const performanceContext = useMemo(() => {
    const empty = {
      ranks: [] as Array<number | null>,
      theaterCounts: [] as Array<number | null>,
    };
    if (!film?.releaseWeek || !film.releaseYear || !film.weeklyBoxOffice?.length) return empty;

    const targetRelease = film.releaseYear * 52 + film.releaseWeek - 1;
    const domesticRelease = filmReleases.find(release =>
      ['NA', 'North America', 'Domestic'].includes(release.territoryCode));
    const capacityHistory = Array.isArray(domesticRelease?.weeklyCapacityBreakdown)
      ? domesticRelease.weeklyCapacityBreakdown as Array<Record<string, unknown>>
      : [];
    const domesticWeeks = film.weeklyBoxOffice.map((_, index) =>
      domesticGrossForFilmWeek(film, index));
    const maximumDomesticTheaters = 4_600;
    let previousTheaters = 0;
    const theaterCounts = domesticWeeks.map((gross, index) => {
      const recorded = Number(capacityHistory[index]?.theaterCount || 0);
      if (recorded > 0) {
        previousTheaters = Math.min(maximumDomesticTheaters, recorded);
        return previousTheaters;
      }

      // Older saves did not retain theater history. Reconstruct it forward
      // with the same performance principle as the live allocator, keeping
      // the estimate inside the real North American theatrical range.
      if (index === 0 || previousTheaters <= 0) {
        previousTheaters = Math.round(Math.max(40, Math.min(
          maximumDomesticTheaters,
          500 + 4_000 * Math.sqrt(Math.max(0, gross) / 100_000_000),
        )));
        return previousTheaters;
      }
      const previousGross = Math.max(1, domesticWeeks[index - 1] || 0);
      const grossPerTheater = gross / Math.max(1, previousTheaters);
      const weeklyHold = Math.max(0, Math.min(1.5, gross / previousGross));
      let multiplier = grossPerTheater >= 7_500 ? 1.04
        : grossPerTheater >= 5_000 ? 1
        : grossPerTheater >= 3_000 ? 0.94
        : grossPerTheater >= 1_800 ? 0.86
        : grossPerTheater >= 1_000 ? 0.76
        : grossPerTheater >= 500 ? 0.64
        : 0.48;
      if (weeklyHold >= 0.72) multiplier += 0.05;
      else if (weeklyHold < 0.32) multiplier -= 0.06;
      multiplier -= Math.min(0.18, Math.max(0, index - 5) * 0.025);
      const contractionFloor = previousTheaters * (index >= 10 ? 0.5 : 0.65);
      previousTheaters = Math.round(Math.max(
        40,
        contractionFloor,
        Math.min(maximumDomesticTheaters, previousTheaters * 1.12, previousTheaters * multiplier),
      ));
      return previousTheaters;
    });
    const ranks = film.weeklyBoxOffice.map((_, index) => {
      const calendarWeek = targetRelease + index;
      const market = allFilms.map(candidate => {
        if (!candidate.releaseWeek || !candidate.releaseYear) return null;
        const candidateRelease = candidate.releaseYear * 52 + candidate.releaseWeek - 1;
        const candidateIndex = calendarWeek - candidateRelease;
        const gross = candidateIndex >= 0 && candidateIndex < (candidate.weeklyBoxOffice?.length || 0)
          ? Number(candidate.weeklyBoxOffice?.[candidateIndex] || 0)
          : 0;
        return gross > 0 ? { id: candidate.id, gross } : null;
      }).filter((entry): entry is { id: string; gross: number } => entry !== null)
        .sort((left, right) => right.gross - left.gross);
      const rank = market.findIndex(entry => entry.id === film.id);
      return rank >= 0 ? rank + 1 : null;
    });
    return { ranks, theaterCounts };
  }, [film, filmReleases, allFilms]);

  const grossStats = useMemo(() => {
    if (!film) return null;
    const totalByCountry = film.totalBoxOfficeByCountry as Record<string, number> | null;
    const weeklyByCountry = Array.isArray(film.weeklyBoxOfficeByCountry)
      ? film.weeklyBoxOfficeByCountry as Array<Record<string, number>>
      : [];
    
    const domesticGross = totalByCountry?.['North America'] || totalByCountry?.['NA'] || 
      Math.floor(film.totalBoxOffice * 0.4);
    const internationalGross = film.totalBoxOffice - domesticGross;
    const domesticPercent = film.totalBoxOffice > 0 ? (domesticGross / film.totalBoxOffice * 100).toFixed(1) : '0';
    const intlPercent = film.totalBoxOffice > 0 ? (internationalGross / film.totalBoxOffice * 100).toFixed(1) : '0';
    
    // Use totalBudget which includes all production costs + marketing
    const investmentBudget = film.totalBudget || 0;
    
    const profit = film.totalBoxOffice - investmentBudget;
    const roi = investmentBudget > 0 ? (profit / investmentBudget * 100) : 0;

    const openingWeekend = film.weeklyBoxOffice?.[0] || 0;
    const weeklyData = film.weeklyBoxOffice || [];
    
    // Get opening weekend per country (first week's data)
    const openingByCountry: Record<string, number> = {};
    if (weeklyByCountry && weeklyByCountry.length > 0) {
      const firstWeek = weeklyByCountry[0];
      Object.entries(firstWeek).forEach(([country, gross]) => {
        openingByCountry[country] = gross;
      });
    }
    
    // Country breakdown with opening weekend - sort by gross descending
    const countryBreakdown = totalByCountry 
      ? Object.entries(totalByCountry)
          .map(([country, gross]) => ({
            country,
            gross,
            opening: openingByCountry[country] || 0,
            percent: film.totalBoxOffice > 0 ? (gross / film.totalBoxOffice * 100) : 0
          }))
          .sort((a, b) => b.gross - a.gross)
      : [];
    
    // Separate domestic and international markets
    const domesticMarkets = countryBreakdown.filter(c => 
      c.country === 'North America' || c.country === 'NA' || c.country === 'Domestic'
    );
    const internationalMarkets = countryBreakdown.filter(c => 
      c.country !== 'North America' && c.country !== 'NA' && c.country !== 'Domestic'
    );

    return {
      domesticGross,
      internationalGross,
      worldwideGross: film.totalBoxOffice,
      domesticPercent,
      intlPercent,
      investmentBudget,
      profit,
      roi,
      openingWeekend,
      weeklyData,
      weeklyByCountry,
      countryBreakdown,
      domesticMarkets,
      internationalMarkets,
    };
  }, [film]);

  if (!film) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <FilmIcon className="w-12 h-12 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">Film Not Found</h2>
        <p className="text-muted-foreground mb-4">The requested film could not be found.</p>
        <Link href="/insider">
          <Button variant="outline">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Hollywood Insider
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <Link href="/insider">
        <Button variant="ghost" size="sm">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Hollywood Insider
        </Button>
      </Link>

      {/* Header Section */}
      <div className="flex gap-6">
        {/* Poster */}
        <div className="flex-shrink-0">
          {film.posterUrl ? (
            <img 
              src={film.posterUrl} 
              alt={film.title}
              className="w-48 h-72 object-cover rounded-lg shadow-lg"
            />
          ) : (
            <div className="w-48 h-72 bg-muted rounded-lg flex items-center justify-center">
              <FilmIcon className="w-16 h-16 text-muted-foreground" />
            </div>
          )}
        </div>

        {/* Title & Basic Info */}
        <div className="flex-1">
          <h1 className="text-4xl font-bold mb-2">{film.title}</h1>
          {film.synopsis && (
            <p className="text-lg text-muted-foreground italic mb-4 line-clamp-2">{film.synopsis}</p>
          )}
          
          <div className="flex flex-wrap gap-2 mb-4">
            <Badge variant="secondary" className="text-sm">
              {genreLabels[film.genre as keyof typeof genreLabels] || film.genre}
            </Badge>
            {film.releaseYear && film.releaseWeek && (
              <Badge variant="outline" className="text-xs">
                <div className="flex items-start gap-1">
                  <Calendar className="w-3 h-3 mt-0.5" />
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs">{formatReleaseDate(film.releaseWeek, film.releaseYear)}</span>
                    <span className="text-xs opacity-75 text-right">Week {film.releaseWeek}</span>
                  </div>
                </div>
              </Badge>
            )}
            {film.releaseWeek && (
              <Button size="sm" variant="outline" onClick={() => setShowCampaign(true)}>
                <Megaphone className="w-4 h-4 mr-2" />
                Manage Campaign
              </Button>
            )}
          </div>

          {/* Key Stats Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
            <div>
              <p className="text-sm text-muted-foreground">Studio</p>
              <p className="font-medium flex items-center gap-1">
                <Building2 className="w-4 h-4" />
                {studio?.name || 'Unknown'}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Director</p>
              <p className="font-medium flex items-center gap-1">
                <Clapperboard className="w-4 h-4" />
                {director?.name || 'Unknown'}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Writer</p>
              <p className="font-medium flex items-center gap-1">
                <PenTool className="w-4 h-4" />
                {writer?.name || 'Unknown'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Scores Section */}
      <Card>
        <CardHeader>
          <CardTitle>Scores</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center gap-16">
            <ScoreCircle 
              score={film.audienceScore || 5} 
              label="Audience" 
              type="audience" 
            />
            <ScoreCircle 
              score={film.criticScore || 50} 
              label="Critics" 
              type="critic" 
            />
          </div>
        </CardContent>
      </Card>

      {/* Opening Weekend Highlight - Box Office Mojo Style */}
      {grossStats && grossStats.openingWeekend > 0 && (
        <Card className="bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-primary/20 rounded-full">
                  <TrendingUp className="w-8 h-8 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground uppercase tracking-wide">Opening Weekend</p>
                  <p className="text-4xl font-bold text-primary">{formatMoney(grossStats.openingWeekend)}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Legs</p>
                <p className="text-2xl font-semibold">
                  {grossStats.openingWeekend > 0 
                    ? (grossStats.worldwideGross / grossStats.openingWeekend).toFixed(2) 
                    : 0}x
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Box Office Summary - Box Office Mojo Style */}
      {grossStats && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="w-5 h-5" />
              Box Office Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Worldwide Total */}
              <div className="lg:col-span-1 p-6 bg-muted/50 rounded-lg text-center">
                <Globe className="w-8 h-8 mx-auto mb-2 text-primary" />
                <p className="text-sm text-muted-foreground uppercase tracking-wide">Worldwide</p>
                <p className="text-3xl font-bold text-primary">{formatMoney(grossStats.worldwideGross)}</p>
              </div>
              
              {/* Domestic & International */}
              <div className="lg:col-span-2 grid grid-cols-2 gap-4">
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <MapPin className="w-4 h-4 text-blue-600" />
                    <p className="text-sm text-muted-foreground uppercase tracking-wide">Domestic</p>
                  </div>
                  <p className="text-2xl font-bold">{formatMoney(grossStats.domesticGross)}</p>
                  <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-blue-500 rounded-full" 
                      style={{ width: `${grossStats.domesticPercent}%` }}
                    />
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{grossStats.domesticPercent}% of worldwide</p>
                </div>
                
                <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Globe className="w-4 h-4 text-green-600" />
                    <p className="text-sm text-muted-foreground uppercase tracking-wide">International</p>
                  </div>
                  <p className="text-2xl font-bold">{formatMoney(grossStats.internationalGross)}</p>
                  <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-green-500 rounded-full" 
                      style={{ width: `${grossStats.intlPercent}%` }}
                    />
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{grossStats.intlPercent}% of worldwide</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Box Office Mojo-style week-by-week run */}
      {grossStats && grossStats.weeklyData.length > 0 && (
        <WeeklyPerformanceTracker
          filmId={film.id}
          weeklyData={grossStats.weeklyData}
          weeklyByCountry={grossStats.weeklyByCountry}
          filmReleases={filmReleases}
          allFilms={allFilms}
          releaseWeek={film.releaseWeek}
          releaseYear={film.releaseYear}
          ranks={performanceContext.ranks}
          theaterCounts={performanceContext.theaterCounts}
        />
      )}

      {/* Compact, expandable international market breakdown */}
      {grossStats && grossStats.countryBreakdown.length > 0 && (
        <Card>
          <CardHeader className="p-5 pb-3">
            <CardTitle className="flex items-center gap-2">
              <Globe className="w-5 h-5" />
              International Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5 pt-0">
            {(() => {
              const collapsedMarketCount = 12;
              const allMarkets = grossStats.countryBreakdown;
              const hiddenMarkets = allMarkets.slice(collapsedMarketCount);
              const visibleMarkets = showAllMarkets
                ? allMarkets
                : allMarkets.slice(0, collapsedMarketCount);
              const hiddenMarketGross = hiddenMarkets.reduce((total, market) => total + market.gross, 0);

              return (
                <>
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
                    {visibleMarkets.map(({ country, gross, opening, percent }, index) => (
                      <div
                        key={country}
                        className="relative flex min-h-14 items-center justify-between overflow-hidden rounded-md bg-muted/25 px-4 py-2.5 pl-5"
                      >
                        <span
                          className={`absolute inset-y-2 left-0 w-1.5 rounded-full ${index === 0 ? 'bg-primary' : 'bg-primary/35'}`}
                          aria-hidden="true"
                        />
                        <span className="truncate pr-3 text-sm font-medium">{country}</span>
                        <div className="shrink-0 text-right">
                          <div className="text-sm font-semibold">
                            {formatCompactMoney(gross)}
                            <span className="ml-1 font-normal text-muted-foreground">
                              ({percent.toFixed(1)}%)
                            </span>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            OW: {formatCompactMoney(opening)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {hiddenMarkets.length > 0 && (
                    <button
                      type="button"
                      className="mt-4 w-full border-t pt-4 text-center text-sm text-muted-foreground transition-colors hover:text-foreground"
                      onClick={() => setShowAllMarkets(current => !current)}
                      aria-expanded={showAllMarkets}
                    >
                      {showAllMarkets
                        ? 'Show fewer markets'
                        : `+ ${hiddenMarkets.length} more markets (${formatCompactMoney(hiddenMarketGross)} total)`}
                    </button>
                  )}
                </>
              );
            })()}
          </CardContent>
        </Card>
      )}

      {/* Financial Performance */}
      {grossStats && (
        <Card>
          <CardHeader>
            <CardTitle>Financial Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {(() => {
                // Use same calculation as BoxOfficeDetail
                const investmentBudget = (film.productionBudget || 0) + 
                  (film.setsBudget || 0) + (film.costumesBudget || 0) + (film.stuntsBudget || 0) + 
                  (film.makeupBudget || 0) + (film.practicalEffectsBudget || 0) + (film.soundCrewBudget || 0) +
                  (film.talentBudget || 0);
                const totalInvestment = investmentBudget + actualMarketingBudget;
                // Studios get 70% of box office revenue
                const studioRevenue = film.totalBoxOffice * 0.7;
                const profit = studioRevenue - totalInvestment;
                const roi = totalInvestment > 0 ? (profit / totalInvestment * 100) : 0;
                return (
                  <>
                    <div className="p-4 bg-muted/50 rounded-lg">
                      <p className="text-sm text-muted-foreground">Production Budget</p>
                      <p className="text-xl font-bold">{formatCompactMoney(investmentBudget)}</p>
                    </div>
                    {actualMarketingBudget > 0 && (
                      <div className="p-4 bg-muted/50 rounded-lg">
                        <p className="text-sm text-muted-foreground">Marketing Budget</p>
                        <p className="text-xl font-bold">{formatCompactMoney(actualMarketingBudget)}</p>
                      </div>
                    )}
                    <div className="p-4 bg-muted/50 rounded-lg">
                      <p className="text-sm text-muted-foreground">Total Investment</p>
                      <p className="text-xl font-bold">{formatCompactMoney(totalInvestment)}</p>
                    </div>
                    <div className={`p-4 rounded-lg ${profit >= 0 ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'}`}>
                      <p className="text-sm text-muted-foreground">Profit/Loss</p>
                      <p className={`text-xl font-bold ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {profit >= 0 ? '+' : ''}{formatCompactMoney(profit)}
                      </p>
                    </div>
                    <div className={`p-4 rounded-lg ${roi >= 0 ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'}`}>
                      <p className="text-sm text-muted-foreground">Return on Investment</p>
                      <p className={`text-xl font-bold ${roi >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {roi >= 0 ? '+' : ''}{roi.toFixed(1)}%
                      </p>
                    </div>
                  </>
                );
              })()}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Cast Section */}
      {cast.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Cast
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y">
              {cast.map((actor, index) => (
                <Link key={actor.id} href={`/talent/${actor.id}`}>
                  <div className="flex items-center justify-between py-3 hover:bg-muted/50 px-2 -mx-2 rounded-lg transition-colors cursor-pointer">
                    <div className="flex items-center gap-3">
                      {actor.imageUrl ? (
                        <img 
                          src={actor.imageUrl} 
                          alt={actor.name}
                          className="w-10 h-10 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                          <Users className="w-5 h-5 text-muted-foreground" />
                        </div>
                      )}
                      <span className="font-medium hover:underline">{actor.name}</span>
                    </div>
                    <span className="text-muted-foreground">{actor.roleName}</span>
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Crew Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clapperboard className="w-5 h-5" />
            Crew
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="divide-y">
            {director && (
              <Link href={`/talent/${director.id}`}>
                <div className="flex items-center justify-between py-3 hover:bg-muted/50 px-2 -mx-2 rounded-lg transition-colors cursor-pointer">
                  <div className="flex items-center gap-3">
                    {director.imageUrl ? (
                      <img 
                        src={director.imageUrl} 
                        alt={director.name}
                        className="w-10 h-10 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                        <Clapperboard className="w-5 h-5 text-muted-foreground" />
                      </div>
                    )}
                    <span className="font-medium hover:underline">{director.name}</span>
                  </div>
                  <span className="text-muted-foreground">Director</span>
                </div>
              </Link>
            )}
            {writer && (
              <Link href={`/talent/${writer.id}`}>
                <div className="flex items-center justify-between py-3 hover:bg-muted/50 px-2 -mx-2 rounded-lg transition-colors cursor-pointer">
                  <div className="flex items-center gap-3">
                    {writer.imageUrl ? (
                      <img 
                        src={writer.imageUrl} 
                        alt={writer.name}
                        className="w-10 h-10 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                        <PenTool className="w-5 h-5 text-muted-foreground" />
                      </div>
                    )}
                    <span className="font-medium hover:underline">{writer.name}</span>
                  </div>
                  <span className="text-muted-foreground">Writer</span>
                </div>
              </Link>
            )}
            {composer && (
              <Link href={`/talent/${composer.id}`}>
                <div className="flex items-center justify-between py-3 hover:bg-muted/50 px-2 -mx-2 rounded-lg transition-colors cursor-pointer">
                  <div className="flex items-center gap-3">
                    {composer.imageUrl ? (
                      <img 
                        src={composer.imageUrl} 
                        alt={composer.name}
                        className="w-10 h-10 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                        <Music className="w-5 h-5 text-muted-foreground" />
                      </div>
                    )}
                    <span className="font-medium hover:underline">{composer.name}</span>
                  </div>
                  <span className="text-muted-foreground">Composer</span>
                </div>
              </Link>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Awards Section - Always visible */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="w-5 h-5" />
            Awards
            {(filmAwards.wins.length > 0 || filmAwards.nominations.length > 0) && (
              <span className="text-sm font-normal text-muted-foreground ml-2">
                {filmAwards.wins.length} Win{filmAwards.wins.length !== 1 ? 's' : ''} • {filmAwards.nominations.length} Nomination{filmAwards.nominations.length !== 1 ? 's' : ''}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {(filmAwards.wins.length > 0 || filmAwards.nominations.length > 0) ? (
            <div className="space-y-4">
              {filmAwards.wins.length > 0 && (
                <div>
                  <h4 className="font-semibold text-yellow-500 mb-3 flex items-center gap-2">
                    <Trophy className="w-4 h-4" />
                    Wins ({filmAwards.wins.length})
                  </h4>
                  <div className="space-y-2">
                    {filmAwards.wins.map((award, index) => (
                      <div key={index} className="flex items-center gap-3 p-3 rounded-lg border border-yellow-500/50 bg-yellow-500/10">
                        <Trophy className="w-5 h-5 text-yellow-500" />
                        <div>
                          <p className="font-medium">
                            {award.categoryId.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                          </p>
                          <p className="text-sm text-muted-foreground">{award.ceremonyYear}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {filmAwards.nominations.length > 0 && (
                <div>
                  <h4 className="font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                    <Trophy className="w-4 h-4" />
                    Nominations ({filmAwards.nominations.length})
                  </h4>
                  <div className="space-y-2">
                    {filmAwards.nominations.map((award, index) => (
                      <div key={index} className="flex items-center gap-3 p-3 rounded-lg border border-border">
                        <Trophy className="w-5 h-5 text-muted-foreground" />
                        <div>
                          <p className="font-medium">
                            {award.categoryId.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                          </p>
                          <p className="text-sm text-muted-foreground">{award.ceremonyYear}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="py-8 text-center text-muted-foreground">
              No awards or nominations yet
            </div>
          )}
        </CardContent>
      </Card>
      <MarketingCampaign
        film={film}
        open={showCampaign}
        onOpenChange={setShowCampaign}
      />
    </div>
  );
}
