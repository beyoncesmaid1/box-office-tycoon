import { createContext, useContext, useEffect, useRef, type ReactNode } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from './queryClient';
import { getOrCreateDeviceId } from './deviceId';
import type { Studio, Film, Talent } from '@shared/schema';

// Helper function to convert week number and year to actual date (Monday)
// Week 1 starts on Monday, January 6, 2025
export function getWeekDate(weekNumber: number, year: number = 2025): Date {
  const baseDate = new Date('2025-01-06'); // January 6, 2025 - a Monday
  const yearDifference = year - 2025;
  const daysToAdd = (weekNumber - 1) * 7 + (yearDifference * 364); // 364 days per year (52 weeks)
  const targetDate = new Date(baseDate.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
  return targetDate;
}

export function formatWeekDate(weekNumber: number, year: number = 2025): string {
  const date = getWeekDate(weekNumber, year);
  const options: Intl.DateTimeFormatOptions = {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  };
  return new Intl.DateTimeFormat('en-US', options).format(date);
}

export function getWeekNumber(weekNumber: number): string {
  return `Week ${weekNumber}`;
}

// Types for frontend use
export type Genre = 'action' | 'comedy' | 'drama' | 'horror' | 'scifi' | 'romance' | 'thriller' | 'animation' | 'fantasy' | 'musicals';
export type FilmPhase = 'development' | 'awaiting-greenlight' | 'pre-production' | 'production' | 'post-production' | 'released';

export interface FilmWithTalent extends Film {
  director?: Talent | null;
  cast?: Talent[];
  writer?: Talent | null;
}

export interface GameState {
  studioId: string;
  studioName: string;
  budget: number;
  currentWeek: number;
  currentYear: number;
  films: FilmWithTalent[];
  releasedFilms: FilmWithTalent[];
  prestigeLevel: number;
  totalEarnings: number;
  totalAwards: number;
  isLoading: boolean;
  multiplayerSessionId?: string | null;
  isMultiplayer: boolean;
}

interface GameContextType {
  state: GameState;
  talent: Talent[];
  advanceWeek: () => Promise<void>;
  createFilm: (film: {
    title: string;
    genre: Genre;
    synopsis: string;
    productionBudget: number;
    marketingBudget: number;
    talentBudget: number;
    directorId?: string;
    writerId?: string;
    castIds?: string[];
    cinematographerId?: string;
    editorId?: string;
    composerId?: string;
    vfxStudioId?: string;
  }) => Promise<Film | undefined>;
  updateFilm: (id: string, updates: Partial<Film>) => void;
  hireTalent: (id: string, data: { directorId?: string; castIds?: string[]; setsBudget: number; costumesBudget: number; stuntsBudget: number; makeupBudget: number; practicalEffectsBudget: number; soundCrewBudget: number }) => Promise<any>;
  editPostProduction: (id: string, data: { composerId?: string; editorId?: string; vfxStudioId?: string }) => Promise<any>;
  releaseFilm: (id: string) => Promise<void>;
  setStudioName: (name: string) => void;
  isAdvancing: boolean;
  onQuitGame: () => void;
}

export const GameContext = createContext<GameContextType | null>(null);

export function GameProvider({ children, studioId, multiplayerSessionId, userId, onQuitGame }: { children: ReactNode; studioId: string; multiplayerSessionId?: string | null; userId?: string; onQuitGame: () => void; }) {
  const queryClient = useQueryClient();
  const isMultiplayer = !!multiplayerSessionId;
  const wsRef = useRef<WebSocket | null>(null);

  // WebSocket connection for multiplayer sync
  useEffect(() => {
    if (!isMultiplayer || !multiplayerSessionId || !userId) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("[GameState WS] Connected for multiplayer sync");
      // Authenticate with the server
      ws.send(JSON.stringify({
        type: "auth",
        userId,
        gameSessionId: multiplayerSessionId,
        username: "player", // Not used for game sync
      }));
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === "week_advanced") {
          console.log("[GameState WS] Week advanced to", message.week, message.year);
          // Refresh all game data when week advances
          queryClient.invalidateQueries({ queryKey: ['/api/studio', studioId] });
          queryClient.invalidateQueries({ queryKey: ['/api/studio', studioId, 'films'] });
          queryClient.invalidateQueries({ queryKey: ['/api/all-films', studioId] });
          queryClient.invalidateQueries({ queryKey: ['/api/studios', studioId] });
          queryClient.invalidateQueries({ queryKey: ['/api/streaming-deals'] });
          queryClient.invalidateQueries({ queryKey: ['/api/streaming-deals/service'] });
          queryClient.invalidateQueries({ queryKey: [`/api/emails?playerGameId=${studioId}`] });
          queryClient.invalidateQueries({ queryKey: [`/api/emails/unread-count?playerGameId=${studioId}`] });
          // Invalidate awards data when week advances (nominations may have been created)
          queryClient.invalidateQueries({ queryKey: ['/api/nominations', studioId] });
          queryClient.invalidateQueries({ queryKey: ['/api/ceremonies', studioId] });
        }
      } catch (error) {
        console.error("[GameState WS] Failed to parse message:", error);
      }
    };

    ws.onclose = () => {
      console.log("[GameState WS] Disconnected");
    };

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [isMultiplayer, multiplayerSessionId, userId, studioId, queryClient]);

  // Fetch studio
  const { data: studio, isLoading: studioLoading } = useQuery<Studio>({
    queryKey: ['/api/studio', studioId],
    enabled: !!studioId,
  });

  // Fetch films
  const { data: films = [], isLoading: filmsLoading } = useQuery<Film[]>({
    queryKey: ['/api/studio', studioId, 'films'],
    enabled: !!studioId,
  });

  // Fetch talent
  const { data: talent = [] } = useQuery<Talent[]>({
    queryKey: ['/api/talent'],
  });

  // Advance week mutation - uses multiplayer endpoint if in a multiplayer game
  const advanceWeekMutation = useMutation({
    mutationFn: async () => {
      if (!studio?.id) throw new Error('No studio');
      
      if (isMultiplayer && multiplayerSessionId && userId) {
        // Use multiplayer endpoint - this syncs all players
        const result = await apiRequest('POST', `/api/multiplayer/sessions/${multiplayerSessionId}/advance-week`, {
          userId,
        });
        return result.json();
      } else {
        // Single player - advance just this studio
        const result = await apiRequest('POST', `/api/studio/${studio.id}/advance-week`);
        return result.json();
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/studio', studioId] });
      queryClient.invalidateQueries({ queryKey: ['/api/studio', studioId, 'films'] });
      queryClient.invalidateQueries({ queryKey: ['/api/all-films', studioId] });
      queryClient.invalidateQueries({ queryKey: ['/api/studios', studioId] });
      queryClient.invalidateQueries({ queryKey: ['/api/streaming-deals'] });
      queryClient.invalidateQueries({ queryKey: ['/api/streaming-deals/service'] });
      queryClient.invalidateQueries({ queryKey: [`/api/emails?playerGameId=${studioId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/emails/unread-count?playerGameId=${studioId}`] });
    },
  });

  // Create film mutation
  const createFilmMutation = useMutation({
    mutationFn: async (filmData: {
      title: string;
      genre: Genre;
      synopsis: string;
      productionBudget: number;
      marketingBudget: number;
      talentBudget: number;
      directorId?: string;
      writerId?: string;
      castIds?: string[];
      cinematographerId?: string;
      editorId?: string;
      composerId?: string;
      vfxStudioId?: string;
    }) => {
      if (!studio?.id) throw new Error('No studio');
      const result = await apiRequest('POST', '/api/films', {
        ...filmData,
        studioId: studio.id,
        totalBudget: filmData.productionBudget + filmData.marketingBudget + filmData.talentBudget,
      });
      return result.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/studio', studioId] });
      queryClient.invalidateQueries({ queryKey: ['/api/studio', studioId, 'films'] });
    },
  });

  // Update film mutation
  const updateFilmMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Film> }) => {
      const result = await apiRequest('PATCH', `/api/films/${id}`, updates);
      return result.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/studio', studioId] });
      queryClient.invalidateQueries({ queryKey: ['/api/studio', studioId, 'films'] });
    },
  });

  // Release film mutation
  const releaseFilmMutation = useMutation({
    mutationFn: async (id: string) => {
      const result = await apiRequest('POST', `/api/films/${id}/release`);
      return result.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/studio', studioId] });
      queryClient.invalidateQueries({ queryKey: ['/api/studio', studioId, 'films'] });
    },
  });

  // Update studio name mutation
  const updateStudioMutation = useMutation({
    mutationFn: async (name: string) => {
      if (!studio?.id) throw new Error('No studio');
      const result = await apiRequest('PATCH', `/api/studio/${studio.id}`, { name });
      return result.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/studio'] });
    },
  });

  // Helper to enrich films with talent data
  const enrichFilmWithTalent = (film: Film): FilmWithTalent => {
    return {
      ...film,
      director: film.directorId ? talent.find(t => t.id === film.directorId) : null,
      writer: film.writerId ? talent.find(t => t.id === film.writerId) : null,
      cast: film.castIds ? film.castIds.map(id => talent.find(t => t.id === id)).filter(Boolean) as Talent[] : [],
    };
  };

  const enrichedFilms = films.map(enrichFilmWithTalent);
  const inProgressFilms = enrichedFilms.filter(f => f.phase !== 'released');
  const releasedFilms = enrichedFilms.filter(f => f.phase === 'released');

  const state: GameState = {
    studioId: studio?.id || '',
    studioName: studio?.name || 'Loading...',
    budget: studio?.budget || 0,
    currentWeek: studio?.currentWeek || 1,
    currentYear: studio?.currentYear || 2025,
    films: inProgressFilms,
    releasedFilms: releasedFilms,
    prestigeLevel: studio?.prestigeLevel || 1,
    totalEarnings: studio?.totalEarnings || 0,
    totalAwards: studio?.totalAwards || 0,
    isLoading: studioLoading || filmsLoading,
    multiplayerSessionId,
    isMultiplayer,
  };

  const advanceWeek = async () => {
    await advanceWeekMutation.mutateAsync();
  };

  const createFilm = async (filmData: {
    title: string;
    genre: Genre;
    synopsis: string;
    productionBudget: number;
    marketingBudget: number;
    talentBudget: number;
    directorId?: string;
    writerId?: string;
    castIds?: string[];
    cinematographerId?: string;
    editorId?: string;
    composerId?: string;
    vfxStudioId?: string;
  }): Promise<Film> => {
    return await createFilmMutation.mutateAsync(filmData);
  };

  const updateFilm = async (id: string, updates: Partial<Film>) => {
    await updateFilmMutation.mutateAsync({ id, updates });
  };

  const hireTalent = async (id: string, data: { directorId?: string; castIds?: string[]; setsBudget: number; costumesBudget: number; stuntsBudget: number; makeupBudget: number; practicalEffectsBudget?: number; soundCrewBudget?: number; totalCost: number }) => {
    const result = await apiRequest('POST', `/api/films/${id}/hire-talent`, data);
    // Invalidate queries to refresh budget and film state
    queryClient.invalidateQueries({ queryKey: ['/api/studio'] });
    queryClient.invalidateQueries({ queryKey: ['/api/films'] });
    return result.json();
  };

  const editPostProduction = async (id: string, data: { composerId?: string; editorId?: string; vfxStudioId?: string }) => {
    const result = await apiRequest('POST', `/api/films/${id}/edit-postproduction`, data);
    // Invalidate queries to refresh budget and film state
    queryClient.invalidateQueries({ queryKey: ['/api/studio'] });
    queryClient.invalidateQueries({ queryKey: ['/api/films'] });
    return result.json();
  };

  const releaseFilm = async (id: string) => {
    await releaseFilmMutation.mutateAsync(id);
  };

  const setStudioName = (name: string) => {
    updateStudioMutation.mutate(name);
  };

  return (
    <GameContext.Provider value={{
      state,
      talent,
      advanceWeek,
      createFilm,
      updateFilm,
      hireTalent,
      editPostProduction,
      releaseFilm,
      setStudioName,
      isAdvancing: advanceWeekMutation.isPending,
      onQuitGame,
    }}>
      {children}
    </GameContext.Provider>
  );
}

