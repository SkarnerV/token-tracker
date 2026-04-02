export interface TokenEvent {
  id?: number;
  ide: string;
  sessionId?: string;
  model?: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  timestamp: number;
  projectPath?: string;
}

export interface StatsResponse {
  totalInput: number;
  totalOutput: number;
  totalCacheRead: number;
  totalCacheWrite: number;
  totalTokens: number;
  sessionCount: number;
  byIde: Record<string, IdeStats>;
  byModel: Record<string, ModelStats>;
}

export interface IdeStats {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  sessionCount: number;
}

export interface ModelStats {
  model: string;
  ide: string;
  inputTokens: number;
  outputTokens: number;
  total: number;
}

export interface ContributionDay {
  date: string;
  count: number;
  level: number;
}

export interface TimeRange {
  label: string;
  startTs: number;
  endTs: number;
}

export type TimeRangeType = '5h' | 'day' | 'week' | 'month' | 'year' | 'all';

export const IDE_COLORS: Record<string, string> = {
  claude: '#cc7832',
  opencode: '#4ec9b0',
  roo: '#9876aa',
};

export const IDE_LABELS: Record<string, string> = {
  claude: 'Claude Code',
  opencode: 'OpenCode',
  roo: 'Roo Code',
};
