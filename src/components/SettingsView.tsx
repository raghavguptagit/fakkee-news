import { useEffect, useState } from 'react';
import { Download, Trash2, Sun, Moon } from 'lucide-react';
import { apiFetch } from '../services/api';
import { User } from '../types/api';

interface SettingsViewProps {
  user: User;
  darkMode: boolean;
  onToggleDark: () => void;
  onAccountDeleted: () => void;
}

export function SettingsView({ user, darkMode, onToggleDark, onAccountDeleted }: SettingsViewProps) {
  const [status, setStatus] = useState<{
    database?: { engine: string; status: string; path: string };
    ml_model?: { available: boolean; model_name: string | null; version: string | null };
    gemini?: { configured: boolean; model: string };
    evidence_search?: { configured: boolean; provider: string };
  } | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    apiFetch('/api/v1/system/status')
      .then((res) => setStatus(res as typeof status))
      .catch(() => {});
  }, []);

  const handleExport = async () => {
    const data = await apiFetch('/api/v1/settings/export');
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `truthlens-user-export.json`;
    a.click();
    URL.revokeObjectURL(url);
    setMessage('Exported your account data as JSON.');
  };

  const handleClearHistory = async () => {
    await apiFetch('/api/v1/settings/history', { method: 'DELETE' });
    setMessage('All analysis history has been permanently cleared.');
  };

  const handleDeleteAccount = async () => {
    await apiFetch('/api/v1/auth/account', { method: 'DELETE' });
    onAccountDeleted();
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight">Settings & Privacy</h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
          Manage your profile, appearance, data export, and inspect active service configuration.
        </p>
      </div>

      {message && (
        <div className="p-3 text-xs text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 rounded-md">
          {message}
        </div>
      )}

      {/* Profile & Appearance */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-6 space-y-4">
        <h2 className="text-base font-semibold">Profile & Appearance</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-xs text-slate-500">Display name</p>
            <p className="font-medium mt-0.5">{user.display_name}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Email</p>
            <p className="font-mono text-xs mt-1">{user.email}</p>
          </div>
        </div>
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Theme</p>
            <p className="text-xs text-slate-500">Switch between light and dark editorial surfaces.</p>
          </div>
          <button
            type="button"
            onClick={onToggleDark}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium border border-slate-300 dark:border-slate-700 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            {darkMode ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
            <span>{darkMode ? 'Light mode' : 'Dark mode'}</span>
          </button>
        </div>
      </section>

      {/* Service Configuration Status (no secrets) */}
      {status && (
        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-6 space-y-3">
          <h2 className="text-base font-semibold">System & Provider Status</h2>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <dt className="text-slate-500">Database</dt>
              <dd className="font-mono mt-0.5">
                {status.database?.engine} ({status.database?.path})
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">ML Classifier</dt>
              <dd className="font-mono mt-0.5">
                {status.ml_model?.available ? `${status.ml_model.model_name} ${status.ml_model.version}` : 'Not trained'}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Gemini API</dt>
              <dd className="font-mono mt-0.5">
                {status.gemini?.configured ? `Configured (${status.gemini.model})` : 'Not configured (ML fallback active)'}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Evidence Search</dt>
              <dd className="font-mono mt-0.5">
                {status.evidence_search?.configured ? status.evidence_search.provider : 'Disabled (unverified claims mode)'}
              </dd>
            </div>
          </dl>
        </section>
      )}

      {/* Privacy & Data Controls */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-6 space-y-4">
        <h2 className="text-base font-semibold">Privacy & Data Controls</h2>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleExport}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium border border-slate-300 dark:border-slate-700 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <Download className="w-3.5 h-3.5" /> Export my data (JSON)
          </button>
          <button
            type="button"
            onClick={handleClearHistory}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium border border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-300 rounded-md hover:bg-amber-50 dark:hover:bg-amber-950/40"
          >
            <Trash2 className="w-3.5 h-3.5" /> Clear analysis history
          </button>
          <button
            type="button"
            onClick={handleDeleteAccount}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium border border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300 rounded-md hover:bg-rose-50 dark:hover:bg-rose-950/40"
          >
            <Trash2 className="w-3.5 h-3.5" /> Delete account
          </button>
        </div>
      </section>
    </div>
  );
}
