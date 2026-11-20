import React, { useRef, useState } from 'react';
import {
  Bookmark,
  BookmarkCheck,
  Download,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Send,
  Square,
  Check,
  X,
  ArrowLeft,
} from 'lucide-react';
import { AnalysisReport } from '../types/api';
import { apiFetch, streamChatFollowup } from '../services/api';
import { AssessmentTag } from './AssessmentTag';

interface ReportViewProps {
  report: AnalysisReport;
  onBack: () => void;
}

export function ReportView({ report, onBack }: ReportViewProps) {
  const [saved, setSaved] = useState(Boolean(report.is_saved));
  const [openClaimId, setOpenClaimId] = useState<string | null>(report.claims[0]?.id || null);
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; text: string }>>([]);
  const [question, setQuestion] = useState('');
  const [streaming, setStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const toggleSave = async () => {
    try {
      if (saved) {
        await apiFetch(`/api/v1/analyses/${report.analysis_id}/save`, { method: 'DELETE' });
        setSaved(false);
      } else {
        await apiFetch(`/api/v1/analyses/${report.analysis_id}/save`, { method: 'POST' });
        setSaved(true);
      }
    } catch {
      // ignore
    }
  };

  const handleExportJson = () => {
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `truthlens-report-${report.analysis_id.slice(0, 8)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleAsk = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim() || streaming) return;
    const q = question.trim();
    const nextHistory = [...messages, { role: 'user' as const, text: q }];
    setMessages([...nextHistory, { role: 'assistant', text: '' }]);
    setQuestion('');
    setStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      await streamChatFollowup(
        report.analysis_id,
        q,
        nextHistory,
        (chunk) => {
          setMessages((prev) => {
            const copy = [...prev];
            const last = copy[copy.length - 1];
            if (last && last.role === 'assistant') {
              copy[copy.length - 1] = { ...last, text: last.text + chunk };
            }
            return copy;
          });
        },
        controller.signal
      );
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setMessages((prev) => {
          const copy = [...prev];
          const last = copy[copy.length - 1];
          if (last && last.role === 'assistant' && !last.text) {
            copy[copy.length - 1] = { ...last, text: 'Unable to complete response. Please try again.' };
          }
          return copy;
        });
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  };

  return (
    <div className="max-w-5xl space-y-8">
      {report.is_demo && (
        <div className="p-3 text-xs font-medium text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-md">
          DEMO DATA — Analyzed from a built-in demonstration sample article.
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-800">
        <div className="space-y-2 min-w-0">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-900 dark:hover:text-slate-200"
          >
            <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Back</span>
          </button>
          <h1 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight">
            {report.input.title || 'Untitled Article Analysis'}
          </h1>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
            <span>{report.topic || 'General'}</span>
            <span aria-hidden="true">·</span>
            <span>{report.input.word_count} words</span>
            <span aria-hidden="true">·</span>
            <span>{new Date(report.provenance.created_at).toLocaleString()}</span>
            {report.input.url && (
              <>
                <span aria-hidden="true">·</span>
                <a
                  href={report.input.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-slate-700 dark:text-slate-300 hover:underline"
                >
                  Source <ExternalLink className="w-3 h-3" />
                </a>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={toggleSave}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium border border-slate-300 dark:border-slate-700 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            {saved ? <BookmarkCheck className="w-3.5 h-3.5" /> : <Bookmark className="w-3.5 h-3.5" />}
            <span>{saved ? 'Saved' : 'Save'}</span>
          </button>
          <button
            type="button"
            onClick={handleExportJson}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium border border-slate-300 dark:border-slate-700 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export JSON</span>
          </button>
        </div>
      </div>

      {/* Assessment & Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-6 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <AssessmentTag label={report.assessment.label} displayLabel={report.assessment.display_label} size="lg" />
            <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
              Pipeline v{report.provenance.analysis_pipeline_version}
            </span>
          </div>
          <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{report.assessment.reason}</p>
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
            <h2 className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">Executive summary</h2>
            <p className="text-sm text-slate-800 dark:text-slate-200 leading-relaxed">{report.summary}</p>
          </div>
        </div>

        {/* ML Model Panel */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-6 space-y-4">
          <h2 className="text-sm font-semibold">ML Classifier Signal</h2>
          {report.ml.available ? (
            <>
              <div className="space-y-1">
                <p className="text-xs text-slate-500 dark:text-slate-400">Predicted class</p>
                <p className="text-sm font-mono font-medium">
                  {report.ml.predicted_class?.replace(/_/g, ' ')}
                </p>
              </div>
              <div className="flex items-baseline justify-between">
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Uncalibrated model score</p>
                  <p className="text-2xl font-mono font-semibold tabular-nums mt-0.5">
                    {report.ml.score !== null ? `${(report.ml.score * 100).toFixed(1)}%` : '—'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-500 dark:text-slate-400">Confidence</p>
                  <p className="text-xs font-mono capitalize mt-1">{report.ml.confidence_label}</p>
                </div>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed pt-2 border-t border-slate-100 dark:border-slate-800">
                {report.ml.limitations_note}
              </p>
            </>
          ) : (
            <p className="text-xs text-slate-500 dark:text-slate-400">{report.ml.limitations_note}</p>
          )}
        </div>
      </div>

      {/* ML Explainability: Top Contributing Terms */}
      {report.ml.available && report.ml.explanation.length > 0 && (
        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-6 space-y-4">
          <div>
            <h2 className="text-base font-semibold">Top contributing TF-IDF terms</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Lexical features that most influenced the linear model score. Feature weights reflect training corpus
              patterns, not factual proof.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {report.ml.explanation.map((feat) => (
              <div
                key={feat.term}
                className="flex items-center justify-between gap-3 py-2 px-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md text-xs"
              >
                <span className="font-mono font-medium truncate">{feat.term}</span>
                <span
                  className={`font-mono tabular-nums shrink-0 ${
                    feat.direction === 'toward_misleading'
                      ? 'text-rose-700 dark:text-rose-400'
                      : 'text-emerald-700 dark:text-emerald-400'
                  }`}
                >
                  {feat.contribution > 0 ? '+' : ''}
                  {feat.contribution.toFixed(3)} ({feat.direction === 'toward_misleading' ? 'sensational' : 'credible'})
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Extracted Claims Accordion */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold">Extracted claims ({report.claims.length})</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Evidence provider status: <span className="font-mono">{report.providers.evidence_search}</span> · Gemini:{' '}
              <span className="font-mono">{report.providers.gemini}</span>
            </p>
          </div>
        </div>

        {report.claims.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">No specific checkable claims were extracted.</p>
        ) : (
          <div className="divide-y divide-slate-200 dark:divide-slate-800">
            {report.claims.map((claim) => {
              const isOpen = openClaimId === claim.id;
              return (
                <div key={claim.id} className="py-3.5">
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    onClick={() => setOpenClaimId(isOpen ? null : claim.id)}
                    className="w-full flex items-start justify-between gap-4 text-left"
                  >
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{claim.text}</p>
                      <p className="text-xs font-mono text-slate-500 dark:text-slate-400">
                        {claim.type} · {claim.checkability} · status: {claim.status.replace(/_/g, ' ')}
                      </p>
                    </div>
                    {isOpen ? (
                      <ChevronUp className="w-4 h-4 text-slate-400 shrink-0 mt-1" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-400 shrink-0 mt-1" />
                    )}
                  </button>
                  {isOpen && (
                    <div className="mt-3 pl-1 space-y-3 text-xs text-slate-600 dark:text-slate-300">
                      <p>{claim.explanation}</p>
                      {claim.search_query && (
                        <p className="font-mono text-slate-500 dark:text-slate-400">
                          Suggested verification query: "{claim.search_query}"
                        </p>
                      )}
                      {claim.evidence.length > 0 ? (
                        <div className="space-y-2 pt-2">
                          {claim.evidence.map((ev, i) => (
                            <div
                              key={i}
                              className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md space-y-1"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <a
                                  href={ev.source_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="font-medium text-slate-900 dark:text-slate-100 hover:underline inline-flex items-center gap-1"
                                >
                                  {ev.source_title} <ExternalLink className="w-3 h-3" />
                                </a>
                                <span className="font-mono text-slate-500">{ev.publisher}</span>
                              </div>
                              <p className="text-slate-600 dark:text-slate-400">{ev.snippet}</p>
                              <p className="font-mono text-[11px] text-slate-400">
                                Retrieved {new Date(ev.retrieved_at).toLocaleString()} via {ev.provider}
                              </p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-slate-500 dark:text-slate-400 italic">
                          No external evidence retrieved for this claim. Verify independently using primary sources.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Linguistic Signals & Transparency */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-6 space-y-4">
          <h2 className="text-base font-semibold">Linguistic & framing signals</h2>
          <ul className="space-y-2 text-sm text-slate-700 dark:text-slate-300">
            {report.linguistic_analysis.framing_notes.map((note, idx) => (
              <li key={idx} className="leading-relaxed">
                • {note}
              </li>
            ))}
          </ul>
          {[
            ...report.linguistic_analysis.sensationalism_indicators,
            ...report.linguistic_analysis.certainty_language,
            ...report.linguistic_analysis.attribution_quality,
          ].length > 0 && (
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Flagged phrases (signals only)</p>
              {[
                ...report.linguistic_analysis.sensationalism_indicators,
                ...report.linguistic_analysis.certainty_language,
                ...report.linguistic_analysis.attribution_quality,
              ]
                .slice(0, 6)
                .map((ind, i) => (
                  <div key={i} className="text-xs">
                    <span className="font-mono font-medium text-slate-900 dark:text-slate-100">"{ind.phrase}"</span>{' '}
                    <span className="text-slate-500 dark:text-slate-400">— {ind.reason}</span>
                  </div>
                ))}
            </div>
          )}
        </section>

        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-6 space-y-4">
          <h2 className="text-base font-semibold">Source transparency & next steps</h2>
          <div className="space-y-2.5">
            {report.transparency_checks.map((tc, i) => (
              <div key={i} className="flex items-start gap-2.5 text-xs">
                {tc.detected ? (
                  <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <X className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                )}
                <div>
                  <p className="font-medium text-slate-900 dark:text-slate-100">{tc.check}</p>
                  <p className="text-slate-500 dark:text-slate-400">{tc.detail}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">What to verify next</p>
            <ul className="space-y-1.5 text-xs text-slate-700 dark:text-slate-300">
              {report.next_steps.map((step, i) => (
                <li key={i}>• {step}</li>
              ))}
            </ul>
          </div>
        </section>
      </div>

      {/* Streaming Gemini Follow-up Assistant */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-6 space-y-4">
        <div>
          <h2 className="text-base font-semibold">Follow-up analysis assistant</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Ask questions about the claims, framing, or ML signals in this report. Responses stream from Gemini
            server-side using only this report context.
          </p>
        </div>

        {messages.length > 0 && (
          <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
            {messages.map((m, idx) => (
              <div
                key={idx}
                className={`p-3 rounded-md text-sm leading-relaxed ${
                  m.role === 'user'
                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 ml-8'
                    : 'bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 mr-8'
                }`}
              >
                <p className="text-[11px] font-mono text-slate-500 mb-1">
                  {m.role === 'user' ? 'You' : 'TruthLens Assistant'}
                </p>
                <p className="whitespace-pre-wrap">{m.text || (streaming ? 'Generating...' : '')}</p>
              </div>
            ))}
          </div>
        )}

        <form onSubmit={handleAsk} className="flex gap-2">
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask e.g. 'Which claim is most important to verify first?'"
            className="flex-1 px-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-slate-300"
          />
          {streaming ? (
            <button
              type="button"
              onClick={() => abortRef.current?.abort()}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-rose-600 text-white rounded-md hover:bg-rose-700"
            >
              <Square className="w-3.5 h-3.5" /> Stop
            </button>
          ) : (
            <button
              type="submit"
              disabled={!question.trim()}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-950 rounded-md hover:bg-slate-800 disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" /> Ask
            </button>
          )}
        </form>
      </section>
    </div>
  );
}
