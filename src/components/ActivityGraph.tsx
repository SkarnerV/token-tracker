import { useEffect, useMemo, useState } from 'react';
import { useTokenStore } from '../stores/tokenStore';
import { formatTokenCount } from '../lib/timeRanges';

const MONTH_ABBREVIATIONS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAY_LABELS = ['', 'Mon', '', 'Wed', '', 'Fri', ''];

const LEVEL_COLORS = [
  'bg-industrial-700',
  'bg-industrial-600',
  'bg-industrial-400',
  'bg-industrial-200',
  'bg-industrial-100',
];

interface TooltipData {
  date: string;
  count: number;
  x: number;
  y: number;
}

interface WeekData {
  days: ({ date: string; count: number; level: number } | null)[];
  year: number;
  month: number;
}

export function ActivityGraph() {
  const { contributionData, isLoading, fetchContributionGraph, selectedIdes } = useTokenStore();
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);

  useEffect(() => {
    fetchContributionGraph();
  }, [fetchContributionGraph, selectedIdes]);

  const { weeks, monthLabels } = useMemo(() => {
    const grouped: WeekData[] = [];
    let currentWeek: ({ date: string; count: number; level: number } | null)[] = [];

    contributionData.forEach((day, index) => {
      const date = new Date(day.date);
      const dayOfWeek = date.getDay();

      if (dayOfWeek === 0 && currentWeek.length > 0) {
        const weekDate = new Date(currentWeek.find(d => d)?.date || day.date);
        grouped.push({
          days: currentWeek,
          year: weekDate.getFullYear(),
          month: weekDate.getMonth(),
        });
        currentWeek = [];
      }

      currentWeek[dayOfWeek] = day;

      if (index === contributionData.length - 1 && currentWeek.length > 0) {
        const weekDate = new Date(currentWeek.find(d => d)?.date || day.date);
        grouped.push({
          days: currentWeek,
          year: weekDate.getFullYear(),
          month: weekDate.getMonth(),
        });
      }
    });

    const labels: { month: string; position: number }[] = [];
    let lastMonth = -1;
    let lastYear = -1;

    grouped.forEach((week, index) => {
      const firstDayOfWeek = week.days.find(d => d);
      if (!firstDayOfWeek) return;

      const date = new Date(firstDayOfWeek.date);
      const month = date.getMonth();
      const year = date.getFullYear();

      if (month !== lastMonth || year !== lastYear) {
        labels.push({
          month: MONTH_ABBREVIATIONS[month],
          position: index,
        });
        lastMonth = month;
        lastYear = year;
      }
    });

    return { weeks: grouped, monthLabels: labels };
  }, [contributionData]);

  if (isLoading) {
    return (
      <div className="flex-1 bg-industrial-800 p-5 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-industrial-100" />
      </div>
    );
  }

  if (weeks.length === 0) {
    return (
      <div className="flex-1 bg-industrial-800 p-5 flex items-center justify-center">
        <p className="font-mono text-industrial-400">No activity data available</p>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-industrial-800 p-5 flex flex-col gap-5">
      <div className="flex items-center gap-4 h-10">
        <h3 className="text-base font-bold font-sans tracking-wide text-industrial-100">
          ACTIVITY MATRIX
        </h3>
        <div className="flex-1 h-0.5 bg-industrial-600" />
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex gap-2 relative h-5">
          <div className="w-6" />
          <div className="flex-1 relative">
            {monthLabels.map((label, index) => {
              const nextLabel = monthLabels[index + 1];
              const width = nextLabel
                ? (nextLabel.position - label.position) * 14
                : (weeks.length - label.position) * 14;
              return (
                <span
                  key={`${label.month}-${label.position}`}
                  className="absolute text-xs font-mono text-industrial-400"
                  style={{
                    left: label.position * 14,
                    width: Math.max(width, 28),
                  }}
                >
                  {label.month}
                </span>
              );
            })}
          </div>
        </div>

        <div className="flex gap-2 relative">
          <div className="flex flex-col gap-0.5">
            {DAY_LABELS.map((day, i) => (
              <div key={i} className="h-3 flex items-center">
                <span className="text-xs font-mono text-industrial-400 w-6">
                  {day}
                </span>
              </div>
            ))}
          </div>

          <div className="flex gap-0.5 flex-1 overflow-x-auto">
            {weeks.map((week, weekIndex) => (
              <div key={weekIndex} className="flex flex-col gap-0.5">
                {Array.from({ length: 7 }).map((_, dayIndex) => {
                  const day = week.days[dayIndex];
                  if (!day) return <div key={dayIndex} className="w-3 h-3" />;

                  const level = Math.min(4, Math.max(0, day.level));
                  const colorClass = LEVEL_COLORS[level];

                  return (
                    <div
                      key={dayIndex}
                      className={`w-3 h-3 ${colorClass} cursor-pointer hover:opacity-80 transition-opacity relative`}
                      onMouseEnter={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        setTooltip({
                          date: day.date,
                          count: day.count,
                          x: rect.left + rect.width / 2,
                          y: rect.top,
                        });
                      }}
                      onMouseLeave={() => setTooltip(null)}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2">
          <span className="text-xs font-mono text-industrial-400">LESS</span>
          {LEVEL_COLORS.map((color, i) => (
            <div key={i} className={`w-3 h-3 ${color}`} />
          ))}
          <span className="text-xs font-mono text-industrial-100">MORE</span>
        </div>

        <p className="text-xs font-mono text-industrial-500 text-center">
          Hover over cells to view daily consumption data
        </p>
      </div>

      {tooltip && (
        <div
          className="fixed z-50 bg-industrial-700 border border-industrial-600 px-3 py-2 text-xs font-mono pointer-events-none"
          style={{
            left: tooltip.x,
            top: tooltip.y - 40,
            transform: 'translateX(-50%)',
          }}
        >
          <div className="text-industrial-100 font-bold">{tooltip.date}</div>
          <div className="text-accent-cyan">{formatTokenCount(tooltip.count)} tokens</div>
        </div>
      )}
    </div>
  );
}