import { useContext, useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { 
  Mail, 
  MailOpen, 
  Trash2, 
  RefreshCw, 
  Inbox, 
  Film,
  Tv,
  DollarSign,
  ArrowLeft,
  Check,
  X
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { GameContext, formatMoney, formatWeekDate } from '@/lib/gameState';
import { queryClient, apiRequest } from '@/lib/queryClient';
import type { Email } from '@shared/schema';

const typeIcons: Record<string, typeof Mail> = {
  streaming_offer: Tv,
  production_deal: Film,
  general: Mail,
};

const typeColors: Record<string, string> = {
  streaming_offer: 'bg-blue-500',
  production_deal: 'bg-green-500',
  general: 'bg-gray-500',
};

const typeLabels: Record<string, string> = {
  streaming_offer: 'Streaming Offer',
  production_deal: 'Production Deal',
  general: 'General',
};

function getPreviewText(body: string): string {
  return body.slice(0, 100).replace(/\n/g, ' ') + (body.length > 100 ? '...' : '');
}

function EmailListItem({ 
  email, 
  isSelected, 
  onSelect,
  currentWeek,
  currentYear
}: { 
  email: Email; 
  isSelected: boolean;
  onSelect: () => void;
  currentWeek: number;
  currentYear: number;
}) {
  const Icon = typeIcons[email.type] || Mail;
  const colorClass = typeColors[email.type] || 'bg-gray-500';
  
  const weeksAgo = (currentYear - email.sentYear) * 52 + (currentWeek - email.sentWeek);
  const timeLabel = weeksAgo === 0 ? 'This week' : weeksAgo === 1 ? '1 week ago' : `${weeksAgo} weeks ago`;
  
  return (
    <div 
      className={`p-4 cursor-pointer transition-colors border-b border-border ${
        isSelected ? 'bg-accent' : email.isRead ? 'bg-background hover-elevate' : 'bg-muted/50 hover-elevate'
      }`}
      onClick={onSelect}
      data-testid={`email-item-${email.id}`}
    >
      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 rounded-full ${colorClass} flex items-center justify-center flex-shrink-0`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`font-medium truncate ${!email.isRead ? 'text-foreground' : 'text-muted-foreground'}`}>
              {email.sender}
            </span>
            {email.hasAction && !email.isRead && (
              <Badge variant="destructive" className="text-xs">Action Required</Badge>
            )}
          </div>
          <p className={`text-sm truncate ${!email.isRead ? 'font-medium text-foreground' : 'text-muted-foreground'}`}>
            {email.subject}
          </p>
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
            {getPreviewText(email.body)}
          </p>
        </div>
        <div className="text-xs text-muted-foreground flex-shrink-0">
          {timeLabel}
        </div>
      </div>
    </div>
  );
}

function EmailDetail({ 
  email, 
  onBack, 
  onAction,
  currentWeek,
  currentYear
}: { 
  email: Email; 
  onBack: () => void;
  onAction: (action: string) => void;
  currentWeek: number;
  currentYear: number;
}) {
  const Icon = typeIcons[email.type] || Mail;
  const colorClass = typeColors[email.type] || 'bg-gray-500';
  const typeLabel = typeLabels[email.type] || 'General';
  
  const actionData = email.actionData as Record<string, unknown> | null;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 p-4 border-b border-border">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={onBack}
          className="md:hidden"
          data-testid="button-back-to-inbox"
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1" />
        {email.hasAction && email.actionLabel && (
          <>
            <Button 
              size="sm" 
              onClick={() => onAction('accept')}
              data-testid="button-accept-email"
            >
              <Check className="w-4 h-4 mr-2" />
              {email.actionLabel}
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => onAction('decline')}
              data-testid="button-decline-email"
            >
              <X className="w-4 h-4 mr-2" />
              Decline
            </Button>
          </>
        )}
      </div>
      
      <ScrollArea className="flex-1">
        <div className="p-6">
          <div className="flex items-start gap-4 mb-6">
            <div className={`w-14 h-14 rounded-full ${colorClass} flex items-center justify-center flex-shrink-0`}>
              <Icon className="w-7 h-7 text-white" />
            </div>
            <div className="flex-1">
              <h2 className="font-display text-2xl mb-1">{email.subject}</h2>
              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{email.sender}</span>
                {email.senderTitle && <span>&middot; {email.senderTitle}</span>}
                <span className="mx-1">&middot;</span>
                <span>{formatWeekDate(email.sentWeek, email.sentYear)}</span>
              </div>
              <Badge variant="secondary" className="mt-2">{typeLabel}</Badge>
            </div>
          </div>

          <div 
            className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap"
          >
            {email.body}
          </div>

          {actionData && Object.keys(actionData).length > 0 && (
            <Card className="mt-6">
              <CardContent className="p-4">
                <h4 className="font-medium mb-3 flex items-center gap-2">
                  <DollarSign className="w-4 h-4" />
                  Deal Details
                </h4>
                <div className="space-y-2 text-sm">
                  {'filmTitle' in actionData && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Film:</span>
                      <span>{String(actionData.filmTitle)}</span>
                    </div>
                  )}
                  {'offerAmount' in actionData && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Offer Amount:</span>
                      <span className="font-medium text-primary">{formatMoney(Number(actionData.offerAmount))}</span>
                    </div>
                  )}
                  {'streamingService' in actionData && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Platform:</span>
                      <span>{String(actionData.streamingService)}</span>
                    </div>
                  )}
                  {email.expiresWeek && email.expiresYear && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Expires:</span>
                      <span>{formatWeekDate(email.expiresWeek, email.expiresYear)}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

function EmptyInbox() {
  return (
    <div className="flex flex-col items-center justify-center h-full p-8 text-center">
      <div className="w-24 h-24 rounded-full bg-muted/50 flex items-center justify-center mb-6">
        <Inbox className="w-12 h-12 text-muted-foreground/50" />
      </div>
      <h3 className="font-display text-xl mb-2">Your Inbox is Empty</h3>
      <p className="text-muted-foreground max-w-md">
        When streaming platforms, award committees, or production companies want to reach you, their messages will appear here.
      </p>
    </div>
  );
}

function NoEmailSelected() {
  return (
    <div className="flex flex-col items-center justify-center h-full p-8 text-center">
      <div className="w-20 h-20 rounded-full bg-muted/50 flex items-center justify-center mb-4">
        <MailOpen className="w-10 h-10 text-muted-foreground/50" />
      </div>
      <h3 className="font-medium mb-2">Select an Email</h3>
      <p className="text-sm text-muted-foreground">
        Choose a message from your inbox to read it here.
      </p>
    </div>
  );
}

export default function EmailsPage() {
  const gameContext = useContext(GameContext);
  const { toast } = useToast();
  const [selectedEmailId, setSelectedEmailId] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('all');
  
  if (!gameContext) {
    return (
      <div className="p-6">
        <Skeleton className="h-[600px] w-full" />
      </div>
    );
  }

  const { state } = gameContext;

  const { data: emails = [], isLoading } = useQuery<Email[]>({
    queryKey: [`/api/emails?playerGameId=${state.studioId}`],
  });

  const markAsReadMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest('PATCH', `/api/emails/${id}`, { isRead: true });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/emails?playerGameId=${state.studioId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/emails/unread-count?playerGameId=${state.studioId}`] });
    },
  });

  const deleteEmailMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest('DELETE', `/api/emails/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/emails?playerGameId=${state.studioId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/emails/unread-count?playerGameId=${state.studioId}`] });
      setSelectedEmailId(null);
      toast({ title: 'Email deleted' });
    },
  });

  const handleSelectEmail = (email: Email) => {
    setSelectedEmailId(email.id);
    if (!email.isRead) {
      markAsReadMutation.mutate(email.id);
    }
  };

  const acceptActionMutation = useMutation({
    mutationFn: async (emailId: string) => {
      return await apiRequest('POST', `/api/emails/${emailId}/action`, {});
    },
    onSuccess: (data: { success: boolean; message: string }) => {
      queryClient.invalidateQueries({ queryKey: [`/api/emails?playerGameId=${state.studioId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/emails/unread-count?playerGameId=${state.studioId}`] });
      queryClient.invalidateQueries({ queryKey: ['/api/studio'] });
      queryClient.invalidateQueries({ queryKey: ['/api/streaming-deals'] });
      // Invalidate films query to show newly created films from first-look deals
      queryClient.invalidateQueries({ queryKey: ['/api/films'] });
      setSelectedEmailId(null);
      toast({
        title: 'Action Completed',
        description: data.message || 'The offer has been accepted.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to process action.',
        variant: 'destructive',
      });
    },
  });

  const handleAction = (action: string) => {
    const email = emails.find(e => e.id === selectedEmailId);
    if (!email) return;

    if (action === 'accept') {
      acceptActionMutation.mutate(email.id);
    } else {
      deleteEmailMutation.mutate(email.id);
      toast({
        title: 'Offer Declined',
        description: 'The offer has been declined.',
      });
    }
  };

  const filteredEmails = emails.filter(email => {
    if (filter === 'all') return true;
    if (filter === 'unread') return !email.isRead;
    if (filter === 'action') return email.hasAction;
    return email.type === filter;
  }).sort((a, b) => {
    const aTime = a.sentYear * 52 + a.sentWeek;
    const bTime = b.sentYear * 52 + b.sentWeek;
    return bTime - aTime;
  });

  const selectedEmail = emails.find(e => e.id === selectedEmailId);
  const unreadCount = emails.filter(e => !e.isRead).length;

  if (isLoading) {
    return (
      <div className="h-full flex">
        <div className="w-96 border-r border-border">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="p-4 border-b border-border">
              <Skeleton className="h-16 w-full" />
            </div>
          ))}
        </div>
        <div className="flex-1 p-6">
          <Skeleton className="h-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col md:flex-row">
      <div className={`w-full md:w-96 border-r border-border flex flex-col ${selectedEmail ? 'hidden md:flex' : ''}`}>
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="font-display text-xl">Inbox</h1>
              <p className="text-sm text-muted-foreground">
                {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
              </p>
            </div>
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => queryClient.invalidateQueries({ queryKey: ['/api/emails'] })}
              data-testid="button-refresh-emails"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
          
          <div className="flex gap-1 flex-wrap">
            <Button 
              variant={filter === 'all' ? 'secondary' : 'ghost'} 
              size="sm"
              onClick={() => setFilter('all')}
              data-testid="button-filter-all"
            >
              All
            </Button>
            <Button 
              variant={filter === 'unread' ? 'secondary' : 'ghost'} 
              size="sm"
              onClick={() => setFilter('unread')}
              data-testid="button-filter-unread"
            >
              Unread
            </Button>
            <Button 
              variant={filter === 'action' ? 'secondary' : 'ghost'} 
              size="sm"
              onClick={() => setFilter('action')}
              data-testid="button-filter-action"
            >
              Action Required
            </Button>
          </div>
        </div>

        <ScrollArea className="flex-1">
          {filteredEmails.length === 0 ? (
            <EmptyInbox />
          ) : (
            filteredEmails.map((email) => (
              <EmailListItem
                key={email.id}
                email={email}
                isSelected={email.id === selectedEmailId}
                onSelect={() => handleSelectEmail(email)}
                currentWeek={state.currentWeek}
                currentYear={state.currentYear}
              />
            ))
          )}
        </ScrollArea>
      </div>

      <div className={`flex-1 flex flex-col ${!selectedEmail ? 'hidden md:flex' : ''}`}>
        {selectedEmail ? (
          <EmailDetail 
            email={selectedEmail} 
            onBack={() => setSelectedEmailId(null)}
            onAction={handleAction}
            currentWeek={state.currentWeek}
            currentYear={state.currentYear}
          />
        ) : (
          <NoEmailSelected />
        )}
      </div>
    </div>
  );
}
