import { useMemo, useState } from 'react';
import { Link } from 'wouter';
import {
  ArrowUpRight,
  Award,
  CalendarDays,
  ChevronRight,
  CircleDollarSign,
  Clapperboard,
  Crown,
  Film as FilmIcon,
  Globe2,
  Landmark,
  Medal,
  Rocket,
  Sparkles,
  Star,
  Trophy,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { genreLabels } from '@/lib/gameState';
import { getGenrePoster } from '@/lib/genrePosters';
import type { Film } from '@shared/schema';
import {
  dailyPerformanceProfile,
  distributeWeeklyGrossAcrossDays,
} from './FilmDetail';

export interface HollywoodRecordFilm extends Film {
  studioName: string;
  domesticGross: number;
  internationalGross: number;
  worldwideGross: number;
  profit: number;
  roi: number;
}

interface HollywoodRecordsProps {
  films: HollywoodRecordFilm[];
}

interface RecordEntry {
  film: HollywoodRecordFilm;
  value: number;
  display: string;
}

interface RecordCategory {
  key: string;
  label: string;
  description: string;
  entries: RecordEntry[];
  icon: LucideIcon;
  color: string;
}

function compactMoney(amount: number): string {
  if (amount >= 1_000_000_000) return `$${(amount / 1_000_000_000).toFixed(2)}B`;
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `$${Math.round(amount / 1_000)}K`;
  return `$${Math.round(amount).toLocaleString('en-US')}`;
}

function profitMoney(amount: number): string {
  return `${amount >= 0 ? '+' : '-'}${compactMoney(Math.abs(amount))}`;
}

function audienceScore100(film: Film): number {
  return film.audienceScore <= 10 ? film.audienceScore * 10 : film.audienceScore;
}

function openingWeekendGross(film: Film): number {
  const openingWeek = Number(film.weeklyBoxOffice?.[0] || 0);
  if (openingWeek <= 0) return 0;
  const eventIntensity = Number(
    (film.boxOfficeBreakdown as Record<string, unknown> | null)?.peakEventIntensity || 0,
  );
  return distributeWeeklyGrossAcrossDays({
    filmId: film.id,
    weeklyGross: openingWeek,
    weekIndex: 0,
    previousWeeklyGross: 0,
    openingWeeklyGross: openingWeek,
    profile: dailyPerformanceProfile(film.genre, film.isSequel),
    audienceScore: audienceScore100(film),
    eventIntensity,
    calendarWeek: film.releaseWeek || undefined,
  }).slice(0, 3).reduce((sum, gross) => sum + gross, 0);
}

function FilmLink({ film, className = '' }: { film: HollywoodRecordFilm; className?: string }) {
  return (
    <Link
      href={`/film/${film.id}`}
      className={`group inline-flex min-w-0 items-center gap-1 hover:text-amber-400 ${className}`}
    >
      <span className="truncate">{film.title}</span>
      <ArrowUpRight className="h-3.5 w-3.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
    </Link>
  );
}

export function HollywoodRecords({ films }: HollywoodRecordsProps) {
  const [selectedRecordKey, setSelectedRecordKey] = useState<string | null>(null);
  const data = useMemo(() => {
    const byWorldwide = [...films].sort((a, b) => b.worldwideGross - a.worldwideGross);
    const byDomestic = [...films].sort((a, b) => b.domesticGross - a.domesticGross);
    const byInternational = [...films].sort((a, b) => b.internationalGross - a.internationalGross);
    const byOpening = films
      .map(film => ({ film, value: openingWeekendGross(film) }))
      .sort((a, b) => b.value - a.value);
    const byAudience = [...films].sort((a, b) =>
      audienceScore100(b) - audienceScore100(a) || b.worldwideGross - a.worldwideGross,
    );
    const byCritics = [...films].sort((a, b) =>
      b.criticScore - a.criticScore || b.worldwideGross - a.worldwideGross,
    );
    const byProfit = [...films].sort((a, b) => b.profit - a.profit);

    const yearlyMap = new Map<number, HollywoodRecordFilm>();
    for (const film of byWorldwide) {
      if (film.releaseYear && !yearlyMap.has(film.releaseYear)) yearlyMap.set(film.releaseYear, film);
    }
    const yearlyChampions = Array.from(yearlyMap.entries())
      .sort(([yearA], [yearB]) => yearB - yearA);

    const genreMap = new Map<string, HollywoodRecordFilm>();
    for (const film of byWorldwide) {
      if (!genreMap.has(film.genre)) genreMap.set(film.genre, film);
    }
    const genreChampions = Array.from(genreMap.entries())
      .sort(([, filmA], [, filmB]) => filmB.worldwideGross - filmA.worldwideGross);

    const holders: RecordCategory[] = [
      {
        key: 'opening-weekend',
        label: 'Opening Weekend',
        description: 'The largest worldwide Friday-through-Sunday openings.',
        entries: byOpening.map(({ film, value }) => ({ film, value, display: compactMoney(value) })),
        icon: Rocket,
        color: 'text-orange-400',
      },
      {
        key: 'domestic-gross',
        label: 'Domestic Gross',
        description: 'The highest North American theatrical grosses.',
        entries: byDomestic.map(film => ({
          film,
          value: film.domesticGross,
          display: compactMoney(film.domesticGross),
        })),
        icon: Landmark,
        color: 'text-blue-400',
      },
      {
        key: 'international-gross',
        label: 'International Gross',
        description: 'The highest theatrical grosses outside North America.',
        entries: byInternational.map(film => ({
          film,
          value: film.internationalGross,
          display: compactMoney(film.internationalGross),
        })),
        icon: Globe2,
        color: 'text-emerald-400',
      },
      {
        key: 'audience-score',
        label: 'Audience Favorite',
        description: 'The highest audience scores, with worldwide gross breaking ties.',
        entries: byAudience.map(film => ({
          film,
          value: audienceScore100(film),
          display: `${Math.round(audienceScore100(film))}%`,
        })),
        icon: Users,
        color: 'text-rose-400',
      },
      {
        key: 'critic-score',
        label: "Critics' Pick",
        description: 'The highest critic scores, with worldwide gross breaking ties.',
        entries: byCritics.map(film => ({
          film,
          value: film.criticScore,
          display: `${film.criticScore}%`,
        })),
        icon: Star,
        color: 'text-violet-400',
      },
      {
        key: 'theatrical-profit',
        label: 'Highest Theatrical Profit',
        description: 'Studio theatrical revenue (70% of worldwide gross) minus production, departments, talent, and marketing.',
        entries: byProfit.map(film => ({
          film,
          value: film.profit,
          display: profitMoney(film.profit),
        })),
        icon: CircleDollarSign,
        color: 'text-amber-400',
      },
    ];

    return {
      byWorldwide,
      yearlyChampions,
      genreChampions,
      holders,
    };
  }, [films]);

  if (films.length === 0) {
    return (
      <div className="flex min-h-[420px] flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/40 text-center">
        <Trophy className="mb-4 h-12 w-12 text-muted-foreground/50" />
        <h2 className="text-xl font-semibold">The record book is waiting</h2>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">
          Released films will automatically appear here as your save builds its own Hollywood history.
        </p>
      </div>
    );
  }

  const champion = data.byWorldwide[0];
  const milestoneCounts = [100, 500, 1_000, 2_000].map(millions => ({
    millions,
    count: films.filter(film => film.worldwideGross >= millions * 1_000_000).length,
  }));
  const selectedRecord = data.holders.find(holder => holder.key === selectedRecordKey) || null;
  const SelectedRecordIcon = selectedRecord?.icon;

  return (
    <div className="space-y-5">
      <section className="relative overflow-hidden rounded-2xl border border-amber-500/25 bg-gradient-to-br from-amber-500/15 via-card to-card shadow-xl shadow-black/10">
        <div className="pointer-events-none absolute -right-16 -top-20 h-72 w-72 rounded-full bg-amber-400/10 blur-3xl" />
        <div className="relative grid gap-6 p-6 md:grid-cols-[1fr_auto] md:p-8">
          <div className="flex min-w-0 flex-col justify-center">
            <div className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-amber-400">
              <Crown className="h-4 w-4" />
              All-Time Worldwide Champion
            </div>
            <FilmLink film={champion} className="max-w-3xl text-3xl font-bold tracking-tight text-foreground md:text-5xl" />
            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-muted-foreground">
              <span>{champion.studioName}</span>
              <span className="h-1 w-1 rounded-full bg-muted-foreground/50" />
              <span>{champion.releaseYear}</span>
              <Badge variant="outline" className="border-amber-500/25 bg-amber-500/5 text-amber-300">
                {genreLabels[champion.genre as keyof typeof genreLabels] || champion.genre}
              </Badge>
            </div>
            <div className="mt-7 flex items-end gap-3">
              <span className="text-4xl font-black tracking-tight text-amber-400 md:text-6xl">
                {compactMoney(champion.worldwideGross)}
              </span>
              <span className="pb-1.5 text-sm text-muted-foreground">worldwide</span>
            </div>
          </div>
          <Link href={`/film/${champion.id}`} className="relative mx-auto block md:mx-0">
            <div className="absolute inset-0 translate-x-3 translate-y-3 rounded-xl bg-amber-500/20" />
            <img
              src={champion.posterUrl || getGenrePoster(champion.genre)}
              alt={champion.title}
              className="relative h-52 w-36 rounded-xl border border-white/10 object-cover shadow-2xl md:h-64 md:w-44"
            />
          </Link>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {data.holders.map(holder => {
          const Icon = holder.icon;
          const leader = holder.entries[0];
          if (!leader) return null;
          return (
            <button
              type="button"
              key={holder.label}
              onClick={() => setSelectedRecordKey(holder.key)}
              className="group rounded-xl border border-border/80 bg-card/65 p-4 text-left transition-all hover:-translate-y-0.5 hover:border-amber-500/30 hover:bg-card hover:shadow-lg hover:shadow-black/10"
            >
              <div className="flex items-start justify-between gap-4">
                <div className={`rounded-lg bg-muted/70 p-2.5 ${holder.color}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground/40 transition-transform group-hover:translate-x-0.5 group-hover:text-amber-400" />
              </div>
              <p className="mt-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">{holder.label}</p>
              <p className="mt-1 text-2xl font-bold tracking-tight">{leader.display}</p>
              <p className="mt-1 truncate text-sm text-muted-foreground group-hover:text-foreground">{leader.film.title}</p>
            </button>
          );
        })}
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.45fr_0.75fr]">
        <div className="overflow-hidden rounded-2xl border border-border bg-card/55">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                <Trophy className="h-5 w-5 text-amber-400" />
                Worldwide Hall of Fame
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">The ten biggest films in this save</p>
            </div>
            <Badge variant="outline" className="text-muted-foreground">Top 10</Badge>
          </div>
          <div className="divide-y divide-border/70">
            {data.byWorldwide.slice(0, 10).map((film, index) => (
              <Link
                key={film.id}
                href={`/film/${film.id}`}
                className="group grid grid-cols-[2.5rem_1fr_auto] items-center gap-3 px-5 py-3 transition-colors hover:bg-muted/40"
              >
                <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
                  index === 0 ? 'bg-amber-400 text-black' :
                  index === 1 ? 'bg-slate-300 text-slate-900' :
                  index === 2 ? 'bg-orange-700 text-orange-50' :
                  'bg-muted text-muted-foreground'
                }`}>
                  {index < 3 ? <Medal className="h-4 w-4" /> : index + 1}
                </div>
                <div className="min-w-0">
                  <p className="truncate font-medium group-hover:text-amber-400">{film.title}</p>
                  <p className="truncate text-xs text-muted-foreground">{film.studioName} · {film.releaseYear}</p>
                </div>
                <p className="text-right text-sm font-bold tabular-nums sm:text-base">{compactMoney(film.worldwideGross)}</p>
              </Link>
            ))}
          </div>
        </div>

        <div className="space-y-5">
          <div className="rounded-2xl border border-border bg-card/55 p-5">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <Sparkles className="h-5 w-5 text-amber-400" />
              Milestone Club
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">How rare each worldwide mark is</p>
            <div className="mt-5 grid grid-cols-2 gap-3">
              {milestoneCounts.map(({ millions, count }) => (
                <div key={millions} className="rounded-xl border border-border/70 bg-muted/25 p-3">
                  <p className="text-xl font-bold text-amber-400">{count}</p>
                  <p className="text-xs text-muted-foreground">{millions >= 1_000 ? `$${millions / 1_000}B+` : `$${millions}M+`} films</p>
                  <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-amber-400"
                      style={{ width: `${Math.max(2, (count / films.length) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card/55 p-5">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <CalendarDays className="h-5 w-5 text-blue-400" />
              Yearly Champions
            </h2>
            <div className="mt-4 space-y-1">
              {data.yearlyChampions.slice(0, 8).map(([year, film]) => (
                <Link
                  key={year}
                  href={`/film/${film.id}`}
                  className="group grid grid-cols-[3rem_1fr_auto] items-center gap-3 rounded-lg px-2 py-2.5 hover:bg-muted/40"
                >
                  <span className="text-sm font-semibold text-blue-400">{year}</span>
                  <span className="truncate text-sm group-hover:text-amber-400">{film.title}</span>
                  <span className="text-xs font-semibold tabular-nums text-muted-foreground">{compactMoney(film.worldwideGross)}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card/55 p-5">
        <div className="flex items-center gap-2">
          <Clapperboard className="h-5 w-5 text-violet-400" />
          <h2 className="text-lg font-semibold">Genre Record Holders</h2>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {data.genreChampions.map(([genre, film]) => (
            <Link
              key={genre}
              href={`/film/${film.id}`}
              className="group flex items-center gap-3 rounded-xl border border-border/70 bg-muted/20 p-3 hover:border-violet-400/25 hover:bg-muted/35"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-violet-500/10 text-violet-400">
                <FilmIcon className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted-foreground">{genreLabels[genre as keyof typeof genreLabels] || genre}</p>
                <p className="truncate text-sm font-medium group-hover:text-violet-300">{film.title}</p>
              </div>
              <div className="text-right">
                <Award className="ml-auto h-3.5 w-3.5 text-amber-400" />
                <p className="mt-1 text-xs font-semibold tabular-nums">{compactMoney(film.worldwideGross)}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <Dialog
        open={selectedRecord !== null}
        onOpenChange={open => {
          if (!open) setSelectedRecordKey(null);
        }}
      >
        <DialogContent className="max-h-[88vh] max-w-3xl overflow-hidden border-border bg-background p-0">
          {selectedRecord && (
            <>
              <DialogHeader className="border-b border-border bg-gradient-to-r from-amber-500/10 to-transparent px-6 py-5 pr-12">
                <DialogTitle className="flex items-center gap-3 text-xl">
                  {SelectedRecordIcon && (
                    <span className={`rounded-lg bg-muted p-2 ${selectedRecord.color}`}>
                      <SelectedRecordIcon className="h-5 w-5" />
                    </span>
                  )}
                  Top 10: {selectedRecord.label}
                </DialogTitle>
                <DialogDescription>{selectedRecord.description}</DialogDescription>
              </DialogHeader>
              <div className="max-h-[68vh] divide-y divide-border/70 overflow-y-auto sleek-scrollbar">
                {selectedRecord.entries.slice(0, 10).map((entry, index) => (
                  <Link
                    key={entry.film.id}
                    href={`/film/${entry.film.id}`}
                    onClick={() => setSelectedRecordKey(null)}
                    className="group grid grid-cols-[2.25rem_2.5rem_1fr_auto] items-center gap-3 px-5 py-3 transition-colors hover:bg-muted/45"
                  >
                    <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                      index === 0 ? 'bg-amber-400 text-black' :
                      index === 1 ? 'bg-slate-300 text-slate-900' :
                      index === 2 ? 'bg-orange-700 text-orange-50' :
                      'bg-muted text-muted-foreground'
                    }`}>
                      {index + 1}
                    </span>
                    <img
                      src={entry.film.posterUrl || getGenrePoster(entry.film.genre)}
                      alt=""
                      className="h-10 w-7 rounded object-cover"
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold group-hover:text-amber-400">{entry.film.title}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {entry.film.studioName} · {entry.film.releaseYear}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold tabular-nums">{entry.display}</p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">View film</p>
                    </div>
                  </Link>
                ))}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
