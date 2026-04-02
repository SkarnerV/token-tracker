import { useEffect } from 'react';
import { StatsCards } from './components/StatsCards';
import { ActivityGraph } from './components/ActivityGraph';
import { IDESelector } from './components/IDESelector';

function App() {
  useEffect(() => {
    document.documentElement.classList.add('dark');
  }, []);

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-950 text-gray-900 dark:text-white">
      <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg" />
              <h1 className="text-xl font-bold">Token Tracker</h1>
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Track your AI coding assistant usage
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-3 space-y-6">
            <StatsCards />
            <ActivityGraph />
          </div>
          <div className="lg:col-span-1">
            <IDESelector />
          </div>
        </div>
      </main>

      <footer className="border-t border-gray-200 dark:border-gray-800 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
            Token Tracker • Tracks Claude Code, OpenCode, and Roo Code usage
          </p>
        </div>
      </footer>
    </div>
  );
}

export default App;
