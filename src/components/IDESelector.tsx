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
    <div className="bg-industrial-800 p-5 flex flex-col gap-5 h-full">
      <div className="flex items-center gap-4 h-12">
        <h3 className="text-base font-bold font-sans tracking-wide text-industrial-100">
          IDE SOURCES
        </h3>
        <div className="flex-1 h-0.5 bg-industrial-600" />
      </div>

      <button
        onClick={syncAll}
        disabled={isLoading}
        className="h-11 bg-accent-cyan text-industrial-black font-mono text-sm font-bold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
      >
        {isLoading ? 'SYNCING...' : 'SYNC ALL'}
      </button>

      <div className="flex flex-col gap-3">
        {IDES.map((ide) => {
          const isSelected = selectedIdes.includes(ide.id);
          const lastSyncTime = lastSync[ide.id];

          return (
            <div
              key={ide.id}
              onClick={() => toggleIde(ide.id)}
              className={`h-14 bg-industrial-700 flex items-center gap-4 px-4 cursor-pointer hover:opacity-80 transition-opacity ${
                isSelected ? '' : 'opacity-50'
              }`}
            >
              <div
                className={`w-1 h-full ${
                  isSelected ? 'bg-industrial-100' : 'bg-industrial-600'
                }`}
              />
              <div
                className="w-4 h-4 rounded-full"
                style={{ backgroundColor: ide.color }}
              />
              <div className="flex-1">
                <span className="text-sm font-semibold font-sans tracking-wide text-industrial-100">
                  {ide.label.toUpperCase()}
                </span>
                {lastSyncTime && (
                  <p className="text-xs font-mono text-industrial-400">
                    Last sync: {formatLastSync(lastSyncTime)}
                  </p>
                )}
              </div>
              <span className={`text-lg ${isSelected ? 'text-accent-cyan' : 'text-industrial-600'}`}>
                {isSelected ? '●' : '○'}
              </span>
            </div>
          );
        })}
      </div>

      {selectedIdes.length === 0 && (
        <p className="text-sm font-mono text-industrial-500">
          Select at least one IDE to view token statistics.
        </p>
      )}

      {error && (
        <div className="bg-industrial-700 border-l-4 border-red-500 p-4 mt-auto">
          <h3 className="text-sm font-semibold font-sans text-red-400">SYNC FAILED</h3>
          <p className="text-sm font-mono text-industrial-400 mt-1">{error}</p>
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