import { useEffect, useState } from 'react';
import { Search, Trash2, GitCompare } from 'lucide-react';
import { apiFetch } from '../services/api';
import { AnalysisSummaryRow } from '../types/api';
import { AssessmentTag } from './AssessmentTag';

interface HistoryViewProps {
  savedOnly?: boolean;
  onOpenReport: (id: string) => void;
  onCompare: (ids: string[]) => void;
}

export function HistoryView({ savedOnly = false, onOpenReport, onCompare }: HistoryViewProps) {
  const [items, setItems] = useState<AnalysisSummaryRow[]>([]);
  const [search, setSearch] = useState('');
  const [labelFilter, setLabelFilter] = useState('ALL');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (savedOnly) params.set('saved', 'true');
    if (search.trim()) params.set('search', search.trim());
    if (labelFilter !== 'ALL') params.set('label', labelFilter);
    apiFetch<{ items: AnalysisSummaryRow[] }>(`/api/v1/analyses?${params.toString()}`)
      .then((res) => setItems(res.items))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [savedOnly, labelFilter]);

  const handleDelete = async (id: string) => {
    await apiFetch(`/api/v1/analyses/${id}`, { method: 'DELETE' });
    setItems((prev) => prev.filter((x) => x.id !== id));
    setSelectedIds((prev) => prev.filter((x) => x !== id));
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : prev.length < 4 ? [...prev, id] : prev
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">
            {savedOnly ? 'Saved reports' : 'Analysis history'}
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Select 2–4 reports to compare signals side-by-side.
          </p>
        </div>

        {selectedIds.length >= 2 && (
          <button
            type="button"
            onClick={() => onCompare(selectedIds)}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-950 rounded-md hover:bg-slate-800 whitespace-nowrap"
          >
            <GitCompare className="w-3.5 h-3.5" />
            <span>Compare ({selectedIds.length})</span>
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" aria-hidden="true" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && load()}
            placeholder="Search by title or summary..."
            className="w-full pl-9 pr-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md"
          />
        </div>
        <select
          aria-label="Filter by assessment"
          value={labelFilter}
          onChange={(e) => setLabelFilter(e.target.value)}
          className="px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md"
        >
          <option value="ALL">All assessments</option>
          <option value="LIKELY_CREDIBLE">Likely credible</option>
          <option value="POTENTIALLY_MISLEADING">Potentially misleading</option>
          <option value="NEEDS_VERIFICATION">Needs verification</option>
          <option value="INSUFFICIENT_EVIDENCE">Insufficient evidence</option>
        </select>
        <button
          type="button"
          onClick={load}
          className="px-4 py-2 text-xs font-medium border border-slate-300 dark:border-slate-700 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          Search
        </button>
      </div>

      {/* List */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg divide-y divide-slate-200 dark:divide-slate-800">
        {loading ? (
          <div className="p-8 text-sm text-slate-500">Loading history...</div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">
            No matching analyses found.
          </div>
        ) : (
          items.map((item) => (
            <div key={item.id} className="p-4 flex items-start justify-between gap-4">
              <div className="flex items-start gap-3 min-w-0">
                <input
                  type="checkbox"
                  aria-label={`Select ${item.title} for comparison`}
                  checked={selectedIds.includes(item.id)}
                  onChange={() => toggleSelect(item.id)}
                  className="mt-1 rounded border-slate-300"
                />
                <button
                  type="button"
                  onClick={() => onOpenReport(item.id)}
                  className="text-left min-w-0"
                >
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100 hover:underline truncate">
                    {item.title}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-mono tabular-nums">
                    {item.input_type} · {new Date(item.created_at).toLocaleString()}
                    {item.model_score !== null ? ` · ML ${(item.model_score * 100).toFixed(0)}%` : ''}
                  </p>
                </button>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <AssessmentTag label={item.assessment_label} />
                <button
                  type="button"
                  aria-label={`Delete ${item.title}`}
                  onClick={() => handleDelete(item.id)}
                  className="p-1.5 text-slate-400 hover:text-rose-600 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
