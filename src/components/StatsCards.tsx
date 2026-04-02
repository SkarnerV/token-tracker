import { useEffect } from 'react';
import { AlertCircle } from 'lucide-react';
import { useTokenStore } from '../stores/tokenStore';
import { formatTokenCount } from '../lib/timeRanges';
import { TimeRangeType } from '../types';

const TIME_RANGES: { value: TimeRangeType; label: string }[] = [
  { value: '5h', label: '5h' },
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'year', label: 'Year' },
  { value: 'all', label: 'All' },
];

export function StatsCards() {
  const { stats, isLoading, error, selectedRange, setSelectedRange, fetchStats } = useTokenStore();

  useEffect(() => {
    fetchStats();
  }, [fetchStats, selectedRange]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          Token Usage
        </h2>
        <div className="flex gap-2">
          {TIME_RANGES.map((range) => (
            <button
              key={range.value}
              onClick={() => setSelectedRange(range.value)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedRange === range.value
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              {range.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="text-sm font-medium text-red-800 dark:text-red-200">Failed to load statistics</h3>
            <p className="text-sm text-red-600 dark:text-red-400 mt-1">{error}</p>
            <button
              onClick={() => fetchStats()}
              className="mt-3 text-sm text-red-700 dark:text-red-300 hover:text-red-800 dark:hover:text-red-200 font-medium underline"
            >
              Try again
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center h-48">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-white" />
        </div>
      ) : !error && stats ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total Tokens"
            value={formatTokenCount(stats.totalTokens)}
            subtitle={`${formatTokenCount(stats.totalInput)} in / ${formatTokenCount(stats.totalOutput)} out`}
            color="blue"
          />
          <StatCard
            title="Input Tokens"
            value={formatTokenCount(stats.totalInput)}
            subtitle="Prompts + Context"
            color="green"
          />
          <StatCard
            title="Output Tokens"
            value={formatTokenCount(stats.totalOutput)}
            subtitle="Generated code"
            color="purple"
          />
          <StatCard
            title="Cache Efficiency"
            value={formatTokenCount(stats.totalCacheRead)}
            subtitle="Cache read tokens"
            color="orange"
          />
        </div>
      ) : (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          No data available. Click "Sync All" to import your token usage.
        </div>
      )}

      {stats && Object.keys(stats.byIde).length > 0 && (
        <div className="mt-8">
          <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
            By IDE
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Object.entries(stats.byIde).map(([ide, ideStats]) => (
              <div
                key={ide}
                className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border border-gray-200 dark:border-gray-700"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-400 capitalize">
                    {ide}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-500">
                    {ideStats.sessionCount} sessions
                  </span>
                </div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {formatTokenCount(
                    ideStats.inputTokens + ideStats.outputTokens + ideStats.cacheReadTokens
                  )}
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {formatTokenCount(ideStats.inputTokens)} in / {formatTokenCount(ideStats.outputTokens)} out
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

interface StatCardProps {
  title: string;
  value: string;
  subtitle: string;
  color: 'blue' | 'green' | 'purple' | 'orange';
}

function StatCard({ title, value, subtitle, color }: StatCardProps) {
  const colorClasses = {
    blue: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',
    green: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800',
    purple: 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800',
    orange: 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800',
  };

  return (
    <div className={`rounded-lg border p-6 ${colorClasses[color]}`}>
      <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
        {title}
      </h3>
      <div className="text-3xl font-bold text-gray-900 dark:text-white">
        {value}
      </div>
      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
        {subtitle}
      </p>
    </div>
  );
}
