import React, { useState } from 'react';
import { apiFetch, setStoredToken } from '../services/api';
import { User } from '../types/api';

interface AuthViewProps {
  onSuccess: (user: User) => void;
  onBack: () => void;
}

export function AuthView({ onSuccess, onBack }: AuthViewProps) {
  const [mode, setMode] = useState<'login' | 'register'>('register');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const endpoint = mode === 'register' ? '/api/v1/auth/register' : '/api/v1/auth/login';
      const body =
        mode === 'register'
          ? { email, password, display_name: displayName }
          : { email, password };
      const data = await apiFetch<{ user: User; token: string }>(endpoint, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      setStoredToken(data.token);
      onSuccess(data.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col justify-center px-6 py-12">
      <div className="max-w-md w-full mx-auto">
        <div className="mb-8">
          <button
            type="button"
            onClick={onBack}
            className="text-xs text-slate-500 hover:text-slate-900 dark:hover:text-slate-200 mb-4 inline-block"
          >
            ← Back to TruthLens AI
          </button>
          <h1 className="font-display text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            {mode === 'register' ? 'Create your research workspace' : 'Sign in to TruthLens AI'}
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
            Your analyses, saved reports, and comparisons are stored privately in SQLite and isolated to your account.
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-6">
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-md mb-6">
            <button
              type="button"
              onClick={() => { setMode('register'); setError(null); }}
              className={`flex-1 py-1.5 text-xs font-medium rounded transition-colors ${
                mode === 'register'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Create account
            </button>
            <button
              type="button"
              onClick={() => { setMode('login'); setError(null); }}
              className={`flex-1 py-1.5 text-xs font-medium rounded transition-colors ${
                mode === 'login'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Sign in
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <div>
                <label htmlFor="auth-name" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Display name
                </label>
                <input
                  id="auth-name"
                  type="text"
                  required
                  minLength={2}
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Riya Gupta"
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-slate-300"
                />
              </div>
            )}

            <div>
              <label htmlFor="auth-email" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Email address
              </label>
              <input
                id="auth-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="researcher@university.edu"
                className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-slate-300"
              />
            </div>

            <div>
              <label htmlFor="auth-password" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Password
              </label>
              <input
                id="auth-password"
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimum 8 characters"
                className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-slate-300"
              />
            </div>

            {error && (
              <div role="alert" className="p-3 text-xs text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-md">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 text-sm font-medium bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-950 rounded-md hover:bg-slate-800 dark:hover:bg-white disabled:opacity-50 transition-colors"
            >
              {loading ? 'Please wait...' : mode === 'register' ? 'Create account' : 'Sign in'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
