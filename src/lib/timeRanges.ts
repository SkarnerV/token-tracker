import { TimeRange, TimeRangeType } from '../types';

export function getTimeRange(rangeType: TimeRangeType): TimeRange {
  const now = new Date();
  const endTs = Math.floor(now.getTime() / 1000);
  let startTs: number;

  switch (rangeType) {
    case '5h':
      startTs = endTs - 5 * 60 * 60;
      break;
    case 'day':
      startTs = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() / 1000;
      break;
    case 'week':
      startTs = endTs - 7 * 24 * 60 * 60;
      break;
    case 'month':
      startTs = new Date(now.getFullYear(), now.getMonth(), 1).getTime() / 1000;
      break;
    case 'year':
      startTs = new Date(now.getFullYear(), 0, 1).getTime() / 1000;
      break;
    case 'all':
    default:
      startTs = 0;
      break;
  }

  return {
    label: rangeType,
    startTs: Math.floor(startTs),
    endTs,
  };
}

export function getContributionGraphRange(): { startDate: string; endDate: string } {
  const end = new Date();
  const start = new Date();
  start.setFullYear(start.getFullYear() - 1);

  return {
    startDate: formatDate(start),
    endDate: formatDate(end),
  };
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

export function formatTokenCount(count: number): string {
  const n = count ?? 0;
  if (n >= 1000000) {
    return `${(n / 1000000).toFixed(1)}M`;
  }
  if (n >= 1000) {
    return `${(n / 1000).toFixed(1)}K`;
  }
  return n.toString();
}

export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

export const TIME_RANGE_LABELS: Record<TimeRangeType, string> = {
  '5h': 'Last 5 Hours',
  day: 'Today',
  week: 'This Week',
  month: 'This Month',
  year: 'This Year',
  all: 'All Time',
};
