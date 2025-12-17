import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatMoney } from '@/lib/gameState';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, TooltipProps } from 'recharts';

interface CountryBreakdownProps {
  boxOfficeByCountry: Record<string, number>;
  totalBoxOffice: number;
  weeklyBoxOfficeByCountry?: Record<string, number>;
  theaterCount?: number;
}

const CustomTooltip = (props: TooltipProps<number, string>) => {
  const { active, payload } = props;
  if (active && payload && payload.length) {
    const value = payload[0].value ?? 0;
    const country = payload[0].payload?.country ?? 'Unknown';
    const theaters = payload[0].payload?.theaters ?? 0;
    return (
      <div style={{
        backgroundColor: 'hsl(var(--card))',
        border: '1px solid hsl(var(--border))',
        borderRadius: '8px',
        padding: '8px 12px',
        color: 'white',
      }}>
        <p className="font-medium text-white">{country}</p>
        <p className="text-white">{formatMoney(value)}</p>
        {theaters > 0 && <p className="text-xs text-gray-200 mt-1">{theaters.toLocaleString()} theaters</p>}
      </div>
    );
  }
  return null;
};

export function BoxOfficeCountryBreakdown({ boxOfficeByCountry, totalBoxOffice, weeklyBoxOfficeByCountry, theaterCount = 0 }: CountryBreakdownProps) {
  const countryData = Object.entries(boxOfficeByCountry)
    .map(([country, amount]) => {
      const percentage = totalBoxOffice > 0 ? (amount / totalBoxOffice) : 0;
      return {
        country: country.replace(' & Ireland', '').replace('Other Territories', 'Other Countries'),
        amount,
        percentage: (percentage * 100).toFixed(1),
        weeklyAmount: weeklyBoxOfficeByCountry ? (weeklyBoxOfficeByCountry[country] || 0) : 0,
        theaters: Math.round(theaterCount * percentage),
      };
    })
    .sort((a, b) => b.amount - a.amount);

  const colors = [
    'hsl(var(--primary))',
    'hsl(var(--destructive))',
    'hsl(var(--chart-1))',
    'hsl(var(--chart-2))',
    'hsl(var(--chart-3))',
    'hsl(var(--chart-4))',
    'hsl(var(--chart-5))',
    'hsl(var(--muted-foreground) / 0.7)',
    'hsl(var(--muted-foreground) / 0.6)',
    'hsl(var(--muted-foreground) / 0.5)',
    'hsl(var(--muted-foreground) / 0.4)',
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Box Office by Territory</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={countryData} layout="vertical" margin={{ left: 120 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis type="number" tickFormatter={(v) => formatMoney(v)} tick={{ fill: 'hsl(var(--muted-foreground))' }} />
              <YAxis type="category" dataKey="country" width={110} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0, 0, 0, 0.1)' }} />
              <Bar dataKey="amount" radius={[0, 4, 4, 0]}>
                {countryData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="space-y-2">
          {countryData.map((entry) => (
            <div key={entry.country} className="flex items-center justify-between text-sm p-2 rounded-md bg-muted/30">
              <span className="font-medium">{entry.country}</span>
              <div className="text-right">
                <p className="font-medium">{formatMoney(entry.amount)}</p>
                {entry.theaters > 0 && (
                  <p className="text-xs text-muted-foreground">{entry.theaters.toLocaleString()} Theaters</p>
                )}
                {weeklyBoxOfficeByCountry && (
                  <p className="text-xs text-muted-foreground">This week: {formatMoney(entry.weeklyAmount)}</p>
                )}
                {!weeklyBoxOfficeByCountry && !entry.theaters && (
                  <p className="text-xs text-muted-foreground">{entry.percentage}%</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
