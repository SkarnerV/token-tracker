import { useEffect } from 'react';
import { useTokenStore } from '../stores/tokenStore';
import { formatTokenCount } from '../lib/timeRanges';
import { TimeRangeType } from '../types';

const TIME_RANGES: { value: TimeRangeType; label: string }[] = [
  { value: '5h', label: '5H' },
  { value: 'day', label: 'DAY' },
  { value: 'week', label: 'WEEK' },
  { value: 'month', label: 'MONTH' },
  { value: 'year', label: 'YEAR' },
];

export function StatsCards() {
  const { stats, isLoading, selectedRange, setSelectedRange, fetchStats } = useTokenStore();

  useEffect(() => {
    fetchStats();
  }, [fetchStats, selectedRange]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48 bg-industrial-800">
        <div className="animate-spin w-8 h-8 border-2 border-industrial-100" />
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="bg-industrial-800 p-8 text-center">
        <p className="font-mono text-industrial-400">
          No data available. Click "SYNC ALL" to import your token usage.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-industrial-800 p-5">
      <div className="flex items-center gap-5 mb-4 h-14 px-4">
        <h2 className="text-lg font-bold font-sans tracking-wide text-industrial-100">
          STATISTICS
        </h2>
        <div className="flex-1 h-0.5 bg-industrial-600" />
        <div className="flex gap-1">
          {TIME_RANGES.map((range) => (
            <button
              key={range.value}
              onClick={() => setSelectedRange(range.value)}
              className={`h-9 px-4 font-mono text-sm font-medium transition-colors ${
                selectedRange === range.value
                  ? 'bg-accent-cyan text-industrial-black font-bold'
                  : 'bg-industrial-600 text-industrial-300 hover:bg-industrial-500'
              }`}
            >
              {range.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-5">
        <StatCard
          title="TOTAL TOKENS"
          value={formatTokenCount(stats.totalTokens)}
          subtitle={`${formatTokenCount(stats.totalInput)} IN | ${formatTokenCount(stats.totalOutput)} OUT`}
          accentColor="white"
        />
        <StatCard
          title="INPUT TOKENS"
          value={formatTokenCount(stats.totalInput)}
          subtitle="PROMPTS + CONTEXT"
          accentColor="gray"
        />
        <StatCard
          title="OUTPUT TOKENS"
          value={formatTokenCount(stats.totalOutput)}
          subtitle="GENERATED CODE"
          accentColor="cyan"
        />
        <StatCard
          title="CACHE EFFICIENCY"
          value={formatTokenCount(stats.totalCacheRead)}
          subtitle="CACHE READ"
          accentColor="dark"
        />
      </div>
    </div>
  );
}

interface StatCardProps {
  title: string;
  value: string;
  subtitle: string;
  accentColor: 'white' | 'gray' | 'cyan' | 'dark';
}

function StatCard({ title, value, subtitle, accentColor }: StatCardProps) {
  const accentClasses = {
    white: 'bg-industrial-100',
    gray: 'bg-industrial-400',
    cyan: 'bg-accent-cyan',
    dark: 'bg-industrial-600',
  };

  const textClasses = {
    white: 'text-industrial-100',
    gray: 'text-industrial-400',
    cyan: 'text-accent-cyan',
    dark: 'text-industrial-600',
  };

  return (
    <div className="bg-industrial-700 p-5 flex flex-col gap-5">
      <div className={`h-1 ${accentClasses[accentColor]}`} />
      <h3 className={`text-sm font-semibold font-sans tracking-wide ${textClasses[accentColor]}`}>
        {title}
      </h3>
      <div className="text-5xl font-bold font-mono text-industrial-100">
        {value}
      </div>
      <p className="text-sm font-mono text-industrial-300">
        {subtitle}
      </p>
    </div>
  );
}