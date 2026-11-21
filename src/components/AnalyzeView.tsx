import React, { useEffect, useState } from 'react';
import { FileText, Link2, Upload, Sparkles, AlertCircle, Loader2, RotateCcw } from 'lucide-react';
import { apiFetch } from '../services/api';
import { AnalysisReport, DemoArticle } from '../types/api';

interface AnalyzeViewProps {
  onComplete: (report: AnalysisReport) => void;
}

type InputTab = 'text' | 'url' | 'file' | 'sample';

export function AnalyzeView({ onComplete }: AnalyzeViewProps) {
  const [tab, setTab] = useState<InputTab>('text');
  const [outputLanguage, setOutputLanguage] = useState<'en' | 'hi'>('en');
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [urlInput, setUrlInput] = useState('');
  const [extractedUrl, setExtractedUrl] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [demos, setDemos] = useState<DemoArticle[]>([]);
  const [isDemo, setIsDemo] = useState(false);

  useEffect(() => {
    apiFetch<{ items: DemoArticle[] }>('/api/v1/demo-articles')
      .then((res) => setDemos(res.items))
      .catch(() => {});
  }, []);

  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
  const isShort = wordCount > 0 && wordCount < 25;

  const handleExtractUrl = async () => {
    if (!urlInput.trim() || extracting) return;
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
      setTab('text');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read that link. Please paste the article text directly.');
    } finally {
      setExtracting(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || extracting) return;
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
      setTab('text');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read that file. Please paste the article text directly.');
    } finally {
      setExtracting(false);
    }
  };

  const runAnalysis = async () => {
    if (analyzing) return;
    const trimmed = text.trim();
    if (trimmed.length < 10 || !/[\p{L}\p{N}]/u.test(trimmed)) {
      setError(
        outputLanguage === 'hi'
          ? 'कृपया जांच के लिए कम से कम 10 अक्षरों की खबर या हेडलाइन दर्ज करें।'
          : 'Please enter at least 10 characters of readable news text or a headline.'
      );
      return;
    }
    setError(null);
    setAnalyzing(true);

    try {
      const inputType = isDemo ? 'demo' : extractedUrl ? 'url' : tab === 'file' ? 'file' : isShort ? 'headline' : 'text';
      const report = await apiFetch<AnalysisReport>(
        '/api/v1/analyses',
        {
          method: 'POST',
          body: JSON.stringify({
            input_type: inputType,
            title: title.trim() || null,
            url: extractedUrl,
            text: trimmed,
            is_demo: isDemo,
            output_language: outputLanguage,
          }),
        },
        45000
      );
      onComplete(report);
    } catch {
      setError(
        outputLanguage === 'hi'
          ? 'क्षमा करें, अभी इस खबर की जांच नहीं हो सकी। कृपया पुनः प्रयास करें।'
          : 'Sorry, we could not check this news right now. Please try again.'
      );
    } finally {
      setAnalyzing(false);
    }
  };

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    await runAnalysis();
  };

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight">Check News</h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
          Paste any news headline, article, or forwarded message, or load a link or document to check it.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Input Tabs */}
        <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg">
          {[
            { id: 'text', label: 'Paste text', icon: FileText },
            { id: 'url', label: 'URL', icon: Link2 },
            { id: 'file', label: 'Upload file', icon: Upload },
            { id: 'sample', label: 'Sample news', icon: Sparkles },
          ].map((item) => {
            const Icon = item.icon;
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setTab(item.id as InputTab);
                  setError(null);
                }}
                className={`inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
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

        {/* Result Language Selector */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <span className="text-xs text-slate-500 dark:text-slate-400">Result language:</span>
          <div className="inline-flex p-0.5 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md">
            <button
              type="button"
              onClick={() => setOutputLanguage('en')}
              className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
                outputLanguage === 'en'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              English
            </button>
            <button
              type="button"
              onClick={() => setOutputLanguage('hi')}
              className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
                outputLanguage === 'hi'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              हिन्दी
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 sm:p-6 space-y-5">
        {tab === 'url' && (
          <div className="space-y-3 pb-4 border-b border-slate-200 dark:border-slate-800">
            <label htmlFor="article-url" className="block text-xs font-medium text-slate-700 dark:text-slate-300">
              Article URL (http/https)
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                id="article-url"
                type="url"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="https://example.org/news-article"
                className="flex-1 min-w-0 px-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-slate-300"
              />
              <button
                type="button"
                disabled={extracting || !urlInput.trim()}
                onClick={handleExtractUrl}
                className="px-4 py-2 text-xs font-medium bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-950 rounded-md hover:bg-slate-800 disabled:opacity-50 whitespace-nowrap"
              >
                {extracting ? 'Loading...' : 'Load article'}
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
              Select a sample below to test how TruthLens handles credible news, fake claims, short headlines, and Hindi forwards:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {demos.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => {
                    setTitle(d.title);
                    setText(d.text);
                    setExtractedUrl(null);
                    setIsDemo(true);
                    setError(null);
                    if (d.id.includes('hindi')) setOutputLanguage('hi');
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
            <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
              <label htmlFor="article-body" className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                News text or claim
              </label>
              <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
                {text.length.toLocaleString()} / 30,000 chars · {wordCount} words
              </span>
            </div>
            <textarea
              id="article-body"
              rows={8}
              required
              maxLength={30000}
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                setIsDemo(false);
                if (error) setError(null);
              }}
              placeholder={
                outputLanguage === 'hi'
                  ? 'कोई भी खबर, हेडलाइन, या वायरल संदेश यहाँ पेस्ट करें...'
                  : 'Paste any news headline, full article, or forwarded claim here...'
              }
              className="w-full px-3.5 py-3 text-sm leading-relaxed bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-slate-300"
            />
          </div>

          {isShort && (
            <div className="flex items-start gap-2 p-3 text-xs text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-md">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
              <span>
                This is a very short message ({wordCount} words). Adding the full article text gives a clearer check.
              </span>
            </div>
          )}

          {error && (
            <div
              role="alert"
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 text-xs text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-md"
            >
              <span>{error}</span>
              <button
                type="button"
                onClick={runAnalysis}
                className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium bg-white dark:bg-slate-900 border border-rose-300 dark:border-rose-800 rounded self-start sm:self-auto"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Retry</span>
              </button>
            </div>
          )}

          {analyzing && (
            <div className="flex items-center gap-2.5 p-3 text-xs sm:text-sm text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-md">
              <Loader2 className="w-4 h-4 animate-spin shrink-0" aria-hidden="true" />
              <span>
                {outputLanguage === 'hi'
                  ? 'इस खबर की जांच हो रही है...'
                  : 'Checking this news... Please wait a few seconds.'}
              </span>
            </div>
          )}

          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              disabled={analyzing}
              onClick={() => {
                setTitle('');
                setText('');
                setUrlInput('');
                setExtractedUrl(null);
                setIsDemo(false);
                setError(null);
              }}
              className="px-3.5 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 border border-slate-300 dark:border-slate-700 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50"
            >
              Clear
            </button>
            <button
              type="submit"
              disabled={analyzing || text.trim().length < 10}
              className="px-5 py-2.5 text-sm font-medium bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-950 rounded-md hover:bg-slate-800 dark:hover:bg-white disabled:opacity-50 transition-colors"
            >
              {analyzing ? 'Checking...' : 'Check News'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
