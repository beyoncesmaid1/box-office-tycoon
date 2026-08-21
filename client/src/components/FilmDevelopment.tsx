import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { 
  Film, 
  Clapperboard, 
  Sparkles, 
  Ghost, 
  Rocket, 
  Heart, 
  Crosshair,
  Baby,
  FileText,
  DollarSign,
  Star,
  Check,
  Loader2,
  Calendar,
  Globe,
  Users,
  Plus,
  Trash2,
  UserCircle,
  AlertCircle,
  Wand2,
  Music,
  BookOpen
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useGame, formatMoney, genreLabels, type Genre, formatWeekDate } from '@/lib/gameState';
import { useToast } from '@/hooks/use-toast';
import type { Talent, Film as FilmType } from '@shared/schema';

interface VFXStudio {
  id: string;
  name: string;
  cost: number;
  quality: number;
  specialization: string[];
}

const genreData: { id: Genre; label: string; icon: typeof Film; description: string; avgBudget: string; risk: string }[] = [
  { id: 'action', label: 'Action', icon: Crosshair, description: 'High-octane thrills with explosions and stunts', avgBudget: '$80-200M', risk: 'Medium' },
  { id: 'comedy', label: 'Comedy', icon: Sparkles, description: 'Laughs and entertainment for all audiences', avgBudget: '$20-60M', risk: 'Low' },
  { id: 'drama', label: 'Drama', icon: Film, description: 'Emotional storytelling and character depth', avgBudget: '$15-50M', risk: 'Low' },
  { id: 'horror', label: 'Horror', icon: Ghost, description: 'Scares and suspense on a budget', avgBudget: '$5-30M', risk: 'Low' },
  { id: 'scifi', label: 'Sci-Fi', icon: Rocket, description: 'Futuristic worlds and advanced technology', avgBudget: '$100-250M', risk: 'High' },
  { id: 'romance', label: 'Romance', icon: Heart, description: 'Love stories that tug at heartstrings', avgBudget: '$20-50M', risk: 'Low' },
  { id: 'thriller', label: 'Thriller', icon: Clapperboard, description: 'Edge-of-seat suspense and mystery', avgBudget: '$30-80M', risk: 'Medium' },
  { id: 'animation', label: 'Animation', icon: Baby, description: 'Animated features for family audiences', avgBudget: '$80-175M', risk: 'Medium' },
  { id: 'fantasy', label: 'Fantasy', icon: Wand2, description: 'Magical worlds filled with wonder and adventure', avgBudget: '$80-180M', risk: 'Medium' },
  { id: 'musicals', label: 'Musicals', icon: Music, description: 'Songs, dancing, and spectacular production numbers', avgBudget: '$50-150M', risk: 'Medium' },
];

interface TalentCardProps {
  talent: Talent;
  selected: boolean;
  onToggle: () => void;
  disabled?: boolean;
}

