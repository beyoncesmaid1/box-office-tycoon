import { Link, useLocation } from 'wouter';
import { useContext } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  LayoutDashboard, 
  Film, 
  TrendingUp, 
  Library, 
  Trophy,
  Clapperboard,
  DollarSign,
  Calendar,
  Tv,
  Mail,
  MonitorPlay
} from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
} from '@/components/ui/sidebar';
import { Badge } from '@/components/ui/badge';
import { GameContext, formatMoney } from '@/lib/gameState';
import { DateWithWeek } from './DateWithWeek';

const navItems = [
  { title: 'Dashboard', url: '/', icon: LayoutDashboard },
  { title: 'Develop Film', url: '/develop', icon: Film },
  { title: 'TV Shows', url: '/tv-shows', icon: MonitorPlay },
  { title: 'Box Office', url: '/boxoffice', icon: TrendingUp },
  { title: 'Release Calendar', url: '/calendar', icon: Calendar },
  { title: 'Film Library', url: '/library', icon: Library },
  { title: 'Streaming', url: '/streaming', icon: Tv },
  { title: 'Emails', url: '/emails', icon: Mail },
  { title: 'Awards', url: '/awards', icon: Trophy },
];

export function AppSidebar() {
  const [location] = useLocation();
  const gameContext = useContext(GameContext);
  
  // Get unread email count
  const { data: unreadData } = useQuery<{ count: number }>({
    queryKey: [`/api/emails/unread-count?playerGameId=${gameContext?.state.studioId}`],
    enabled: !!gameContext?.state.studioId,
  });
  const unreadCount = unreadData?.count || 0;
  
  // If not in a game context, return a minimal sidebar
  if (!gameContext) {
    return (
      <Sidebar>
        <SidebarHeader className="p-4 border-b border-sidebar-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
              <Clapperboard className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-display text-xl tracking-wide text-sidebar-foreground">Loading...</h1>
              <p className="text-xs text-sidebar-foreground/60">Film Studio Simulator</p>
            </div>
          </div>
        </SidebarHeader>
      </Sidebar>
    );
  }

  const { state } = gameContext;

  return (
    <Sidebar>
      <SidebarHeader className="p-4 border-b border-sidebar-border">
        <Link href="/" className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
            <Clapperboard className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-display text-xl tracking-wide text-sidebar-foreground" data-testid="text-studio-name">
              {state.studioName}
            </h1>
            <p className="text-xs text-sidebar-foreground/60">Film Studio Simulator</p>
          </div>
        </Link>
      </SidebarHeader>
      
      <SidebarContent className="overflow-y-auto">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={location === item.url}
                    data-testid={`link-nav-${item.title.toLowerCase().replace(' ', '-')}`}
                  >
                    <Link href={item.url}>
                      <item.icon className="w-4 h-4" />
                      <span className="flex-1">{item.title}</span>
                      {item.title === 'Emails' && unreadCount > 0 && (
                        <Badge variant="destructive" className="ml-auto h-5 min-w-5 px-1.5 text-xs">
                          {unreadCount > 99 ? '99+' : unreadCount}
                        </Badge>
                      )}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4 border-t border-sidebar-border">
        <div className="rounded-lg bg-sidebar-accent p-4">
          <div className="flex items-center gap-2 text-sidebar-foreground/60 text-sm mb-1">
            <DollarSign className="w-4 h-4" />
            <span>Studio Budget</span>
          </div>
          <p className="font-display text-2xl text-primary" data-testid="text-budget">
            {formatMoney(state.budget)}
          </p>
          <div className="mt-1">
            <DateWithWeek week={state.currentWeek} year={state.currentYear} size="sm" />
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
