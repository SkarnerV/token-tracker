import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import { StatsResponse, ContributionDay, TimeRangeType } from '../types';
import { getTimeRange, getContributionGraphRange } from '../lib/timeRanges';

interface TokenState {
  stats: StatsResponse | null;
  contributionData: ContributionDay[];
  isLoading: boolean;
  error: string | null;
  selectedRange: TimeRangeType;
  selectedIdes: string[];
  lastSync: Record<string, Date>;
  
  setSelectedRange: (range: TimeRangeType) => void;
  toggleIde: (ide: string) => void;
  fetchStats: () => Promise<void>;
  fetchContributionGraph: () => Promise<void>;
  syncAll: () => Promise<void>;
  syncIde: (ide: string) => Promise<void>;
}

export const useTokenStore = create<TokenState>((set, get) => ({
  stats: null,
  contributionData: [],
  isLoading: false,
  error: null,
  selectedRange: 'week',
  selectedIdes: ['claude', 'opencode', 'roo'],
  lastSync: {},

  setSelectedRange: (range) => {
    set({ selectedRange: range });
    get().fetchStats();
  },

  toggleIde: (ide) => {
    const { selectedIdes } = get();
    if (selectedIdes.includes(ide)) {
      set({ selectedIdes: selectedIdes.filter((i) => i !== ide) });
    } else {
      set({ selectedIdes: [...selectedIdes, ide] });
    }
    get().fetchStats();
  },

  fetchStats: async () => {
    const { selectedRange, selectedIdes } = get();
    if (selectedIdes.length === 0) {
      set({ stats: null });
      return;
    }

    set({ isLoading: true, error: null });

    try {
      const range = getTimeRange(selectedRange);
      // Pass all selected IDEs, or undefined if all 3 are selected (backend returns all)
      const ideFilter = selectedIdes.length === 3 ? undefined : selectedIdes;

      const stats = await invoke<StatsResponse>('get_stats', {
        startTs: range.startTs,
        endTs: range.endTs,
        ideFilter,
      });

      set({ stats, isLoading: false });
    } catch (err) {
      set({ error: String(err), isLoading: false });
    }
  },

  fetchContributionGraph: async () => {
    const { selectedIdes } = get();
    
    set({ isLoading: true });

    try {
      const range = getContributionGraphRange();
      // Pass all selected IDEs, or undefined if all 3 are selected (backend returns all)
      const ideFilter = selectedIdes.length === 3 ? undefined : selectedIdes;

      const response = await invoke<{ data: ContributionDay[] }>('get_contribution_graph', {
        startDate: range.startDate,
        endDate: range.endDate,
        ideFilter,
      });

      set({ contributionData: response.data, isLoading: false });
    } catch (err) {
      set({ error: String(err), isLoading: false });
    }
  },

  syncAll: async () => {
    set({ isLoading: true });

    try {
      await Promise.all([
        get().syncIde('claude'),
        get().syncIde('opencode'),
        get().syncIde('roo'),
      ]);

      await invoke('rebuild_aggregates');
      await get().fetchStats();
      await get().fetchContributionGraph();
    } catch (err) {
      set({ error: String(err) });
    } finally {
      set({ isLoading: false });
    }
  },

  syncIde: async (ide) => {
    try {
      let result;
      switch (ide) {
        case 'claude':
          result = await invoke<{ processed: number; errors: string[] }>('sync_claude_code');
          break;
        case 'opencode':
          result = await invoke<{ processed: number; errors: string[] }>('sync_opencode');
          break;
        case 'roo':
          result = await invoke<{ processed: number; errors: string[] }>('sync_roo_code');
          break;
        default:
          return;
      }

      set((state) => ({
        lastSync: {
          ...state.lastSync,
          [ide]: new Date(),
        },
      }));

      if (result.errors.length > 0) {
        console.warn(`Sync errors for ${ide}:`, result.errors);
      }
    } catch (err) {
      console.error(`Failed to sync ${ide}:`, err);
    }
  },
}));
