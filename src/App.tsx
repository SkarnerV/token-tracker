import { useEffect } from 'react';
import { StatsCards } from './components/StatsCards';
import { ActivityGraph } from './components/ActivityGraph';
import { IDESelector } from './components/IDESelector';

function App() {
  useEffect(() => {
    document.documentElement.classList.add('dark');
  }, []);

  return (
    <div className="min-h-screen bg-industrial-black text-industrial-100">
      <header className="bg-industrial-700 h-20 flex items-center px-8">
        <div className="flex items-center gap-5 w-full">
          <div className="w-12 h-12 bg-industrial-100" />
          <h1 className="text-3xl font-bold font-sans tracking-wide">
            TOKEN TRACKER
          </h1>
          <span className="ml-auto text-sm font-mono text-industrial-400">
            v1.0.0
          </span>
        </div>
      </header>

      <main className="flex gap-6 p-6">
        <div className="flex-1 flex flex-col gap-6">
          <StatsCards />
          <ActivityGraph />
        </div>

        <div className="w-[280px]">
          <IDESelector />
        </div>
      </main>

      <footer className="bg-industrial-700 h-12 flex items-center px-8">
        <p className="text-xs font-mono text-industrial-600 text-center w-full">
          TOKEN TRACKER | SYSTEM MONITOR | v1.0.0
        </p>
      </footer>
    </div>
  );
}

export default App;