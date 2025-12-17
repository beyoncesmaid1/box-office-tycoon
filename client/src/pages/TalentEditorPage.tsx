import { useState, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { Link } from 'wouter';
import {
  Search,
  Plus,
  Pencil,
  Trash2,
  Star,
  Film,
  ArrowLeft,
  User,
  Users,
  Camera,
  FileText,
  Filter,
  X,
  ChevronDown,
  ImageOff,
  AlertCircle,
  Loader2,
  Music
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import type { Talent, InsertTalent } from '@shared/schema';

const GENRES = ['action', 'comedy', 'drama', 'horror', 'scifi', 'romance', 'thriller', 'animation', 'fantasy', 'musicals'];
const NATIONALITIES = ['American', 'British', 'Canadian', 'Australian', 'French', 'German', 'Japanese', 'Korean', 'Indian', 'Mexican', 'Spanish', 'Italian', 'Chinese', 'Brazilian', 'Swedish', 'Irish', 'New Zealand', 'Other'];

interface TalentFormData {
  name: string;
  type: 'actor' | 'director' | 'writer' | 'composer';
  gender: 'male' | 'female' | 'unknown';
  nationality: string;
  genres: Record<string, number>;
  imageUrl: string;
  birthYear: number | null;
  popularity: number;
  isActive: boolean;
}

const defaultFormData: TalentFormData = {
  name: '',
  type: 'actor',
  gender: 'unknown',
  nationality: 'American',
  genres: {},
  imageUrl: '',
  birthYear: null,
  popularity: 50,
  isActive: true,
};

function formatMoney(amount: number): string {
  if (amount >= 1000000000) return `$${(amount / 1000000000).toFixed(1)}B`;
  if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`;
  if (amount >= 1000) return `$${(amount / 1000).toFixed(0)}K`;
  return `$${amount.toFixed(0)}`;
}

export default function TalentEditorPage({ onBack }: { onBack: () => void }) {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<'all' | 'actor' | 'director' | 'writer'>('all');
  const [selectedGender, setSelectedGender] = useState<'all' | 'male' | 'female'>('all');
  const [showRealOnly, setShowRealOnly] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedTalent, setSelectedTalent] = useState<Talent | null>(null);
  const [formData, setFormData] = useState<TalentFormData>(defaultFormData);
  const [isCreating, setIsCreating] = useState(false);

  const { data: allTalent = [], isLoading } = useQuery<Talent[]>({
    queryKey: ['/api/talent'],
  });

  const filteredTalent = useMemo(() => {
    return allTalent.filter(t => {
      const matchesSearch = t.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType = selectedType === 'all' || t.type === selectedType;
      const matchesGender = selectedGender === 'all' || t.gender === selectedGender;
      const matchesReal = !showRealOnly || !!t.imageUrl;
      return matchesSearch && matchesType && matchesGender && matchesReal;
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [allTalent, searchQuery, selectedType, selectedGender, showRealOnly]);

  const talentCounts = useMemo(() => {
    const counts = { all: 0, director: 0, actor: 0, writer: 0 };
    allTalent.forEach(t => {
      counts.all++;
      counts[t.type as keyof typeof counts]++;
    });
    return counts;
  }, [allTalent]);

  const createMutation = useMutation({
    mutationFn: async (data: InsertTalent) => {
      const res = await apiRequest('POST', '/api/talent', data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/talent'] });
      setShowEditDialog(false);
      resetForm();
      toast({ title: 'Success', description: 'Talent created successfully' });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message || 'Failed to create talent', variant: 'destructive' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<InsertTalent> }) => {
      const res = await apiRequest('PATCH', `/api/talent/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/talent'] });
      setShowEditDialog(false);
      resetForm();
      toast({ title: 'Success', description: 'Talent updated successfully' });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message || 'Failed to update talent', variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest('DELETE', `/api/talent/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/talent'] });
      setShowDeleteDialog(false);
      setSelectedTalent(null);
      toast({ title: 'Success', description: 'Talent deleted successfully' });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message || 'Failed to delete talent', variant: 'destructive' });
    },
  });

  const resetForm = () => {
    setFormData(defaultFormData);
    setSelectedTalent(null);
    setIsCreating(false);
  };

  const handleCreate = () => {
    setIsCreating(true);
    setSelectedTalent(null);
    setFormData(defaultFormData);
    setShowEditDialog(true);
  };

  const handleEdit = (talent: Talent) => {
    setIsCreating(false);
    setSelectedTalent(talent);
    setFormData({
      name: talent.name,
      type: talent.type as 'actor' | 'director' | 'writer' | 'composer',
      gender: talent.gender as 'male' | 'female' | 'unknown',
      nationality: talent.nationality,
      genres: (talent.genres as Record<string, number>) || {},
      imageUrl: talent.imageUrl || '',
      birthYear: talent.birthYear,
      popularity: talent.popularity,
      isActive: talent.isActive,
    });
    setShowEditDialog(true);
  };

  const handleDelete = (talent: Talent) => {
    setSelectedTalent(talent);
    setShowDeleteDialog(true);
  };

  const handleSubmit = () => {
    if (!formData.name.trim()) {
      toast({ title: 'Error', description: 'Name is required', variant: 'destructive' });
      return;
    }

    const data: InsertTalent = {
      name: formData.name.trim(),
      type: formData.type,
      gender: formData.gender,
      nationality: formData.nationality,
      genres: formData.genres as any,
      imageUrl: formData.imageUrl || null,
      birthYear: formData.birthYear,
      popularity: formData.popularity,
      isActive: formData.isActive,
    };

    if (isCreating) {
      createMutation.mutate(data);
    } else if (selectedTalent) {
      updateMutation.mutate({ id: selectedTalent.id, data });
    }
  };

  const updateGenreScore = (genre: string, score: number) => {
    setFormData(prev => ({
      ...prev,
      genres: {
        ...prev.genres,
        [genre]: Math.max(0, Math.min(100, score))
      }
    }));
  };

  const removeGenre = (genre: string) => {
    setFormData(prev => {
      const newGenres = { ...prev.genres };
      delete newGenres[genre];
      return { ...prev, genres: newGenres };
    });
  };

  const getTalentIcon = (type: string) => {
    switch (type) {
      case 'director': return Camera;
      case 'writer': return FileText;
      case 'composer': return Music;
      default: return User;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={onBack} data-testid="button-back">
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div>
                <h1 className="text-2xl font-display tracking-wide">Talent Editor</h1>
                <p className="text-sm text-muted-foreground">{allTalent.length} talent entries</p>
              </div>
            </div>
            <Button onClick={handleCreate} data-testid="button-create-talent">
              <Plus className="w-4 h-4 mr-2" />
              Add Talent
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <div className="flex flex-col lg:flex-row gap-6">
          <aside className="lg:w-64 shrink-0">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Filter className="w-4 h-4" />
                  Filters
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search talent..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                    data-testid="input-search-talent"
                  />
                  {searchQuery && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                      onClick={() => setSearchQuery('')}
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  )}
                </div>

                <div>
                  <Label className="text-xs text-muted-foreground mb-2 block">Type</Label>
                  <div className="space-y-1">
                    {(['all', 'director', 'actor', 'writer'] as const).map((type) => (
                      <Button
                        key={type}
                        variant={selectedType === type ? 'secondary' : 'ghost'}
                        size="sm"
                        className="w-full justify-between"
                        onClick={() => setSelectedType(type)}
                        data-testid={`filter-type-${type}`}
                      >
                        <span className="capitalize">{type === 'all' ? 'All Types' : type + 's'}</span>
                        <Badge variant="outline" className="ml-2">
                          {talentCounts[type]}
                        </Badge>
                      </Button>
                    ))}
                  </div>
                </div>

                <div>
                  <Label className="text-xs text-muted-foreground mb-2 block">Gender</Label>
                  <div className="space-y-1">
                    {(['all', 'male', 'female'] as const).map((gender) => (
                      <Button
                        key={gender}
                        variant={selectedGender === gender ? 'secondary' : 'ghost'}
                        size="sm"
                        className="w-full justify-start"
                        onClick={() => setSelectedGender(gender)}
                        data-testid={`filter-gender-${gender}`}
                      >
                        <span className="capitalize">{gender === 'all' ? 'All Genders' : gender}</span>
                      </Button>
                    ))}
                  </div>
                </div>

                <div>
                  <Label className="text-xs text-muted-foreground mb-2 block">Status</Label>
                  <div className="space-y-1">
                    <Button
                      variant={!showRealOnly ? 'secondary' : 'ghost'}
                      size="sm"
                      className="w-full justify-start"
                      onClick={() => setShowRealOnly(false)}
                      data-testid="filter-status-all"
                    >
                      All Talent
                    </Button>
                    <Button
                      variant={showRealOnly ? 'secondary' : 'ghost'}
                      size="sm"
                      className="w-full justify-start"
                      onClick={() => setShowRealOnly(true)}
                      data-testid="filter-status-real"
                    >
                      Real Only
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </aside>

          <div className="flex-1">
            <div className="mb-4 text-sm text-muted-foreground">
              Showing {filteredTalent.length} of {allTalent.length} talent
            </div>

            <div className="grid gap-3">
              {filteredTalent.map((talent) => {
                const Icon = getTalentIcon(talent.type);
                return (
                  <Card key={talent.id} className="hover-elevate" data-testid={`card-talent-${talent.id}`}>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-4">
                        <Avatar className="w-14 h-14 rounded-lg">
                          {talent.imageUrl ? (
                            <AvatarImage src={talent.imageUrl} alt={talent.name} />
                          ) : null}
                          <AvatarFallback className="rounded-lg bg-muted">
                            <Icon className="w-6 h-6 text-muted-foreground" />
                          </AvatarFallback>
                        </Avatar>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold truncate" data-testid={`text-talent-name-${talent.id}`}>
                              {talent.name}
                            </h3>
                            <Badge variant="outline" className="capitalize text-xs">
                              {talent.type}
                            </Badge>
                            {talent.imageUrl && (
                              <Badge className="bg-green-600 text-white text-xs">Real</Badge>
                            )}
                            {!talent.isActive && (
                              <Badge variant="secondary" className="text-xs">Inactive</Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground flex-wrap">
                            <span>{talent.nationality}</span>
                            {talent.awards > 0 && (
                              <span className="flex items-center gap-1">
                                🏆 {talent.awards}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(talent)}
                            data-testid={`button-edit-${talent.id}`}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(talent)}
                            data-testid={`button-delete-${talent.id}`}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}

              {filteredTalent.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No talent found matching your filters</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>{isCreating ? 'Add New Talent' : `Edit ${selectedTalent?.name}`}</DialogTitle>
            <DialogDescription>
              {isCreating ? 'Create a new talent entry for your game.' : 'Update talent information.'}
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="flex-1 pr-4">
            <div className="space-y-6 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label htmlFor="name">Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Enter talent name"
                    data-testid="input-talent-name"
                  />
                </div>

                <div>
                  <Label>Type *</Label>
                  <Select
                    value={formData.type}
                    onValueChange={(value: 'actor' | 'director' | 'writer' | 'composer') => 
                      setFormData(prev => ({ ...prev, type: value }))
                    }
                  >
                    <SelectTrigger data-testid="select-talent-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="actor">Actor/Actress</SelectItem>
                      <SelectItem value="director">Director</SelectItem>
                      <SelectItem value="writer">Writer</SelectItem>
                      <SelectItem value="composer">Composer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Gender</Label>
                  <Select
                    value={formData.gender}
                    onValueChange={(value: 'male' | 'female' | 'unknown') => 
                      setFormData(prev => ({ ...prev, gender: value }))
                    }
                  >
                    <SelectTrigger data-testid="select-talent-gender">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                      <SelectItem value="unknown">Unknown</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Nationality</Label>
                  <Select
                    value={formData.nationality}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, nationality: value }))}
                  >
                    <SelectTrigger data-testid="select-talent-nationality">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {NATIONALITIES.map((nat) => (
                        <SelectItem key={nat} value={nat}>{nat}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Popularity (1-100)</Label>
                  <Input
                    type="number"
                    min={1}
                    max={100}
                    value={formData.popularity}
                    onChange={(e) => setFormData(prev => ({ ...prev, popularity: Math.min(100, Math.max(1, parseInt(e.target.value) || 50)) }))}
                    data-testid="input-talent-popularity"
                  />
                </div>

                <div>
                  <Label>Birth Year</Label>
                  <Input
                    type="number"
                    placeholder="e.g. 1970"
                    value={formData.birthYear || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, birthYear: e.target.value ? parseInt(e.target.value) : null }))}
                    data-testid="input-talent-birthyear"
                  />
                </div>

                <div className="col-span-2">
                  <Label>Profile Image URL</Label>
                  <div className="flex gap-2 flex-1">
                    <Input
                      value={formData.imageUrl || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, imageUrl: e.target.value.trim() }))}
                      placeholder="https://upload.wikimedia.org/..."
                      data-testid="input-talent-image"
                      className="flex-1"
                    />
                    {formData.imageUrl && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setFormData(prev => ({ ...prev, imageUrl: '' }))}
                        title="Clear image URL"
                        className="shrink-0"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    )}
                    {formData.imageUrl && (
                      <Avatar className="w-10 h-10 shrink-0">
                        <AvatarImage src={formData.imageUrl} alt={formData.name} />
                        <AvatarFallback>
                          <ImageOff className="w-4 h-4" />
                        </AvatarFallback>
                      </Avatar>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Use a direct image URL (recommended: Wikimedia Commons)
                  </p>
                </div>
              </div>

              <div>
                <Label className="mb-2 block">Genre Scores (0-100)</Label>
                <div className="grid grid-cols-2 gap-3">
                  {GENRES.map((genre) => (
                    <div key={genre} className="flex items-center gap-2">
                      <label className="capitalize text-sm min-w-20">{genre}</label>
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        value={formData.genres[genre] ?? 0}
                        onChange={(e) => updateGenreScore(genre, parseInt(e.target.value) || 0)}
                        placeholder="0"
                        className="w-16 text-center"
                        data-testid={`input-genre-${genre}`}
                      />
                      {formData.genres[genre] ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="w-6 h-6"
                          onClick={() => removeGenre(genre)}
                          data-testid={`button-remove-genre-${genre}`}
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </ScrollArea>

          <DialogFooter className="pt-4 border-t">
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
              data-testid="button-save-talent"
            >
              {(createMutation.isPending || updateMutation.isPending) && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              {isCreating ? 'Create Talent' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedTalent?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete this talent from the game.
              <br /><br />
              <strong>Note:</strong> If this talent is assigned to any films, they cannot be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => selectedTalent && deleteMutation.mutate(selectedTalent.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4 mr-2" />
              )}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