export function useGame() {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error('useGame must be used within a GameProvider');
  }
  return context;
}

export function formatMoney(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export const genreColors: Record<Genre, string> = {
  action: 'bg-red-500/20 text-red-600 dark:text-red-400',
  comedy: 'bg-yellow-500/20 text-yellow-600 dark:text-yellow-400',
  drama: 'bg-purple-500/20 text-purple-600 dark:text-purple-400',
  horror: 'bg-gray-500/20 text-gray-600 dark:text-gray-400',
  scifi: 'bg-blue-500/20 text-blue-600 dark:text-blue-400',
  romance: 'bg-pink-500/20 text-pink-600 dark:text-pink-400',
  thriller: 'bg-orange-500/20 text-orange-600 dark:text-orange-400',
  animation: 'bg-green-500/20 text-green-600 dark:text-green-400',
  fantasy: 'bg-indigo-500/20 text-indigo-600 dark:text-indigo-400',
  musicals: 'bg-rose-500/20 text-rose-600 dark:text-rose-400',
};

export const genreLabels: Record<Genre, string> = {
  action: 'Action',
  comedy: 'Comedy',
  drama: 'Drama',
  horror: 'Horror',
  scifi: 'Sci-Fi',
  romance: 'Romance',
  thriller: 'Thriller',
  animation: 'Animation',
  fantasy: 'Fantasy',
  musicals: 'Musicals',
};
