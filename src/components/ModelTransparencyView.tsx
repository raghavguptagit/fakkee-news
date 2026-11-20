import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { apiFetch } from '../services/api';
import { ModelTransparencyData } from '../types/api';

export function ModelTransparencyView({ onBack }: { onBack?: () => void }) {
  const [data, setData] = useState<ModelTransparencyData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<ModelTransparencyData>('/api/v1/models/active')
      .then(setData)
      .catch(() => setData({ available: false }))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-sm text-slate-500">Loading model metadata...</div>;

  if (!data?.available || !data.metrics || !data.dataset_metadata) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-6 space-y-2">
        <h1 className="font-display text-2xl font-semibold">Model artifact not available</h1>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Run <code className="font-mono bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">npm run train:ml</code>{' '}
          to train and evaluate the TF-IDF classifier.
        </p>
      </div>
    );
  }

  const m = data.metrics;
  const ds = data.dataset_metadata;
  const cm = m.confusion_matrix;
  const compareChart = [
    { model: 'Logistic Regression', f1: Number((m.baseline_comparison.logistic_regression_f1 * 100).toFixed(1)) },
    { model: 'Linear SVM', f1: Number((m.baseline_comparison.linear_svm_f1 * 100).toFixed(1)) },
  ];

  return (
    <div className="max-w-5xl space-y-8">
      <div>
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="text-xs text-slate-500 hover:text-slate-900 dark:hover:text-slate-200 mb-3 inline-block"
          >
            ← Back
          </button>
        )}
        <h1 className="font-display text-3xl font-semibold tracking-tight">Model & Dataset Transparency</h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
          Actual computed evaluation metrics from <code className="font-mono">ml/artifacts/model_v1.json</code>.
        </p>
      </div>

      {/* Key Computed Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Test Accuracy', value: `${(m.accuracy * 100).toFixed(1)}%` },
          { label: 'Macro F1', value: `${(m.macro_f1 * 100).toFixed(1)}%` },
          { label: 'ROC-AUC', value: m.roc_auc.toFixed(4) },
          { label: 'Vocabulary Size', value: String(data.vocabulary_size || 0) },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4">
            <p className="text-xs text-slate-500 dark:text-slate-400">{kpi.label}</p>
            <p className="text-2xl font-mono font-semibold tabular-nums mt-1.5">{kpi.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Confusion Matrix */}
        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-6 space-y-4">
          <h2 className="text-base font-semibold">Held-out test confusion matrix</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs font-mono tabular-nums border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                  <th className="py-2 text-left">Actual \ Pred</th>
                  <th className="py-2 text-right">Credible</th>
                  <th className="py-2 text-right">Misleading</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-slate-100 dark:border-slate-800">
                  <td className="py-2.5 text-slate-700 dark:text-slate-300">Credible</td>
                  <td className="py-2.5 text-right font-semibold">{cm.matrix[0][0]}</td>
                  <td className="py-2.5 text-right">{cm.matrix[0][1]}</td>
                </tr>
                <tr>
                  <td className="py-2.5 text-slate-700 dark:text-slate-300">Misleading</td>
                  <td className="py-2.5 text-right">{cm.matrix[1][0]}</td>
                  <td className="py-2.5 text-right font-semibold">{cm.matrix[1][1]}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Artifact SHA-256: <span className="font-mono">{data.artifact_hash?.slice(0, 20)}...</span> · Trained{' '}
            {data.trained_at ? new Date(data.trained_at).toLocaleString() : 'N/A'}
          </p>
        </section>

        {/* Baseline Model Comparison */}
        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-6 space-y-4">
          <h2 className="text-base font-semibold">Baseline comparison (Macro F1 %)</h2>
          <div className="h-44 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={compareChart} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <XAxis dataKey="model" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="f1" fill="#0f172a" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      {/* Dataset Card & Limitations */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-6 space-y-4">
        <h2 className="text-base font-semibold">Dataset Card & Reproducibility</h2>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <dt className="text-slate-500">Dataset</dt>
            <dd className="font-medium mt-0.5">{ds.name}</dd>
          </div>
          <div>
            <dt className="text-slate-500">License</dt>
            <dd className="mt-0.5">{ds.license}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Split strategy</dt>
            <dd className="mt-0.5">
              {ds.split_strategy} ({ds.train_samples} train / {ds.test_samples} test)
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Retrain command</dt>
            <dd className="font-mono mt-0.5">npm run train:ml</dd>
          </div>
        </dl>
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
          <p className="text-xs font-medium text-slate-500 mb-2">Known limitations</p>
          <ul className="space-y-1 text-xs text-slate-600 dark:text-slate-400">
            {ds.limitations.map((lim, i) => (
              <li key={i}>• {lim}</li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
