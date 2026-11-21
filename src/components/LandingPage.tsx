import React, { useEffect, useState } from 'react';
import {
  FileSearch,
  Scale,
  ShieldCheck,
  BookOpen,
  FileText,
  Link2,
  Upload,
  Sparkles,
  Loader2,
  AlertCircle,
  RotateCcw,
} from 'lucide-react';
import { apiFetch } from '../services/api';
import { AnalysisReport, DemoArticle } from '../types/api';
import { SimpleResultCard } from './SimpleResultCard';

interface LandingPageProps {
  onGetStarted: () => void;
  onViewModels: () => void;
  onSignIn: () => void;
}

type InputTab = 'text' | 'url' | 'file' | 'sample';

export function LandingPage({ onGetStarted, onViewModels, onSignIn }: LandingPageProps) {
  const [tab, setTab] = useState<InputTab>('text');
  const [outputLanguage, setOutputLanguage] = useState<'en' | 'hi'>('en');
  const [text, setText] = useState('');
  const [title, setTitle] = useState('');
  const [urlInput, setUrlInput] = useState('');
  const [extractedUrl, setExtractedUrl] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<AnalysisReport | null>(null);
  const [demos, setDemos] = useState<DemoArticle[]>([]);
  const [isDemo, setIsDemo] = useState(false);

  useEffect(() => {
    apiFetch<{ items: DemoArticle[] }>('/api/v1/demo-articles')
      .then((res) => setDemos(res.items))
      .catch(() => {});
  }, []);

  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;

  const handleExtractUrl = async () => {
    if (!urlInput.trim() || extracting) return;
    setError(null);
    setExtracting(true);
    try {
      const res = await apiFetch<{ url: string; title: string | null; text: string }>('/api/v1/public/extract-url', {
        method: 'POST',
        body: JSON.stringify({ url: urlInput }),
      });
      setTitle(res.title || '');
      setText(res.text);
      setExtractedUrl(res.url);
      setIsDemo(false);
      setTab('text');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read that link. Please paste the news text directly.');
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
      const res = await apiFetch<{ filename: string; text: string }>('/api/v1/public/extract-file', {
        method: 'POST',
        body: formData,
      });
      setTitle(res.filename.replace(/\.[^.]+$/, ''));
      setText(res.text);
      setExtractedUrl(null);
      setIsDemo(false);
      setTab('text');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read that file. Please paste the news text directly.');
    } finally {
      setExtracting(false);
    }
  };

  const runCheck = async () => {
    if (checking) return;
    const trimmed = text.trim();
    if (trimmed.length < 10 || !/[\p{L}\p{N}]/u.test(trimmed)) {
      setError(
        outputLanguage === 'hi'
          ? 'कृपया जांच के लिए कम से कम 10 अक्षरों की खबर या हेडलाइन दर्ज करें।'
          : 'Please enter at least 10 characters of readable news text or a headline to check.'
      );
      return;
    }

    setError(null);
    setChecking(true);
    try {
      const inputType = isDemo ? 'demo' : extractedUrl ? 'url' : tab === 'file' ? 'file' : wordCount < 25 ? 'headline' : 'text';
      const result = await apiFetch<AnalysisReport>(
        '/api/v1/public/analyze',
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
      setReport(result);
    } catch {
      setError(
        outputLanguage === 'hi'
          ? 'क्षमा करें, अभी इस खबर की जांच नहीं हो सकी। कृपया पुनः प्रयास करें।'
          : 'Sorry, we could not check this news right now. Please try again.'
      );
    } finally {
      setChecking(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await runCheck();
  };

  const handleClear = () => {
    setTitle('');
    setText('');
    setUrlInput('');
    setExtractedUrl(null);
    setIsDemo(false);
    setError(null);
    setReport(null);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {/* Clean 3-Zone Top Bar */}
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-950/90 backdrop-blur sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <a href="#top" className="font-display text-xl font-semibold tracking-tight whitespace-nowrap shrink-0">
            TruthLens AI
          </a>

          <nav className="hidden md:flex items-center gap-7 text-sm text-slate-600 dark:text-slate-300">
            <a href="#how-it-works" className="hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0">
              How it works
            </a>
            <a href="#methodology" className="hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0">
              Methodology
            </a>
            <button
              type="button"
              onClick={onViewModels}
              className="hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              Model Card
            </button>
          </nav>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <button
              type="button"
              onClick={onSignIn}
              className="px-3 py-2 text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-900 rounded-md transition-colors whitespace-nowrap"
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={onGetStarted}
              className="px-3.5 py-2 text-xs sm:text-sm font-medium bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-950 rounded-md hover:bg-slate-800 dark:hover:bg-white transition-colors whitespace-nowrap"
            >
              Save Workspace
            </button>
          </div>
        </div>
      </header>

      <main id="top">
        {/* Hero + Instant News Checker */}
        <section className="max-w-5xl mx-auto px-4 sm:px-6 pt-10 sm:pt-14 pb-16 border-b border-slate-200 dark:border-slate-800 space-y-8">
          <div className="max-w-3xl space-y-3">
            <p className="text-xs font-mono tracking-wide text-slate-500 dark:text-slate-400">
              Fake News & Claim Checker · English & हिन्दी
            </p>
            <h1 className="font-display text-3xl sm:text-5xl font-semibold tracking-tight leading-[1.12] text-balance">
              Know what to trust. Understand what to verify.
            </h1>
            <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300 leading-relaxed">
              Paste any news headline, article, or forwarded message below. We check the wording, identify key claims,
              and explain the result in simple language.
            </p>
          </div>

          {/* Instant Check News Box */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 sm:p-6 shadow-xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg">
                {[
                  { id: 'text', label: 'Paste news', icon: FileText },
                  { id: 'url', label: 'Link', icon: Link2 },
                  { id: 'file', label: 'File', icon: Upload },
                  { id: 'sample', label: 'Samples', icon: Sparkles },
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
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
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

              {/* Language Selector */}
              <div className="flex items-center gap-2 self-start sm:self-auto">
                <span className="text-xs text-slate-500 dark:text-slate-400">Result language:</span>
                <div className="inline-flex p-0.5 bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md">
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

            {tab === 'url' && (
              <div className="space-y-2 pb-4 border-b border-slate-200 dark:border-slate-800">
                <label htmlFor="public-url" className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Paste news article link
                </label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    id="public-url"
                    type="url"
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    placeholder="https://example.org/news-story"
                    className="flex-1 min-w-0 px-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-slate-300"
                  />
                  <button
                    type="button"
                    disabled={extracting || !urlInput.trim()}
                    onClick={handleExtractUrl}
                    className="px-4 py-2 text-xs font-medium bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-950 rounded-md hover:bg-slate-800 disabled:opacity-50 whitespace-nowrap"
                  >
                    {extracting ? 'Reading link...' : 'Load article'}
                  </button>
                </div>
              </div>
            )}

            {tab === 'file' && (
              <div className="space-y-2 pb-4 border-b border-slate-200 dark:border-slate-800">
                <label htmlFor="public-file" className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Upload a news document (.txt, .pdf, .docx — up to 10 MB)
                </label>
                <input
                  id="public-file"
                  type="file"
                  accept=".txt,.pdf,.docx"
                  onChange={handleFileUpload}
                  disabled={extracting}
                  className="block w-full text-xs text-slate-600 dark:text-slate-300 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border file:border-slate-300 dark:file:border-slate-700 file:text-xs file:font-medium file:bg-slate-50 dark:file:bg-slate-800"
                />
              </div>
            )}

            {tab === 'sample' && (
              <div className="space-y-3 pb-4 border-b border-slate-200 dark:border-slate-800">
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Click any sample below to load it, then click <strong>Check News</strong>:
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
                        setReport(null);
                        setError(null);
                        if (d.id.includes('hindi')) setOutputLanguage('hi');
                      }}
                      className="text-left p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:border-slate-400 dark:hover:border-slate-600 transition-colors"
                    >
                      <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400 mb-1">
                        {d.category} · {d.expected_signal}
                      </p>
                      <p className="text-sm font-medium text-slate-900 dark:text-slate-100 line-clamp-2">{d.title}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                  <label htmlFor="public-news-input" className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    {outputLanguage === 'hi' ? 'समाचार, हेडलाइन या संदेश यहाँ पेस्ट करें' : 'News headline, article, or claim'}
                  </label>
                  <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
                    {wordCount} words
                  </span>
                </div>
                <textarea
                  id="public-news-input"
                  rows={6}
                  maxLength={30000}
                  value={text}
                  onChange={(e) => {
                    setText(e.target.value);
                    setIsDemo(false);
                    if (error) setError(null);
                  }}
                  placeholder={
                    outputLanguage === 'hi'
                      ? 'कोई भी खबर, हेडलाइन, WhatsApp संदेश या दावा यहाँ लिखें या पेस्ट करें...'
                      : 'Paste any news headline, full article, social media post, or WhatsApp forward here...'
                  }
                  className="w-full px-3.5 py-3 text-sm sm:text-base leading-relaxed bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-slate-300"
                />
              </div>

              {error && (
                <div
                  role="alert"
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 text-xs sm:text-sm text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-lg"
                >
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                    <span>{error}</span>
                  </div>
                  {text.trim().length >= 10 && (
                    <button
                      type="button"
                      onClick={runCheck}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white dark:bg-slate-900 border border-rose-300 dark:border-rose-800 rounded-md hover:bg-rose-100/60 shrink-0 self-start sm:self-auto"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>{outputLanguage === 'hi' ? 'पुनः प्रयास करें' : 'Retry'}</span>
                    </button>
                  )}
                </div>
              )}

              {checking && (
                <div className="flex items-center gap-3 p-3.5 text-sm text-slate-700 dark:text-slate-200 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-lg">
                  <Loader2 className="w-4 h-4 animate-spin shrink-0" aria-hidden="true" />
                  <span>
                    {outputLanguage === 'hi'
                      ? 'इस खबर की जांच हो रही है... कृपया कुछ सेकंड प्रतीक्षा करें।'
                      : 'Checking this news... Please wait a few seconds.'}
                  </span>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <button
                  type="button"
                  onClick={handleClear}
                  disabled={checking}
                  className="px-4 py-2 text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-300 border border-slate-300 dark:border-slate-700 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50"
                >
                  {outputLanguage === 'hi' ? 'साफ़ करें' : 'Clear'}
                </button>

                <button
                  type="submit"
                  disabled={checking || text.trim().length < 10}
                  className="px-6 py-2.5 text-sm font-medium bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-950 rounded-md hover:bg-slate-800 dark:hover:bg-white disabled:opacity-50 transition-colors"
                >
                  {checking
                    ? outputLanguage === 'hi'
                      ? 'जांच हो रही है...'
                      : 'Checking...'
                    : outputLanguage === 'hi'
                      ? 'खबर जांचें'
                      : 'Check News'}
                </button>
              </div>
            </form>
          </div>

          {/* Result Card */}
          {report && (
            <div className="space-y-4">
              <SimpleResultCard
                report={report}
                onRetry={runCheck}
                onCheckAnother={handleClear}
              />
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs text-slate-600 dark:text-slate-400">
                <span>Want to save your checks, compare two articles side-by-side, or ask follow-up questions?</span>
                <button
                  type="button"
                  onClick={onGetStarted}
                  className="px-3.5 py-2 text-xs font-medium bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-950 rounded-md hover:bg-slate-800 whitespace-nowrap self-start sm:self-auto"
                >
                  Open personal workspace
                </button>
              </div>
            </div>
          )}
        </section>

        {/* How it Works */}
        <section id="how-it-works" className="max-w-6xl mx-auto px-4 sm:px-6 py-16 border-b border-slate-200 dark:border-slate-800">
          <div className="mb-10">
            <h2 className="font-display text-3xl font-semibold tracking-tight mb-3">How TruthLens checks news</h2>
            <p className="text-slate-600 dark:text-slate-400 max-w-2xl">
              Every submission goes through four transparent checks—never forcing uncertain claims into a fake yes or no.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                step: '01. Read & Clean',
                icon: FileSearch,
                desc: 'Accepts pasted news, headlines, links, or .txt/.pdf/.docx documents in English and Hindi.',
              },
              {
                step: '02. Tone & Pattern Check',
                icon: Scale,
                desc: 'Spots urgent forwarding pressure, dramatic clickbait wording, and missing source attributions.',
              },
              {
                step: '03. Claim & Source Check',
                icon: BookOpen,
                desc: 'Extracts the main factual claim and checks configured reliable sources without ever inventing links.',
              },
              {
                step: '04. Clear Honest Verdict',
                icon: ShieldCheck,
                desc: 'Explains why in plain English or Hindi—and clearly says Unverified when evidence is missing.',
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.step} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-6">
                  <Icon className="w-5 h-5 text-slate-700 dark:text-slate-300 mb-4" aria-hidden="true" />
                  <h3 className="text-base font-semibold mb-2">{item.step}</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{item.desc}</p>
                </div>
              );
            })}
          </div>
        </section>

        {/* Responsible AI & Limitations */}
        <section id="methodology" className="max-w-6xl mx-auto px-4 sm:px-6 py-16">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-start">
            <div>
              <h2 className="font-display text-3xl font-semibold tracking-tight mb-4">
                Built for critical reading, never guesswork
              </h2>
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed mb-4">
                TruthLens AI helps ordinary readers spot misleading claims and know what to verify. It does not invent
                citations or pretend uncertain breaking news is confirmed.
              </p>
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                When live web verification is unavailable, the system tells you clearly so you can double-check with
                trusted newsrooms or official announcements.
              </p>
            </div>
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-6 space-y-4">
              <h3 className="text-base font-semibold">Three clear outcomes</h3>
              <ul className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
                <li className="pb-3 border-b border-slate-100 dark:border-slate-800">
                  <strong className="text-emerald-700 dark:text-emerald-400 font-medium">Likely True:</strong>{' '}
                  Supported by reliable evidence or consistent with verified public facts and neutral reporting.
                </li>
                <li className="pb-3 border-b border-slate-100 dark:border-slate-800">
                  <strong className="text-rose-700 dark:text-rose-400 font-medium">Likely Fake / Misleading:</strong>{' '}
                  Contradicts verified facts or displays strong misinformation and scam patterns.
                </li>
                <li>
                  <strong className="text-amber-700 dark:text-amber-400 font-medium">Unverified:</strong>{' '}
                  Not enough reliable evidence yet—always verify before believing or forwarding.
                </li>
              </ul>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 dark:border-slate-800 py-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500 dark:text-slate-400">
          <span>TruthLens AI — Fake News & Claim Verification Assistant</span>
          <div className="flex items-center gap-6">
            <button type="button" onClick={onViewModels} className="hover:text-slate-900 dark:hover:text-slate-200">
              Model Transparency
            </button>
            <button type="button" onClick={onSignIn} className="hover:text-slate-900 dark:hover:text-slate-200">
              Sign in
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
