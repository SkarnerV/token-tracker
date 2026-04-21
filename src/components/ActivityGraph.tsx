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

  // Format date as YYYY-MM-DD in local timezone (not UTC)
  const formatLocalDate = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const { weeks, monthLabels } = useMemo(() => {
    // Aggregate contribution data by date (backend returns one entry per date+IDE)
    const dateTotals = new Map<string, number>();
    contributionData.forEach((day) => {
      const existing = dateTotals.get(day.date) || 0;
      dateTotals.set(day.date, existing + day.count);
    });

    // Calculate max count for level thresholds
    const maxCount = Math.max(...Array.from(dateTotals.values()), 0);
    const threshold = Math.max(maxCount / 4, 1);

    // Create final data map with recalculated levels
    const dataMap = new Map<string, { date: string; count: number; level: number }>();
    dateTotals.forEach((count, date) => {
      const level = count === 0 ? 0 : Math.min(4, Math.ceil(count / threshold));
      dataMap.set(date, { date, count, level });
    });

    // Generate all dates for the full year calendar (always, even if no data)
    const today = new Date();
    const endDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const startDate = new Date(endDate);
    startDate.setFullYear(startDate.getFullYear() - 1);

    // Adjust start date to be a Sunday (beginning of the first week)
    const startDayOfWeek = startDate.getDay();
    startDate.setDate(startDate.getDate() - startDayOfWeek);

    const allDays: { date: string; count: number; level: number }[] = [];
    const current = new Date(startDate);

    while (current <= endDate) {
      const dateStr = formatLocalDate(current);
      const data = dataMap.get(dateStr);
      allDays.push(data || { date: dateStr, count: 0, level: 0 });
      current.setDate(current.getDate() + 1);
    }

    // Group days into weeks (each week is a column)
    const grouped: WeekData[] = [];
    for (let i = 0; i < allDays.length; i += 7) {
      const weekDays = allDays.slice(i, i + 7);
      // Ensure we have exactly 7 days (pad if needed)
      while (weekDays.length < 7) {
        const lastDate = weekDays.length > 0 ? weekDays[weekDays.length - 1].date : formatLocalDate(endDate);
        const nextDate = new Date(lastDate + 'T00:00:00');
        nextDate.setDate(nextDate.getDate() + 1);
        weekDays.push({ date: formatLocalDate(nextDate), count: 0, level: 0 });
      }
      grouped.push({
        days: weekDays,
        year: new Date(weekDays[0].date + 'T00:00:00').getFullYear(),
        month: new Date(weekDays[0].date + 'T00:00:00').getMonth(),
      });
    }

    // Generate month labels
    const labels: { month: string; position: number }[] = [];
    let lastMonth = -1;
    let lastYear = -1;

    grouped.forEach((week, index) => {
      const firstDay = week.days[0];
      if (!firstDay) return;

      const date = new Date(firstDay.date + 'T00:00:00');
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

  // Don't show "no data" message - calendar grid should always be visible

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