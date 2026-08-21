import { formatWeekDate, getWeekNumber } from '@/lib/gameState';

interface DateWithWeekProps {
  week: number;
  year: number;
  size?: 'sm' | 'md' | 'lg';
}

export function DateWithWeek({ week, year, size = 'md' }: DateWithWeekProps) {
  const dateText = formatWeekDate(week, year);
  const weekText = getWeekNumber(week);

  const containerClasses = {
    sm: 'leading-tight',
    md: 'leading-snug',
    lg: 'leading-normal',
  };

  const dateClasses = {
    sm: 'text-sm font-medium',
    md: 'text-base font-medium',
    lg: 'text-lg font-semibold',
  };

  const weekClasses = {
    sm: 'text-xs text-muted-foreground',
    md: 'text-xs text-muted-foreground',
    lg: 'text-sm text-muted-foreground',
  };

  return (
    <div className={containerClasses[size]}>
      <div className={dateClasses[size]}>{dateText}</div>
      <div className={weekClasses[size]}>{weekText}</div>
    </div>
  );
}
