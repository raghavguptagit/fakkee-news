import { useEffect, useState } from 'react';
import { apiFetch } from '../services/api';
import { AnalysisReport } from '../types/api';
import { AssessmentTag } from './AssessmentTag';

interface CompareViewProps {
  initialIds: string[];
  onOpenReport: (id: string) => void;
}

export function CompareView({ initialIds, onOpenReport }: CompareViewProps) {
  const [reports, setReports] = useState<AnalysisReport[]>([]);
  const [note, setNote] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialIds.length < 2) return;
    setLoading(true);
    setError(null);
    apiFetch<{ items: AnalysisReport[]; note: string }>('/api/v1/compare', {
      method: 'POST',
      body: JSON.stringify({ analysis_ids: initialIds }),
    })
      .then((res) => {
        setReports(res.items);
        setNote(res.note);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Comparison failed.'))
      .finally(() => setLoading(false));
  }, [initialIds]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight">Compare analyses</h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
          Side-by-side comparison of ML signals, claims, and linguistic indicators.
        </p>
      </div>

      {initialIds.length < 2 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-8 text-sm text-slate-600 dark:text-slate-400">
          Select 2 to 4 analyses from the <strong>History</strong> page and click <strong>Compare</strong> to inspect
          them side-by-side.
        </div>
      ) : loading ? (
        <div className="text-sm text-slate-500">Loading comparison...</div>
      ) : error ? (
        <div className="p-4 text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-md">{error}</div>
      ) : (
        <>
          {note && (
            <p className="text-xs text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md p-3">
              {note}
            </p>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {reports.map((r) => (
              <div
                key={r.analysis_id}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 space-y-4"
              >
                <div className="space-y-1.5 pb-3 border-b border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => onOpenReport(r.analysis_id)}
                    className="text-base font-semibold text-left hover:underline"
                  >
                    {r.input.title}
                  </button>
                  <div>
                    <AssessmentTag label={r.assessment.label} displayLabel={r.assessment.display_label} />
                  </div>
                </div>

                <dl className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <dt className="text-slate-500">ML Class</dt>
                    <dd className="font-mono mt-0.5">{r.ml.predicted_class?.replace(/_/g, ' ') || 'N/A'}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">ML Score (uncalibrated)</dt>
                    <dd className="font-mono tabular-nums mt-0.5">
                      {r.ml.score !== null ? `${(r.ml.score * 100).toFixed(1)}%` : '—'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Extracted Claims</dt>
                    <dd className="font-mono tabular-nums mt-0.5">{r.claims.length}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Sensationalism Flags</dt>
                    <dd className="font-mono tabular-nums mt-0.5">
                      {r.linguistic_analysis.sensationalism_indicators.length}
                    </dd>
                  </div>
                </dl>

                <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
                  <p className="text-xs font-medium text-slate-500 mb-1">Summary</p>
                  <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">{r.summary}</p>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
