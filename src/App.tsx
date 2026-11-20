import { useEffect, useState } from 'react';
import {
  LayoutDashboard,
  FileSearch,
  History,
  Bookmark,
  GitCompare,
  Cpu,
  Settings,
  LogOut,
  Menu,
  X,
  Sun,
  Moon,
} from 'lucide-react';
import { apiFetch, getStoredToken, setStoredToken } from './services/api';
import { AnalysisReport, User } from './types/api';
import { LandingPage } from './components/LandingPage';
import { AuthView } from './components/AuthView';
import { DashboardView } from './components/DashboardView';
import { AnalyzeView } from './components/AnalyzeView';
import { ReportView } from './components/ReportView';
import { HistoryView } from './components/HistoryView';
import { CompareView } from './components/CompareView';
import { ModelTransparencyView } from './components/ModelTransparencyView';
import { SettingsView } from './components/SettingsView';

type RouteView =
  | 'landing'
  | 'auth'
  | 'public-models'
  | 'dashboard'
  | 'analyze'
  | 'report'
  | 'history'
  | 'saved'
  | 'compare'
  | 'models'
  | 'settings';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [view, setView] = useState<RouteView>('landing');
  const [activeReport, setActiveReport] = useState<AnalysisReport | null>(null);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('truthlens_theme') === 'dark');

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    localStorage.setItem('truthlens_theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  useEffect(() => {
    const token = getStoredToken();
    if (!token) {
      setAuthChecked(true);
      return;
    }
    apiFetch<{ user: User }>('/api/v1/auth/me')
      .then((res) => {
        setUser(res.user);
        setView('dashboard');
      })
      .catch(() => {
        setStoredToken(null);
      })
      .finally(() => setAuthChecked(true));
  }, []);

  const openReportById = async (id: string) => {
    try {
      const report = await apiFetch<AnalysisReport>(`/api/v1/analyses/${id}`);
      setActiveReport(report);
      setView('report');
    } catch {
      // ignore
    }
  };

  const handleLogout = async () => {
    try {
      await apiFetch('/api/v1/auth/logout', { method: 'POST' });
    } catch {
      // ignore
    }
    setStoredToken(null);
    setUser(null);
    setActiveReport(null);
    setView('landing');
  };

  if (!authChecked) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center text-sm text-slate-500">
        Loading TruthLens AI...
      </div>
    );
  }

  if (!user) {
    if (view === 'auth') {
      return (
        <AuthView
          onSuccess={(u) => {
            setUser(u);
            setView('dashboard');
          }}
          onBack={() => setView('landing')}
        />
      );
    }
    if (view === 'public-models') {
      return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-6 sm:p-10">
          <div className="max-w-5xl mx-auto">
            <ModelTransparencyView onBack={() => setView('landing')} />
          </div>
        </div>
      );
    }
    return (
      <LandingPage
        onGetStarted={() => setView('auth')}
        onSignIn={() => setView('auth')}
        onViewModels={() => setView('public-models')}
      />
    );
  }

  const navItems: Array<{ id: RouteView; label: string; icon: typeof LayoutDashboard }> = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'analyze', label: 'Analyze', icon: FileSearch },
    { id: 'history', label: 'History', icon: History },
    { id: 'saved', label: 'Saved', icon: Bookmark },
    { id: 'compare', label: 'Compare', icon: GitCompare },
    { id: 'models', label: 'About Models', icon: Cpu },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const navigate = (next: RouteView) => {
    setView(next);
    setMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex md:flex-col w-60 shrink-0 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="h-16 px-5 flex items-center border-b border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={() => navigate('dashboard')}
            className="font-display text-lg font-semibold tracking-tight whitespace-nowrap"
          >
            TruthLens AI
          </button>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = view === item.id || (view === 'report' && item.id === 'history');
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => navigate(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-950 font-medium'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
        <div className="p-3 border-t border-slate-200 dark:border-slate-800 space-y-1">
          <div className="px-3 py-1.5 text-xs text-slate-500 dark:text-slate-400 truncate">{user.display_name}</div>
          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md"
          >
            <LogOut className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>Sign out</span>
          </button>
        </div>
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div className="fixed inset-0 bg-slate-950/50" onClick={() => setMobileMenuOpen(false)} />
          <aside className="relative w-64 max-w-[80vw] bg-white dark:bg-slate-900 h-full flex flex-col border-r border-slate-200 dark:border-slate-800">
            <div className="h-14 px-4 flex items-center justify-between border-b border-slate-200 dark:border-slate-800">
              <span className="font-display text-lg font-semibold">TruthLens AI</span>
              <button type="button" aria-label="Close navigation" onClick={() => setMobileMenuOpen(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 p-3 space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => navigate(item.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm rounded-md ${
                      view === item.id
                        ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-950 font-medium'
                        : 'text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
            <div className="p-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-3 py-2 text-sm text-slate-600 dark:text-slate-300"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign out</span>
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 md:h-16 px-4 sm:px-6 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between gap-4 sticky top-0 z-20">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              aria-label="Open navigation"
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden p-1.5 text-slate-600 dark:text-slate-300"
            >
              <Menu className="w-5 h-5" />
            </button>
            <span className="text-xs font-mono text-slate-500 dark:text-slate-400 truncate">
              TruthLens AI / {view}
            </span>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              aria-label="Toggle color theme"
              onClick={() => setDarkMode((d) => !d)}
              className="p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors"
            >
              {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
        </header>

        <main className="flex-1 p-5 sm:p-8 max-w-6xl w-full mx-auto">
          {view === 'dashboard' && (
            <DashboardView onNewAnalysis={() => navigate('analyze')} onOpenReport={openReportById} />
          )}
          {view === 'analyze' && (
            <AnalyzeView
              onComplete={(report) => {
                setActiveReport(report);
                setView('report');
              }}
            />
          )}
          {view === 'report' && activeReport && (
            <ReportView report={activeReport} onBack={() => navigate('history')} />
          )}
          {view === 'history' && (
            <HistoryView
              onOpenReport={openReportById}
              onCompare={(ids) => {
                setCompareIds(ids);
                navigate('compare');
              }}
            />
          )}
          {view === 'saved' && (
            <HistoryView
              savedOnly
              onOpenReport={openReportById}
              onCompare={(ids) => {
                setCompareIds(ids);
                navigate('compare');
              }}
            />
          )}
          {view === 'compare' && <CompareView initialIds={compareIds} onOpenReport={openReportById} />}
          {view === 'models' && <ModelTransparencyView />}
          {view === 'settings' && (
            <SettingsView
              user={user}
              darkMode={darkMode}
              onToggleDark={() => setDarkMode((d) => !d)}
              onAccountDeleted={handleLogout}
            />
          )}
        </main>
      </div>
    </div>
  );
}
