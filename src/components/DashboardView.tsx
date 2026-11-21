import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { ArrowRight, Plus } from 'lucide-react';
import { apiFetch } from '../services/api';
import { AssessmentLabel } from '../types/api';
import { AssessmentTag } from './AssessmentTag';

interface DashboardData {
  kpis: {
    total_analyses: number;
    saved_reports: number;
    avg_processing_ms: number;
  };
  distribution: Array<{ label: AssessmentLabel; count: number }>;
  recent: Array<{
    id: string;
    title: string;
    input_type: string;
    assessment_label: AssessmentLabel;
    model_score: number | null;
    created_at: string;
    is_saved: number;
  }>;
}

interface DashboardViewProps {
  onNewAnalysis: () => void;
  onOpenReport: (id: string) => void;
}

const LABEL_SHORT: Record<string, string> = {
  LIKELY_CREDIBLE: 'Likely True',
  POTENTIALLY_MISLEADING: 'Likely Fake',
  NEEDS_VERIFICATION: 'Unverified',
  INSUFFICIENT_EVIDENCE: 'Unverified (Short)',
  ANALYSIS_UNAVAILABLE: 'Unverified',
};

export function DashboardView({ onNewAnalysis, onOpenReport }: DashboardViewProps) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<DashboardData>('/api/v1/dashboard')
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load dashboard.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-24 bg-slate-200 dark:bg-slate-800 rounded-lg" />
          ))}
        </div>
        <div className="h-64 bg-slate-200 dark:bg-slate-800 rounded-lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-900 rounded-lg text-sm text-rose-700 dark:text-rose-300">
        {error}
      </div>
    );
  }

  const kpis = data?.kpis || { total_analyses: 0, saved_reports: 0, avg_processing_ms: 0 };
  const chartData = (data?.distribution || []).map((d) => ({
    name: LABEL_SHORT[d.label] || d.label,
    count: d.count,
  }));

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">Overview</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Live metrics computed from your SQLite analysis history.
          </p>
        </div>
        <button
          type="button"
          onClick={onNewAnalysis}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-950 rounded-md hover:bg-slate-800 dark:hover:bg-white transition-colors whitespace-nowrap shrink-0 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
          <span>New analysis</span>
        </button>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5">
          <p className="text-xs text-slate-500 dark:text-slate-400">Analyses run</p>
          <p className="text-3xl font-semibold font-mono tabular-nums mt-2">{kpis.total_analyses}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5">
          <p className="text-xs text-slate-500 dark:text-slate-400">Saved reports</p>
          <p className="text-3xl font-semibold font-mono tabular-nums mt-2">{kpis.saved_reports}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5">
          <p className="text-xs text-slate-500 dark:text-slate-400">Avg processing time</p>
          <p className="text-3xl font-semibold font-mono tabular-nums mt-2">
            {kpis.total_analyses > 0 ? `${kpis.avg_processing_ms} ms` : '—'}
          </p>
        </div>
      </div>

      {kpis.total_analyses === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-10 text-center">
          <h2 className="font-display text-2xl font-semibold mb-2">No analyses yet</h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 max-w-md mx-auto mb-6">
            Paste a news article, submit a URL, upload a document, or try a clearly labeled demo sample to generate your
            first credibility report.
          </p>
          <button
            type="button"
            onClick={onNewAnalysis}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-950 rounded-md hover:bg-slate-800 dark:hover:bg-white transition-colors"
          >
            <span>Analyze your first article</span>
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Distribution Chart */}
          <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5">
            <h2 className="text-sm font-semibold mb-4">Assessment distribution</h2>
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-15} textAnchor="end" height={50} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#0f172a" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Recent Analyses */}
          <div className="lg:col-span-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5">
            <h2 className="text-sm font-semibold mb-4">Recent analyses</h2>
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {data?.recent.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onOpenReport(item.id)}
                  className="w-full text-left py-3 flex items-start justify-between gap-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 -mx-2 px-2 rounded transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">{item.title}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-mono tabular-nums">
                      {item.input_type} · {new Date(item.created_at).toLocaleDateString()}
                      {item.model_score !== null ? ` · ML score ${(item.model_score * 100).toFixed(0)}%` : ''}
                    </p>
                  </div>
                  <div className="shrink-0 pt-0.5">
                    <AssessmentTag label={item.assessment_label} />
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
