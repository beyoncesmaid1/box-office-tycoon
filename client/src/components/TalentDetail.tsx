import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import { 
  Trophy, 
  Users, 
  Film as FilmIcon,
  Clapperboard,
  Music,
  PenTool,
  Star,
  TrendingUp,
  Calendar,
  ArrowLeft,
  Award
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { useGame, formatMoney } from '@/lib/gameState';
import type { Film, Talent, AwardNomination } from '@shared/schema';

interface TalentDetailProps {
  talentId: string;
}

function formatCompactMoney(amount: number): string {
  if (amount >= 1000000000) {
    return `$${(amount / 1000000000).toFixed(2)}B`;
  } else if (amount >= 1000000) {
    return `$${(amount / 1000000).toFixed(1)}M`;
  } else if (amount >= 1000) {
    return `$${(amount / 1000).toFixed(0)}K`;
  }
  return `$${amount}`;
}

export function TalentDetail({ talentId }: TalentDetailProps) {
  const { state } = useGame();

  const { data: talent } = useQuery<Talent>({
    queryKey: ['/api/talent', talentId],
    queryFn: async () => {
      const res = await fetch(`/api/talent/${talentId}`);
      if (!res.ok) throw new Error('Failed to fetch talent');
      return res.json();
    },
    enabled: !!talentId,
  });

  const { data: allFilms = [] } = useQuery<Film[]>({
    queryKey: ['/api/all-films', state.studioId],
  });

  const { data: nominations = [] } = useQuery<AwardNomination[]>({
    queryKey: ['/api/nominations', state.studioId],
    enabled: !!state.studioId,
  });

  if (!talent) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Loading talent profile...</p>
      </div>
    );
  }

  // Get filmography for this talent
  const filmography = allFilms
    .filter(f => f.phase === 'released' && f.totalBoxOffice > 0 && (!f.releaseYear || f.releaseYear <= state.currentYear))
    .filter(f => {
      if (talent.type === 'director') return f.directorId === talent.id;
      if (talent.type === 'writer') return f.writerId === talent.id;
      if (talent.type === 'composer') return f.composerId === talent.id;
      // For actors, check castIds array
      return f.castIds?.includes(talent.id);
    })
    .map(film => {
      let role = talent.type;
      if (talent.type === 'director') {
        role = 'Director';
      } else if (talent.type === 'writer') {
        role = 'Writer';
      } else if (talent.type === 'composer') {
        role = 'Composer';
      } else if (talent.type === 'actor') {
        role = 'Actor';
      }
      return { film, role, boxOffice: film.totalBoxOffice };
    })
    .sort((a, b) => b.boxOffice - a.boxOffice);

  const totalBoxOffice = filmography.reduce((sum, f) => sum + f.boxOffice, 0);
  const avgBoxOffice = filmography.length > 0 ? totalBoxOffice / filmography.length : 0;

  // Get awards for this talent
  const talentNominations = nominations.filter(n => n.talentId === talent.id);
  const wins = talentNominations.filter(n => n.isWinner);
  const noms = talentNominations.filter(n => !n.isWinner);

  // Calculate power ranking (performance + experience + popularity)
  const performance = talent.performance || 50;
  const experience = talent.experience || 50;
  const popularity = talent.popularity || 50;
  const powerRanking = Math.round((performance * 0.4 + experience * 0.3 + popularity * 0.3));

  // Get talent type icon
  const getTalentIcon = () => {
    switch (talent.type) {
      case 'director': return <Clapperboard className="w-8 h-8" />;
      case 'actor': return <Users className="w-8 h-8" />;
      case 'composer': return <Music className="w-8 h-8" />;
      case 'writer': return <PenTool className="w-8 h-8" />;
      default: return <Star className="w-8 h-8" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <Link href="/insider">
        <Button variant="ghost" size="sm" className="gap-2">
          <ArrowLeft className="w-4 h-4" />
          Back to Hollywood Insider
        </Button>
      </Link>

      {/* Header Card */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-start gap-6">
            {/* Profile Picture */}
            {talent.imageUrl ? (
              <img 
                src={talent.imageUrl} 
                alt={talent.name}
                className="w-32 h-32 rounded-full object-cover border-4 border-border"
              />
            ) : (
              <div className="w-32 h-32 rounded-full bg-muted flex items-center justify-center border-4 border-border">
                {getTalentIcon()}
              </div>
            )}

            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-3xl font-bold">{talent.name}</h1>
                <Badge variant="outline" className="text-sm capitalize">
                  {talent.type}
                </Badge>
                {talent.gender && (
                  <Badge variant="secondary" className="text-xs">
                    {talent.gender === 'male' ? 'Male' : 'Female'}
                  </Badge>
                )}
              </div>

              <div className="flex items-center gap-4 mt-4">
                {wins.length > 0 && (
                  <div className="flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-yellow-500" />
                    <span className="font-semibold">{wins.length} Award Win{wins.length !== 1 ? 's' : ''}</span>
                  </div>
                )}
                {noms.length > 0 && (
                  <div className="flex items-center gap-2">
                    <Award className="w-5 h-5 text-muted-foreground" />
                    <span>{noms.length} Nomination{noms.length !== 1 ? 's' : ''}</span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <FilmIcon className="w-5 h-5 text-muted-foreground" />
                  <span>{filmography.length} Film{filmography.length !== 1 ? 's' : ''}</span>
                </div>
              </div>

              <div className="mt-4">
                <p className="text-2xl font-bold">{formatCompactMoney(totalBoxOffice)}</p>
                <p className="text-sm text-muted-foreground">Career Box Office</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Power Ranking */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Star className="w-4 h-4" />
              Power Ranking
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold mb-2">{powerRanking}</div>
            <Progress value={powerRanking} className="h-2" />
            <div className="grid grid-cols-3 gap-2 mt-4 text-xs">
              <div>
                <p className="text-muted-foreground">Performance</p>
                <p className="font-semibold">{performance}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Experience</p>
                <p className="font-semibold">{experience}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Popularity</p>
                <p className="font-semibold">{popularity}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Box Office Stats */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Box Office Stats
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div>
                <p className="text-xs text-muted-foreground">Total Career Gross</p>
                <p className="text-xl font-bold">{formatCompactMoney(totalBoxOffice)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Average Per Film</p>
                <p className="text-lg font-semibold">{formatCompactMoney(avgBoxOffice)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Films Released</p>
                <p className="text-lg font-semibold">{filmography.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Awards Summary */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Trophy className="w-4 h-4" />
              Awards
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-yellow-500/20 flex items-center justify-center">
                  <Trophy className="w-6 h-6 text-yellow-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{wins.length}</p>
                  <p className="text-xs text-muted-foreground">Wins</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                  <Award className="w-6 h-6 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{noms.length}</p>
                  <p className="text-xs text-muted-foreground">Nominations</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filmography */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FilmIcon className="w-5 h-5" />
            Filmography
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filmography.length > 0 ? (
            <ScrollArea className="h-[400px]">
              <div className="space-y-2">
                {filmography.map(({ film, role, boxOffice }, index) => (
                  <Link key={film.id} href={`/film/${film.id}`}>
                    <div className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors cursor-pointer">
                      <div className="flex items-center gap-4">
                        <span className="text-lg font-bold text-muted-foreground w-8">#{index + 1}</span>
                        <div>
                          <p className="font-semibold hover:underline">{film.title}</p>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Calendar className="w-3 h-3" />
                            <span>{film.releaseYear}</span>
                            <span>•</span>
                            <span>{role}</span>
                            <span>•</span>
                            <Badge variant="outline" className="text-xs capitalize">{film.genre}</Badge>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold">{formatCompactMoney(boxOffice)}</p>
                        <p className="text-xs text-muted-foreground">Box Office</p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </ScrollArea>
          ) : (
            <div className="py-8 text-center text-muted-foreground">
              No released films yet
            </div>
          )}
        </CardContent>
      </Card>

      {/* Awards History */}
      {talentNominations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="w-5 h-5" />
              Awards History
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px]">
              <div className="space-y-2">
                {talentNominations.map((nom) => {
                  const film = allFilms.find(f => f.id === nom.filmId);
                  return (
                    <div 
                      key={nom.id} 
                      className={`flex items-center justify-between p-3 rounded-lg border ${
                        nom.isWinner ? 'border-yellow-500/50 bg-yellow-500/10' : 'border-border'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {nom.isWinner ? (
                          <Trophy className="w-5 h-5 text-yellow-500" />
                        ) : (
                          <Award className="w-5 h-5 text-muted-foreground" />
                        )}
                        <div>
                          <p className="font-semibold">{nom.categoryName}</p>
                          <p className="text-sm text-muted-foreground">
                            {nom.awardShowName} {nom.year}
                            {film && ` • ${film.title}`}
                          </p>
                        </div>
                      </div>
                      <Badge variant={nom.isWinner ? 'default' : 'outline'}>
                        {nom.isWinner ? 'Winner' : 'Nominated'}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
