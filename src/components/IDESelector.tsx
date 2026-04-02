import { AlertCircle } from 'lucide-react';
import { useTokenStore } from '../stores/tokenStore';
import { IDE_COLORS, IDE_LABELS } from '../types';

const IDES = [
  { id: 'claude', label: IDE_LABELS.claude, color: IDE_COLORS.claude },
  { id: 'opencode', label: IDE_LABELS.opencode, color: IDE_COLORS.opencode },
  { id: 'roo', label: IDE_LABELS.roo, color: IDE_COLORS.roo },
];

export function IDESelector() {
  const { selectedIdes, toggleIde, lastSync, syncAll, isLoading, error } = useTokenStore();

  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          IDE Sources
        </h3>
        <button
          onClick={syncAll}
          disabled={isLoading}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading ? 'Syncing...' : 'Sync All'}
        </button>
      </div>

      <div className="space-y-3">
        {IDES.map((ide) => {
          const isSelected = selectedIdes.includes(ide.id);
          const lastSyncTime = lastSync[ide.id];

          return (
            <div
              key={ide.id}
              className={`flex items-center justify-between p-3 rounded-lg border transition-all cursor-pointer ${
                isSelected
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
              onClick={() => toggleIde(ide.id)}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-4 h-4 rounded-full"
                  style={{ backgroundColor: ide.color }}
                />
                <div>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {ide.label}
                  </span>
                  {lastSyncTime && (
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Last sync: {formatLastSync(lastSyncTime)}
                    </p>
                  )}
                </div>
              </div>
              <div
                className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                  isSelected
                    ? 'bg-blue-600 border-blue-600'
                    : 'border-gray-300 dark:border-gray-600'
                }`}
              >
                {isSelected && (
                  <svg
                    className="w-3 h-3 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {selectedIdes.length === 0 && (
        <p className="text-sm text-amber-600 dark:text-amber-400 mt-4">
          Select at least one IDE to view token statistics.
        </p>
      )}

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-start gap-3 mt-4">
          <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="text-sm font-medium text-red-800 dark:text-red-200">Sync failed</h3>
            <p className="text-sm text-red-600 dark:text-red-400 mt-1">{error}</p>
          </div>
        </div>
      )}
    </div>
  );
}

function formatLastSync(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}
