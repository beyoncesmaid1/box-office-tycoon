import { SidebarProvider } from '@/components/ui/sidebar';
import { AppSidebar } from '../AppSidebar';
import { GameProvider } from '@/lib/gameState';

export default function AppSidebarExample() {
  return (
    <GameProvider>
      <SidebarProvider defaultOpen={true}>
        <AppSidebar />
      </SidebarProvider>
    </GameProvider>
  );
}
