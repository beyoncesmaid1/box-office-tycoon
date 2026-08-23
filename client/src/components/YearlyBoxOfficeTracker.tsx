import { useEffect, useMemo, useState } from 'react';
import {
  CalendarRange,
  ChevronDown,
  LineChart as LineChartIcon,
  TrendingUp,
} from 'lucide-react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { Film } from '@shared/schema';

interface YearlyBoxOfficeTrackerProps {
  films: Film[];
  currentYear: number;
  currentWeek: number;
}

const YEAR_COLORS = [
  '#fbbf24',
  '#60a5fa',
  '#34d399',
  '#f472b6',
  '#a78bfa',
  '#fb923c',
  '#22d3ee',
  '#f87171',
  '#a3e635',
  '#c084fc',
] as const;

function exactMoney(amount: number): string {
  if (amount >= 1_000_000_000) return `$${(amount / 1_000_000_000).toFixed(2)}B`;
  return `$${(amount / 1_000_000).toFixed(1)}M`;
}

function WeeklyTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="min-w-[170px] rounded-xl border border-border bg-background/95 p-3 shadow-2xl backdrop-blur">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Week {label}</p>
      <div className="space-y-1.5">
        {payload.map((entry: any) => (
          <div key={entry.dataKey} className="flex items-center justify-between gap-5 text-sm">
            <span className="flex items-center gap-2 text-muted-foreground">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
              {entry.name}
            </span>
            <span className="font-semibold tabular-nums">${Number(entry.value || 0).toFixed(1)}M</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function YearlyBoxOfficeTracker({
  films,
  currentYear,
  currentWeek,
}: YearlyBoxOfficeTrackerProps) {
  const yearlyGrosses = useMemo(() => {
    const totals = new Map<number, number[]>();
    for (const film of films) {
      if (!film.releaseYear || !film.releaseWeek || !film.weeklyBoxOffice?.length) continue;
      const openingAbsoluteWeek = film.releaseYear * 52 + (film.releaseWeek - 1);
      film.weeklyBoxOffice.forEach((gross, weekIndex) => {
        const absoluteWeek = openingAbsoluteWeek + weekIndex;
        const year = Math.floor(absoluteWeek / 52);
        const week = (absoluteWeek % 52) + 1;
        if (year > currentYear) return;
        const weeks = totals.get(year) || Array(52).fill(0);
        weeks[week - 1] += Math.max(0, Number(gross || 0));
        totals.set(year, weeks);
      });
    }
    return totals;
  }, [films, currentYear]);

  const availableYears = useMemo(
    () => Array.from(yearlyGrosses.keys()).sort((a, b) => b - a),
    [yearlyGrosses],
  );
  const [selectedYears, setSelectedYears] = useState<number[]>([]);

  useEffect(() => {
    setSelectedYears(current => {
      const stillAvailable = current.filter(year => availableYears.includes(year));
      return stillAvailable.length > 0 ? stillAvailable : availableYears.slice(0, 1);
    });
  }, [availableYears]);

  const colorByYear = useMemo(() => {
    const colors = new Map<number, string>();
    availableYears.forEach((year, index) => colors.set(year, YEAR_COLORS[index % YEAR_COLORS.length]));
    return colors;
  }, [availableYears]);

  const chartData = useMemo(() => Array.from({ length: 52 }, (_, index) => {
    const week = index + 1;
    const point: Record<string, number | null> = { week };
    for (const year of selectedYears) {
      const isFuture = year === currentYear && week > currentWeek;
      point[`year${year}`] = isFuture
        ? null
        : (yearlyGrosses.get(year)?.[index] || 0) / 1_000_000;
    }
    return point;
  }), [selectedYears, yearlyGrosses, currentYear, currentWeek]);

  const selectedSummaries = useMemo(() => selectedYears.map(year => {
    const weekly = yearlyGrosses.get(year) || [];
    const visibleWeeks = year === currentYear ? weekly.slice(0, currentWeek) : weekly;
    const total = visibleWeeks.reduce((sum, gross) => sum + gross, 0);
    const peak = visibleWeeks.reduce(
      (best, gross, index) => gross > best.gross ? { week: index + 1, gross } : best,
      { week: 1, gross: 0 },
    );
    return { year, total, peak };
  }), [selectedYears, yearlyGrosses, currentYear, currentWeek]);

  const toggleYear = (year: number) => {
    setSelectedYears(current => current.includes(year)
      ? (current.length === 1 ? current : current.filter(item => item !== year))
      : [...current, year].sort((a, b) => b - a));
  };

  if (availableYears.length === 0) return null;

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card/55">
      <div className="flex flex-col gap-4 border-b border-border px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <LineChartIcon className="h-5 w-5 text-amber-400" />
            Yearly Box Office Tracker
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Worldwide theatrical gross by calendar week · $ millions
          </p>
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="h-9 justify-between gap-3 bg-background/50">
              <CalendarRange className="h-4 w-4 text-amber-400" />
              Compare years
              <span className="rounded-full bg-amber-400 px-1.5 py-0.5 text-[10px] font-bold text-black">
                {selectedYears.length}
              </span>
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-56 p-2">
            <p className="px-2 pb-2 pt-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Years shown
            </p>
            <div className="max-h-64 space-y-1 overflow-y-auto sleek-scrollbar">
              {availableYears.map(year => {
                const checked = selectedYears.includes(year);
                return (
                  <label
                    key={year}
                    className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 text-sm hover:bg-muted/60"
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() => toggleYear(year)}
                      disabled={checked && selectedYears.length === 1}
                    />
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: colorByYear.get(year) }} />
                    <span className="flex-1 font-medium">{year}</span>
                  </label>
                );
              })}
            </div>
          </PopoverContent>
        </Popover>
      </div>

      <div className="px-2 pb-2 pt-5 sm:px-5">
        <div className="mb-3 flex flex-wrap gap-x-5 gap-y-2 px-3">
          {selectedYears.map(year => (
            <div key={year} className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: colorByYear.get(year) }} />
              {year}
            </div>
          ))}
        </div>
        <div className="h-[340px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 8, right: 16, left: 4, bottom: 2 }}>
              <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeOpacity={0.55} strokeDasharray="3 5" />
              <XAxis
                dataKey="week"
                axisLine={false}
                tickLine={false}
                interval={3}
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                label={{ value: 'Week of year', position: 'insideBottom', offset: -1, fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                height={34}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                width={62}
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                tickFormatter={value => `$${Number(value).toFixed(0)}M`}
              />
              <Tooltip content={<WeeklyTooltip />} cursor={{ stroke: 'hsl(var(--muted-foreground))', strokeDasharray: '3 4' }} />
              {selectedYears.map(year => (
                <Line
                  key={year}
                  type="monotone"
                  dataKey={`year${year}`}
                  name={year.toString()}
                  stroke={colorByYear.get(year)}
                  strokeWidth={2.5}
                  connectNulls={false}
                  dot={{ r: 1.7, fill: colorByYear.get(year), strokeWidth: 0 }}
                  activeDot={{ r: 5, fill: colorByYear.get(year), stroke: 'hsl(var(--background))', strokeWidth: 2 }}
                  animationDuration={450}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid gap-px border-t border-border bg-border sm:grid-cols-2 xl:grid-cols-4">
        {selectedSummaries.map(({ year, total, peak }) => (
          <div key={year} className="bg-card px-5 py-4">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-sm font-semibold">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: colorByYear.get(year) }} />
                {year}
              </span>
              <TrendingUp className="h-4 w-4 text-muted-foreground/50" />
            </div>
            <p className="mt-3 text-xl font-bold tabular-nums">{exactMoney(total)}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Peak: Week {peak.week} · {exactMoney(peak.gross)}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