export function TalentCard({ talent, selected, onToggle, disabled }: TalentCardProps) {
  return (
    <div 
      className={`p-3 rounded-lg border cursor-pointer transition-all ${
        selected 
          ? 'border-primary bg-primary/10' 
          : 'border-border hover-elevate'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      onClick={() => !disabled && onToggle()}
      data-testid={`card-talent-${talent.id}`}
    >
      <div className="flex items-center gap-3">
        <Avatar>
          {talent.imageUrl && <AvatarImage src={talent.imageUrl} alt={talent.name} />}
          <AvatarFallback>{talent.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="font-medium truncate">{talent.name}</p>
          <div className="flex items-center gap-1 mt-0.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star 
                key={i} 
                className={`w-3 h-3 ${i < Math.floor(talent.fame / 20) ? 'text-primary fill-primary' : 'text-muted-foreground'}`} 
              />
            ))}
          </div>
        </div>
        <div className="text-right">
          <p className="text-sm font-medium">{formatMoney(talent.askingPrice)}</p>
          <p className="text-xs text-muted-foreground">{talent.awards > 0 ? `${talent.awards} awards` : 'No awards'}</p>
        </div>
        {selected && (
          <Check className="w-5 h-5 text-primary" />
        )}
      </div>
    </div>
  );
}

interface SequelOriginalFilm {
  id: string;
  title: string;
  genre: string;
  synopsis: string;
  directorId: string | null;
  writerId: string | null;
  productionBudget: number;
  marketingBudget: number;
  totalBoxOffice: number;
}

export function FilmDevelopment() {
  const { state, talent, createFilm, updateFilm } = useGame();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  
  const [step, setStep] = useState<'genre' | 'synopsis' | 'writer' | 'roles' | 'confirm'>('genre');
  const [title, setTitle] = useState('');
  const [synopsis, setSynopsis] = useState('');
  const [selectedGenre, setSelectedGenre] = useState<Genre | null>(null);
  const [selectedCast, setSelectedCast] = useState<Talent[]>([]);
  const [selectedWriter, setSelectedWriter] = useState<Talent | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isSequel, setIsSequel] = useState(false);
  const [sequelOriginalFilm, setSequelOriginalFilm] = useState<SequelOriginalFilm | null>(null);
  const [isPurchasedScript, setIsPurchasedScript] = useState(false);
  
  // Film roles state - must be declared before useEffect that uses it
  interface FilmRoleData {
    roleName: string;
    characterAge: number | null;
    importance: 'lead' | 'supporting' | 'minor' | 'cameo';
    characterType: 'hero' | 'villain' | 'love_interest' | 'mentor' | 'sidekick' | 'comic_relief' | 'antagonist' | 'other';
    genderPreference: 'male' | 'female' | 'any';
    castId: string;
  }
  const [filmRoles, setFilmRoles] = useState<FilmRoleData[]>([]);
  
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const isSequelMode = urlParams.get('sequel') === 'true';
    const isFromMarketplace = urlParams.get('fromMarketplace') === 'true';
    
    if (isFromMarketplace) {
      const storedScript = localStorage.getItem('purchasedScript');
      if (storedScript) {
        try {
          const purchasedScript = JSON.parse(storedScript);
          setIsPurchasedScript(true);
          setTitle(purchasedScript.title);
          const genre = purchasedScript.genre === 'sci-fi' ? 'scifi' : purchasedScript.genre;
          setSelectedGenre(genre as Genre);
          setSynopsis(purchasedScript.synopsis || purchasedScript.logline);
          
          // Load pre-made roles from the purchased script
          if (purchasedScript.roles && Array.isArray(purchasedScript.roles)) {
            const loadedRoles: FilmRoleData[] = purchasedScript.roles.map((role: any) => ({
              roleName: role.name,
              characterAge: null,
              importance: (role.type === 'lead' || role.type === 'supporting') ? role.type : 'supporting',
              characterType: 'hero',
              genderPreference: (role.gender === 'male' || role.gender === 'female') ? role.gender : 'any',
              castId: ''
            }));
            setFilmRoles(loadedRoles);
          }
          
          localStorage.removeItem('purchasedScript');
          
          toast({
            title: "Script Loaded",
            description: `"${purchasedScript.title}" script has been loaded with ${purchasedScript.roles?.length || 0} pre-made character roles. Genre is locked but you can customize the synopsis and casting.`,
          });
        } catch (e) {
          console.error('Failed to parse purchased script data:', e);
        }
      }
    } else if (isSequelMode) {
      const storedFilm = localStorage.getItem('sequelOriginalFilm');
      if (storedFilm) {
        try {
          const originalFilm = JSON.parse(storedFilm) as SequelOriginalFilm;
          setIsSequel(true);
          setSequelOriginalFilm(originalFilm);
          
          const sequelNumber = originalFilm.title.match(/(\d+)$/) 
            ? parseInt(originalFilm.title.match(/(\d+)$/)?.[1] || '1') + 1 
            : 2;
          setTitle(`${originalFilm.title.replace(/\s*\d+$/, '')} ${sequelNumber}`);
          setSelectedGenre(originalFilm.genre as Genre);
          setSynopsis(`Continuing the story from "${originalFilm.title}"...`);
          
          // Load roles from original film
          const storedRoles = localStorage.getItem('sequelOriginalRoles');
          if (storedRoles) {
            try {
              const originalRoles = JSON.parse(storedRoles);
              if (Array.isArray(originalRoles) && originalRoles.length > 0) {
                const loadedRoles: FilmRoleData[] = originalRoles.map((role: any) => ({
                  roleName: role.roleName,
                  characterAge: role.characterAge,
                  importance: role.importance,
                  characterType: role.characterType,
                  genderPreference: role.genderPreference,
                  castId: ''
                }));
                setFilmRoles(loadedRoles);
                toast({
                  title: "Roles Loaded",
                  description: `${originalRoles.length} character roles from "${originalFilm.title}" are ready for casting.`,
                });
              } else {
                toast({
                  title: "No roles found",
                  description: `The original film has no defined character roles. Define new ones for this sequel.`,
                });
              }
              localStorage.removeItem('sequelOriginalRoles');
            } catch (e) {
              console.error('Failed to parse sequel roles:', e);
            }
          }
          
          localStorage.removeItem('sequelOriginalFilm');
          
          toast({
            title: "Sequel Development Mode",
            description: `Creating a sequel to "${originalFilm.title}". The genre is locked but you can customize everything else.`,
          });
        } catch (e) {
          console.error('Failed to parse sequel film data:', e);
        }
      }
    }
  }, []);
  
  const [editingRoleIndex, setEditingRoleIndex] = useState<number | null>(null);
  const [showActorSelector, setShowActorSelector] = useState(false);
  const [showWriterSelector, setShowWriterSelector] = useState(false);
  const [writerSortBy, setWriterSortBy] = useState<'name' | 'fame' | 'performance' | 'price'>('name');
  const [actorSortBy, setActorSortBy] = useState<'name' | 'fame' | 'performance' | 'price'>('name');
  const [newRole, setNewRole] = useState<FilmRoleData>({
    roleName: '',
    characterAge: null,
    importance: 'supporting',
    characterType: 'hero',
    genderPreference: 'any',
    castId: ''
  });


  const getSortedTalent = (talentList: Talent[], sortBy: 'name' | 'fame' | 'performance' | 'price') => {
    const sorted = [...talentList];
    switch(sortBy) {
      case 'fame':
        return sorted.sort((a, b) => b.fame - a.fame);
      case 'performance':
        return sorted.sort((a, b) => b.performance - a.performance);
      case 'price':
        return sorted.sort((a, b) => b.askingPrice - a.askingPrice);
      case 'name':
      default:
        return sorted.sort((a, b) => a.name.localeCompare(b.name));
    }
  };

  const actors = getSortedTalent(talent.filter(t => t.type === 'actor'), actorSortBy);
  const writers = getSortedTalent(talent.filter(t => t.type === 'writer'), writerSortBy);

  // Calculate cast cost from roles
  const roleCastCost = filmRoles.reduce((acc, role) => {
    if (role.castId) {
      const actor = talent.find(t => t.id === role.castId);
      return acc + (actor?.askingPrice || 0);
    }
    return acc;
  }, 0);

  const talentCost = roleCastCost + (selectedWriter?.askingPrice || 0);
  
  const totalBudget = talentCost;
  const canAfford = totalBudget <= state.budget;

  const handleCreateFilm = async () => {
    if (!selectedGenre || !title.trim() || !synopsis.trim()) return;
    
    setIsCreating(true);
    try {
      // Get cast IDs from roles
      const castIds = filmRoles
        .filter(role => role.castId)
        .map(role => role.castId as string);

      const filmData: any = {
        title: title.trim(),
        genre: selectedGenre,
        synopsis: synopsis.trim(),
        productionBudget: 0,
        marketingBudget: 0,
        talentBudget: talentCost,
        writerId: selectedWriter?.id,
        castIds: castIds,
      };

      if (isSequel && sequelOriginalFilm) {
        filmData.isSequel = true;
        filmData.prequelFilmId = sequelOriginalFilm.id;
      }

      const createdFilm = await createFilm(filmData);
      
      if (isSequel && sequelOriginalFilm && createdFilm) {
        try {
          await fetch(`/api/films/${createdFilm.id}/set-sequel-franchise`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ originalFilmId: sequelOriginalFilm.id }),
          });
        } catch (e) {
          console.error('Failed to set franchise:', e);
        }
      }

      // Save film roles to the database
      if (filmRoles.length > 0 && createdFilm) {
        for (const role of filmRoles) {
          try {
            const response = await fetch(`/api/films/${createdFilm.id}/roles`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                filmId: createdFilm.id,
                roleName: role.roleName,
                characterAge: role.characterAge,
                importance: role.importance,
                characterType: role.characterType,
                genderPreference: role.genderPreference,
                actorId: role.castId && role.castId.trim() ? role.castId : null,
              }),
            });
            if (!response.ok) {
              const error = await response.json();
              console.error(`Failed to create role ${role.roleName}:`, error);
            } else {
              console.log(`Successfully created role: ${role.roleName}`);
            }
          } catch (error) {
            console.error('Failed to create role:', error);
          }
        }
      }

      toast({
        title: 'Film Created!',
        description: `${title} is now in development${filmRoles.length > 0 ? ` with ${filmRoles.length} roles to cast` : ''}.`,
      });

      // Reset form
      setStep('genre');
      setTitle('');
      setSynopsis('');
      setSelectedGenre(null);
      setSelectedWriter(null);
      setFilmRoles([]);
      setShowConfirmDialog(false);
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to create film. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsCreating(false);
    }
  };

  if (state.isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="font-display text-3xl">Develop New Film</h2>
          <p className="text-muted-foreground mt-1">Create your next blockbuster hit</p>
        </div>
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            onClick={() => setLocation('/scripts')}
            className="border-amber-500/30 text-amber-400 hover:bg-amber-500/20"
          >
            <BookOpen className="h-4 w-4 mr-2" />
            Script Marketplace
          </Button>
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Available Budget</p>
            <p className="font-display text-2xl text-primary">{formatMoney(state.budget)}</p>
          </div>
        </div>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 flex-wrap">
        {['genre', 'synopsis', 'roles', 'writer', 'confirm'].map((s, i) => (
          <div key={s} className="flex items-center">
            <button
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                step === s 
                  ? 'bg-primary text-primary-foreground' 
                  : i < ['genre', 'synopsis', 'roles', 'writer', 'confirm'].indexOf(step)
                    ? 'bg-primary/20 text-primary'
                    : 'bg-muted text-muted-foreground'
              }`}
              onClick={() => {
                const steps = ['genre', 'synopsis', 'roles', 'writer', 'confirm'] as const;
                if (steps.indexOf(s as typeof step) <= steps.indexOf(step)) {
                  setStep(s as typeof step);
                }
              }}
              data-testid={`button-step-${s}`}
            >
              {i + 1}
            </button>
            {i < 4 && <div className={`w-8 h-0.5 ${i < ['genre', 'synopsis', 'roles', 'writer', 'confirm'].indexOf(step) ? 'bg-primary' : 'bg-muted'}`} />}
          </div>
        ))}
      </div>

      {/* Genre Selection */}
      {step === 'genre' && (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Film Title</Label>
            <Input
              id="title"
              placeholder="Enter your film's title..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              data-testid="input-film-title"
            />
          </div>

          <div>
            <div className="flex items-center gap-2 mb-3">
              <Label>Select Genre</Label>
              {(isSequel || isPurchasedScript) && (
                <Badge variant="secondary" className="text-xs">Locked</Badge>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {genreData.map((genre) => {
                const isLocked = (isSequel || isPurchasedScript) && selectedGenre !== genre.id;
                return (
                <Card 
                  key={genre.id}
                  className={`transition-all ${
                    isLocked 
                      ? 'opacity-40 cursor-not-allowed'
                      : selectedGenre === genre.id 
                        ? 'ring-2 ring-primary cursor-pointer' 
                        : 'hover-elevate cursor-pointer'
                  }`}
                  onClick={() => !isLocked && !(isSequel || isPurchasedScript) && setSelectedGenre(genre.id)}
                  data-testid={`card-genre-${genre.id}`}
                >
                  <CardHeader className="pb-2 gap-2">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <genre.icon className="w-5 h-5 text-primary" />
                      </div>
                      <CardTitle className="text-lg">{genre.label}</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-3">{genre.description}</p>
                    <div className="flex items-center justify-between text-xs">
                      <span>Avg Budget: {genre.avgBudget}</span>
                      <Badge variant="secondary">{genre.risk} Risk</Badge>
                    </div>
                  </CardContent>
                </Card>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end">
            <Button 
              onClick={() => setStep('synopsis')}
              disabled={!selectedGenre || !title.trim()}
              data-testid="button-next-synopsis"
            >
              Next: Write Synopsis
            </Button>
          </div>
        </div>
      )}

      {/* Synopsis Writing */}
      {step === 'synopsis' && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Film Synopsis
              </CardTitle>
              <CardDescription>Write a compelling story for your film</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                placeholder="Describe your film's plot, characters, and storyline. Be creative and compelling..."
                value={synopsis}
                onChange={(e) => setSynopsis(e.target.value)}
                rows={8}
                data-testid="input-film-synopsis"
              />
              <div className="text-xs text-muted-foreground">
                {synopsis.length} characters (recommended: 100-500)
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep('genre')} data-testid="button-back-to-genre">
              Back
            </Button>
            <Button onClick={() => setStep('roles')} disabled={!synopsis.trim() || synopsis.length < 20} data-testid="button-next-to-roles">
              Next: Define Roles
            </Button>
          </div>
        </div>
      )}

      {/* Roles Definition */}
      {step === 'roles' && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Define Character Roles
              </CardTitle>
              <CardDescription>
                Create the roles you'll need to cast. Define lead and supporting characters with their details.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Add new role form */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 border rounded-lg bg-muted/30">
                <div className="space-y-2">
                  <Label htmlFor="role-name">Character Name</Label>
                  <Input
                    id="role-name"
                    placeholder="e.g., John Connor, Sarah Connor"
                    value={newRole.roleName}
                    onChange={(e) => setNewRole({ ...newRole, roleName: e.target.value })}
                    data-testid="input-role-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role-age">Character Age (optional)</Label>
                  <Input
                    id="role-age"
                    type="number"
                    placeholder="e.g., 35"
                    value={newRole.characterAge || ''}
                    onChange={(e) => setNewRole({ ...newRole, characterAge: e.target.value ? parseInt(e.target.value) : null })}
                    data-testid="input-role-age"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Role Importance</Label>
                  <Select
                    value={newRole.importance}
                    onValueChange={(v) => setNewRole({ ...newRole, importance: v as FilmRoleData['importance'] })}
                  >
                    <SelectTrigger data-testid="select-role-importance">
                      <SelectValue placeholder="Select importance" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="lead">Lead Role</SelectItem>
                      <SelectItem value="supporting">Supporting Role</SelectItem>
                      <SelectItem value="minor">Minor Role</SelectItem>
                      <SelectItem value="cameo">Cameo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Character Type</Label>
                  <Select
                    value={newRole.characterType}
                    onValueChange={(v) => setNewRole({ ...newRole, characterType: v as FilmRoleData['characterType'] })}
                  >
                    <SelectTrigger data-testid="select-character-type">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hero">Hero</SelectItem>
                      <SelectItem value="villain">Villain</SelectItem>
                      <SelectItem value="love_interest">Love Interest</SelectItem>
                      <SelectItem value="mentor">Mentor</SelectItem>
                      <SelectItem value="sidekick">Sidekick</SelectItem>
                      <SelectItem value="comic_relief">Comic Relief</SelectItem>
                      <SelectItem value="antagonist">Antagonist</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Gender Preference</Label>
                  <Select
                    value={newRole.genderPreference}
                    onValueChange={(v) => setNewRole({ ...newRole, genderPreference: v as FilmRoleData['genderPreference'] })}
                  >
                    <SelectTrigger data-testid="select-gender-preference">
                      <SelectValue placeholder="Select preference" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">Any Gender</SelectItem>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-full flex items-end">
                  <Button
                    onClick={() => {
                      if (newRole.roleName.trim()) {
                        setFilmRoles([...filmRoles, { ...newRole }]);
                        setNewRole({
                          roleName: '',
                          characterAge: null,
                          importance: 'supporting',
                          characterType: 'hero',
                          genderPreference: 'any',
                          castId: ''
                        });
                      }
                    }}
                    disabled={!newRole.roleName.trim()}
                    data-testid="button-add-role"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Role
                  </Button>
                </div>
              </div>

              {/* List of added roles */}
              {filmRoles.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground">
                    Added Roles ({filmRoles.length})
                  </Label>
                  <div className="space-y-2">
                    {filmRoles.map((role, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-3 border rounded-lg bg-card"
                        data-testid={`role-item-${index}`}
                      >
                        <div className="flex items-center gap-3 flex-1">
                          <Users className="w-5 h-5 text-muted-foreground" />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{role.roleName}</p>
                            <div className="flex gap-2 flex-wrap">
                              <Badge variant="secondary" className="text-xs capitalize">{role.importance}</Badge>
                              <Badge variant="secondary" className="text-xs capitalize">{role.characterType}</Badge>
                              {role.characterAge && (
                                <Badge variant="secondary" className="text-xs">Age: {role.characterAge}</Badge>
                              )}
                            </div>
                          </div>
                        </div>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => {
                            setFilmRoles(filmRoles.filter((_, i) => i !== index));
                          }}
                          data-testid={`button-remove-role-${index}`}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {filmRoles.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No roles added yet</p>
                  <p className="text-sm">Define characters and select actors to cast them</p>
                </div>
              )}
            </CardContent>
          </Card>

          {filmRoles.length > 0 && (!filmRoles.some(r => r.importance === 'lead') || !filmRoles.some(r => r.importance === 'supporting')) && (
            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-700 text-sm flex items-start gap-2" data-testid="warning-roles-requirement">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>You must define at least 1 Lead role and 1 Supporting role.</span>
            </div>
          )}

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep('synopsis')} data-testid="button-back-to-synopsis">
              Back
            </Button>
            <Button 
              onClick={() => setStep('writer')} 
              disabled={!filmRoles.some(r => r.importance === 'lead') || !filmRoles.some(r => r.importance === 'supporting')}
              data-testid="button-next-to-writer"
            >
              Next: Select Writer
            </Button>
          </div>
        </div>
      )}

      {/* Writer Selection */}
      {step === 'writer' && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Select Writer
              </CardTitle>
              <CardDescription>Choose a writer to craft the screenplay for "{title}".</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {selectedWriter ? (
                <div className="flex items-center justify-between p-4 border rounded-lg bg-primary/10">
                  <div className="flex items-center gap-4">
                    <Avatar className="w-16 h-16">
                      {selectedWriter.imageUrl && <AvatarImage src={selectedWriter.imageUrl} alt={selectedWriter.name} />}
                      <AvatarFallback>{selectedWriter.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium text-lg">{selectedWriter.name}</p>
                      <div className="flex gap-4 text-sm text-muted-foreground mt-1">
                        <span>Fame: {selectedWriter.fame}</span>
                        <span>Performance: {selectedWriter.performance}</span>
                        <span>Experience: {selectedWriter.experience}</span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">{formatMoney(selectedWriter.askingPrice)}</p>
                    </div>
                  </div>
                  <Button variant="outline" onClick={() => setShowWriterSelector(true)} data-testid="button-change-writer">
                    Change
                  </Button>
                </div>
              ) : (
                <Button 
                  variant="outline" 
                  onClick={() => setShowWriterSelector(true)}
                  className="w-full h-12"
                  data-testid="button-select-writer"
                >
                  Choose a Writer
                </Button>
              )}
            </CardContent>
          </Card>

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep('roles')} data-testid="button-back-to-roles">
              Back
            </Button>
            <Button onClick={() => setStep('confirm')} disabled={!selectedWriter} data-testid="button-next-to-confirm">
              Next: Review & Create
            </Button>
          </div>
        </div>
      )}


      {/* Confirmation */}
      {step === 'confirm' && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="font-display text-2xl">{title}</CardTitle>
              <CardDescription>Review your film details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Genre</p>
                  <p className="font-medium">{selectedGenre ? genreLabels[selectedGenre] : '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Writer</p>
                  <p className="font-medium">{selectedWriter?.name || 'None selected'}</p>
                </div>
              </div>

              {/* Film Roles Summary */}
              {filmRoles.length > 0 && (
                <div className="border-t border-border pt-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Users className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Character Roles ({filmRoles.length})</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {filmRoles.map((role, index) => (
                      <Badge 
                        key={index} 
                        variant={role.importance === 'lead' ? 'default' : 'secondary'}
                        className="capitalize"
                      >
                        {role.roleName} ({role.importance})
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <div className="border-t border-border pt-4 space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Writer Cost</span>
                  <span>{formatMoney(selectedWriter?.askingPrice || 0)}</span>
                </div>
              </div>

              {!canAfford && (
                <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                  Insufficient budget. Select a cheaper writer.
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep('roles')} data-testid="button-back-to-roles">
              Back
            </Button>
            <Button 
              onClick={() => setShowConfirmDialog(true)} 
              disabled={!canAfford || !title.trim()}
              data-testid="button-create-film"
            >
              Create Film
            </Button>
          </div>
        </div>
      )}

      <Dialog open={showWriterSelector} onOpenChange={setShowWriterSelector}>
        <DialogContent className="max-w-5xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Select a Writer</DialogTitle>
            <DialogDescription>Choose based on genre expertise, performance, and experience</DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 px-4">
            <Button size="sm" variant={writerSortBy === 'name' ? 'default' : 'outline'} onClick={() => setWriterSortBy('name')} data-testid="button-sort-writer-name">
              Name
            </Button>
            <Button size="sm" variant={writerSortBy === 'fame' ? 'default' : 'outline'} onClick={() => setWriterSortBy('fame')} data-testid="button-sort-writer-fame">
              Fame
            </Button>
            <Button size="sm" variant={writerSortBy === 'performance' ? 'default' : 'outline'} onClick={() => setWriterSortBy('performance')} data-testid="button-sort-writer-performance">
              Performance
            </Button>
            <Button size="sm" variant={writerSortBy === 'price' ? 'default' : 'outline'} onClick={() => setWriterSortBy('price')} data-testid="button-sort-writer-price">
              Price
            </Button>
          </div>
          <ScrollArea className="h-[600px] pr-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pr-4">
              {writers.map(writer => {
                const genreKey = `skill${selectedGenre?.charAt(0).toUpperCase()}${selectedGenre?.slice(1)}` as keyof Talent;
                const genreSkill = (writer[genreKey] as number) || 50;
                return (
                  <div
                    key={writer.id}
                    onClick={() => setSelectedWriter(writer)}
                    className={`p-4 rounded-lg border cursor-pointer transition-all ${
                      selectedWriter?.id === writer.id
                        ? 'border-primary bg-primary/10 ring-2 ring-primary'
                        : 'border-border hover-elevate'
                    }`}
                    data-testid={`writer-card-${writer.id}`}
                  >
                    <Avatar className="mb-2 w-16 h-16">
                      {writer.imageUrl && <AvatarImage src={writer.imageUrl} alt={writer.name} />}
                      <AvatarFallback>{writer.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                    </Avatar>
                    <p className="font-medium text-sm truncate">{writer.name}</p>
                    <div className="flex items-center gap-1 my-2">
                      {Array.from({length: 5}).map((_, i) => (
                        <Star key={i} className={`w-3 h-3 ${i < Math.floor(writer.fame / 20) ? 'text-primary fill-primary' : 'text-muted-foreground'}`} />
                      ))}
                    </div>
                    <div className="space-y-1 text-xs text-muted-foreground">
                      <div className="flex justify-between">
                        <span>Fame:</span>
                        <span className="font-medium text-foreground">{writer.fame}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Performance:</span>
                        <span className="font-medium text-foreground">{writer.performance}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Experience:</span>
                        <span className="font-medium text-foreground">{writer.experience}</span>
                      </div>
                      <div className="flex justify-between border-t pt-1 mt-1">
                        <span>{selectedGenre} Skill:</span>
                        <span className="font-medium text-foreground">{genreSkill}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{formatMoney(writer.askingPrice)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowWriterSelector(false)} data-testid="button-close-writer-selector">
              Cancel
            </Button>
            <Button onClick={() => setShowWriterSelector(false)} disabled={!selectedWriter} data-testid="button-confirm-writer">
              Confirm Selection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showActorSelector} onOpenChange={setShowActorSelector}>
        <DialogContent className="max-w-5xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Select an Actor for {newRole.roleName}</DialogTitle>
            <DialogDescription>Choose based on performance, genre skills, and availability</DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 px-4">
            <Button size="sm" variant={actorSortBy === 'name' ? 'default' : 'outline'} onClick={() => setActorSortBy('name')} data-testid="button-sort-actor-name">
              Name
            </Button>
            <Button size="sm" variant={actorSortBy === 'fame' ? 'default' : 'outline'} onClick={() => setActorSortBy('fame')} data-testid="button-sort-actor-fame">
              Fame
            </Button>
            <Button size="sm" variant={actorSortBy === 'performance' ? 'default' : 'outline'} onClick={() => setActorSortBy('performance')} data-testid="button-sort-actor-performance">
              Performance
            </Button>
            <Button size="sm" variant={actorSortBy === 'price' ? 'default' : 'outline'} onClick={() => setActorSortBy('price')} data-testid="button-sort-actor-price">
              Price
            </Button>
          </div>
          <ScrollArea className="h-[600px] pr-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pr-4">
              {actors.filter(actor => {
                // Filter by gender
                if (newRole.genderPreference !== 'any' && actor.gender !== newRole.genderPreference) {
                  return false;
                }
                
                // Filter by age (within 5 years if character age is set)
                if (newRole.characterAge && actor.birthYear) {
                  const actorAge = 2025 - actor.birthYear;
                  if (Math.abs(actorAge - newRole.characterAge) > 5) {
                    return false;
                  }
                }
                
                return true;
              }).map(actor => {
                const isAlreadyAssigned = filmRoles.some(r => r.castId === actor.id);
                const genreKey = `skill${selectedGenre?.charAt(0).toUpperCase()}${selectedGenre?.slice(1)}` as keyof Talent;
                const genreSkill = (actor[genreKey] as number) || 50;
                return (
                  <div
                    key={actor.id}
                    onClick={() => !isAlreadyAssigned && setNewRole({...newRole, castId: actor.id})}
                    className={`p-4 rounded-lg border cursor-pointer transition-all ${
                      newRole.castId === actor.id 
                        ? 'border-primary bg-primary/10 ring-2 ring-primary' 
                        : isAlreadyAssigned 
                          ? 'opacity-50 cursor-not-allowed border-muted'
                          : 'border-border hover-elevate'
                    }`}
                    data-testid={`actor-card-${actor.id}`}
                  >
                    <Avatar className="mb-2 w-16 h-16">
                      {actor.imageUrl && <AvatarImage src={actor.imageUrl} alt={actor.name} />}
                      <AvatarFallback>{actor.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                    </Avatar>
                    <p className="font-medium text-sm truncate">{actor.name}</p>
                    <div className="flex items-center gap-1 my-2">
                      {Array.from({length: 5}).map((_, i) => (
                        <Star key={i} className={`w-3 h-3 ${i < Math.floor(actor.fame / 20) ? 'text-primary fill-primary' : 'text-muted-foreground'}`} />
                      ))}
                    </div>
                    <div className="space-y-1 text-xs text-muted-foreground">
                      <div className="flex justify-between">
                        <span>Performance:</span>
                        <span className="font-medium text-foreground">{actor.performance}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Experience:</span>
                        <span className="font-medium text-foreground">{actor.experience}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Fame:</span>
                        <span className="font-medium text-foreground">{actor.fame}</span>
                      </div>
                      <div className="flex justify-between border-t pt-1 mt-1">
                        <span>{selectedGenre} Skill:</span>
                        <span className="font-medium text-foreground">{genreSkill}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{formatMoney(actor.askingPrice)}</p>
                      {isAlreadyAssigned && <p className="text-xs text-destructive font-medium">Already cast</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowActorSelector(false)} data-testid="button-close-actor-selector">
              Cancel
            </Button>
            <Button onClick={() => setShowActorSelector(false)} disabled={!newRole.castId} data-testid="button-confirm-actor">
              Confirm Selection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Start Production?</DialogTitle>
            <DialogDescription>
              You're about to start production on "{title}" with a total budget of {formatMoney(totalBudget)}.
              This will be deducted from your studio budget.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirmDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateFilm} disabled={isCreating} data-testid="button-confirm-create">
              {isCreating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Start Production
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
