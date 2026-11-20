import React, { useEffect, useState } from 'react';
import { FileText, Link2, Upload, Sparkles, AlertCircle, Loader2 } from 'lucide-react';
import { apiFetch } from '../services/api';
import { AnalysisReport, DemoArticle } from '../types/api';

interface AnalyzeViewProps {
  onComplete: (report: AnalysisReport) => void;
}

type InputTab = 'text' | 'url' | 'file' | 'sample';

export function AnalyzeView({ onComplete }: AnalyzeViewProps) {
  const [tab, setTab] = useState<InputTab>('text');
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [urlInput, setUrlInput] = useState('');
  const [extractedUrl, setExtractedUrl] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [stage, setStage] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [demos, setDemos] = useState<DemoArticle[]>([]);
  const [isDemo, setIsDemo] = useState(false);

  useEffect(() => {
    apiFetch<{ items: DemoArticle[] }>('/api/v1/demo-articles')
      .then((res) => setDemos(res.items))
      .catch(() => {});
  }, []);

  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
  const isShort = wordCount > 0 && wordCount < 35;

  const handleExtractUrl = async () => {
    setError(null);
    setExtracting(true);
    try {
      const res = await apiFetch<{ url: string; title: string | null; text: string }>('/api/v1/extract-url', {
        method: 'POST',
        body: JSON.stringify({ url: urlInput }),
      });
      setTitle(res.title || '');
      setText(res.text);
      setExtractedUrl(res.url);
      setIsDemo(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to extract article from URL.');
    } finally {
      setExtracting(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setExtracting(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await apiFetch<{ filename: string; text: string }>('/api/v1/extract-file', {
        method: 'POST',
        body: formData,
      });
      setTitle(res.filename.replace(/\.[^.]+$/, ''));
      setText(res.text);
      setExtractedUrl(null);
      setIsDemo(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to extract document text.');
    } finally {
      setExtracting(false);
    }
  };

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (text.trim().length < 10) {
      setError('Please enter at least 10 characters of article text or a headline.');
      return;
    }
    setError(null);
    setAnalyzing(true);
    setStage('Running trained ML classifier, linguistic signals, and Gemini claim extraction...');

    try {
      const inputType = isDemo ? 'demo' : tab === 'url' ? 'url' : tab === 'file' ? 'file' : isShort ? 'headline' : 'text';
      const report = await apiFetch<AnalysisReport>('/api/v1/analyses', {
        method: 'POST',
        body: JSON.stringify({
          input_type: inputType,
          title: title.trim() || null,
          url: extractedUrl,
          text: text.trim(),
          is_demo: isDemo,
        }),
      });
      onComplete(report);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed.');
    } finally {
      setAnalyzing(false);
      setStage('');
    }
  };

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight">Analyze an article</h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
          Submit news text, a URL, or a document. TruthLens AI surfaces ML lexical signals, linguistic cues, and
          checkable claims.
        </p>
      </div>

      {/* Input Tabs */}
      <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg w-fit">
        {[
          { id: 'text', label: 'Paste text', icon: FileText },
          { id: 'url', label: 'URL', icon: Link2 },
          { id: 'file', label: 'Upload file', icon: Upload },
          { id: 'sample', label: 'Demo samples', icon: Sparkles },
        ].map((item) => {
          const Icon = item.icon;
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => { setTab(item.id as InputTab); setError(null); }}
              className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                active
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Icon className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-6 space-y-5">
        {tab === 'url' && (
          <div className="space-y-3 pb-4 border-b border-slate-200 dark:border-slate-800">
            <label htmlFor="article-url" className="block text-xs font-medium text-slate-700 dark:text-slate-300">
              Article URL (SSRF-protected http/https only)
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                id="article-url"
                type="url"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="https://example.org/news-article"
                className="flex-1 px-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-slate-300"
              />
              <button
                type="button"
                disabled={extracting || !urlInput.trim()}
                onClick={handleExtractUrl}
                className="px-4 py-2 text-xs font-medium bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-950 rounded-md hover:bg-slate-800 disabled:opacity-50 whitespace-nowrap"
              >
                {extracting ? 'Extracting...' : 'Fetch & preview'}
              </button>
            </div>
          </div>
        )}

        {tab === 'file' && (
          <div className="space-y-2 pb-4 border-b border-slate-200 dark:border-slate-800">
            <label htmlFor="article-file" className="block text-xs font-medium text-slate-700 dark:text-slate-300">
              Upload document (.txt, .pdf, .docx — max 10 MB)
            </label>
            <input
              id="article-file"
              type="file"
              accept=".txt,.pdf,.docx"
              onChange={handleFileUpload}
              disabled={extracting}
              className="block w-full text-xs text-slate-600 dark:text-slate-300 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border file:border-slate-300 dark:file:border-slate-700 file:text-xs file:font-medium file:bg-slate-50 dark:file:bg-slate-800 hover:file:bg-slate-100"
            />
          </div>
        )}

        {tab === 'sample' && (
          <div className="space-y-3 pb-4 border-b border-slate-200 dark:border-slate-800">
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Select a clearly labeled demonstration article to test the live ML + linguistic + Gemini pipeline:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {demos.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => {
                    setTitle(d.title);
                    setText(d.text);
                    setExtractedUrl(null);
                    setIsDemo(true);
                  }}
                  className="text-left p-3.5 rounded-md border border-slate-200 dark:border-slate-800 hover:border-slate-400 dark:hover:border-slate-600 transition-colors"
                >
                  <p className="text-xs font-mono text-slate-500 dark:text-slate-400 mb-1">
                    {d.category} · {d.expected_signal}
                  </p>
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100 line-clamp-2">{d.title}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        <form onSubmit={handleAnalyze} className="space-y-4">
          <div>
            <label htmlFor="article-title" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Headline or title (optional)
            </label>
            <input
              id="article-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter article headline..."
              className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-slate-300"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="article-body" className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Article text
              </label>
              <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
                {text.length.toLocaleString()} / 30,000 chars · {wordCount} words
              </span>
            </div>
            <textarea
              id="article-body"
              rows={9}
              required
              maxLength={30000}
              value={text}
              onChange={(e) => { setText(e.target.value); setIsDemo(false); }}
              placeholder="Paste the full article text or headline here..."
              className="w-full px-3.5 py-3 text-sm leading-relaxed bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-slate-300"
            />
          </div>

          {isShort && (
            <div className="flex items-start gap-2 p-3 text-xs text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-md">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
              <span>
                Short or headline-only input detected ({wordCount} words). Limited context reduces ML and linguistic
                reliability; paste the full article body when available.
              </span>
            </div>
          )}

          {error && (
            <div role="alert" className="p-3 text-xs text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-md">
              {error}
            </div>
          )}

          {analyzing && (
            <div className="flex items-center gap-2.5 p-3 text-xs text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-md">
              <Loader2 className="w-4 h-4 animate-spin shrink-0" aria-hidden="true" />
              <span>{stage}</span>
            </div>
          )}

          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={() => { setTitle(''); setText(''); setUrlInput(''); setExtractedUrl(null); setIsDemo(false); setError(null); }}
              className="text-xs text-slate-500 hover:text-slate-900 dark:hover:text-slate-200"
            >
              Clear input
            </button>
            <button
              type="submit"
              disabled={analyzing || text.trim().length < 10}
              className="px-5 py-2.5 text-sm font-medium bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-950 rounded-md hover:bg-slate-800 dark:hover:bg-white disabled:opacity-50 transition-colors"
            >
              {analyzing ? 'Analyzing...' : 'Run analysis'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
