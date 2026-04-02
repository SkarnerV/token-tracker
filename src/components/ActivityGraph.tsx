import { useEffect, useMemo } from 'react';
import { AlertCircle } from 'lucide-react';
import { useTokenStore } from '../stores/tokenStore';
import { IDE_COLORS, IDE_LABELS } from '../types';
import { formatTokenCount } from '../lib/timeRanges';

const LEVEL_COLORS = [
  'bg-gray-100 dark:bg-gray-800',
  'bg-green-300 dark:bg-green-900',
  'bg-green-400 dark:bg-green-700',
  'bg-green-500 dark:bg-green-600',
  'bg-green-600 dark:bg-green-500',
];

export function ActivityGraph() {
  const { contributionData, isLoading, error, fetchContributionGraph, selectedIdes } = useTokenStore();

  useEffect(() => {
    fetchContributionGraph();
  }, [fetchContributionGraph, selectedIdes]);

  const weeks = useMemo(() => {
    const grouped: { date: string; count: number; level: number }[][] = [];
    let currentWeek: { date: string; count: number; level: number }[] = [];

    contributionData.forEach((day, index) => {
      const date = new Date(day.date);
      const dayOfWeek = date.getDay();

      if (dayOfWeek === 0 && currentWeek.length > 0) {
        grouped.push(currentWeek);
        currentWeek = [];
      }

      currentWeek.push(day);

      if (index === contributionData.length - 1 && currentWeek.length > 0) {
        grouped.push(currentWeek);
      }
    });

    return grouped;
  }, [contributionData]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-white" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-6">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="text-sm font-medium text-red-800 dark:text-red-200">Failed to load activity graph</h3>
            <p className="text-sm text-red-600 dark:text-red-400 mt-1">{error}</p>
            <button
              onClick={() => fetchContributionGraph()}
              className="mt-3 text-sm text-red-700 dark:text-red-300 hover:text-red-800 dark:hover:text-red-200 font-medium underline"
            >
              Try again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
        Token Activity
      </h3>
      
      <div className="overflow-x-auto">
        <div className="flex gap-1 min-w-max">
          {weeks.map((week, weekIndex) => (
            <div key={weekIndex} className="flex flex-col gap-1">
              {Array.from({ length: 7 }).map((_, dayIndex) => {
                const day = week[dayIndex];
                if (!day) return <div key={dayIndex} className="w-3 h-3" />;

                const level = Math.min(4, Math.max(0, day.level));
                const colorClass = LEVEL_COLORS[level];

                return (
                  <div
                    key={dayIndex}
                    className={`w-3 h-3 rounded-sm ${colorClass} hover:ring-2 hover:ring-gray-400 dark:hover:ring-gray-500 transition-all cursor-pointer`}
                    title={`${day.date}: ${formatTokenCount(day.count)} tokens`}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between mt-4 text-sm text-gray-600 dark:text-gray-400">
        <span>Less</span>
        <div className="flex gap-1">
          {LEVEL_COLORS.map((color, i) => (
            <div key={i} className={`w-3 h-3 rounded-sm ${color}`} />
          ))}
        </div>
        <span>More</span>
      </div>

      <div className="mt-4 flex gap-4">
        {selectedIdes.map((ide) => (
          <div key={ide} className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: IDE_COLORS[ide] }}
            />
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {IDE_LABELS[ide]}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
