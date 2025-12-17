import { FinancialSummary } from '@/components/FinancialSummary';
import { ActiveProjects } from '@/components/ActiveProjects';
import { IndustryMagazine } from '@/components/IndustryMagazine';

export default function Dashboard() {
  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="font-display text-3xl">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Welcome back to your studio</p>
      </div>
      
      <FinancialSummary />
      
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div>
          <h2 className="font-display text-xl mb-4">Active Projects</h2>
          <ActiveProjects />
        </div>
        <IndustryMagazine />
      </div>
    </div>
  );
}
