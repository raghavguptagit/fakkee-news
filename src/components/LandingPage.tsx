import { ArrowRight, FileSearch, Scale, ShieldCheck, BookOpen } from 'lucide-react';

interface LandingPageProps {
  onGetStarted: () => void;
  onViewModels: () => void;
  onSignIn: () => void;
}

export function LandingPage({ onGetStarted, onViewModels, onSignIn }: LandingPageProps) {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {/* Strict 3-Zone Top Bar */}
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-950/90 backdrop-blur sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between gap-8">
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
            <button
              type="button"
              onClick={onSignIn}
              className="hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              Sign in
            </button>
          </nav>

          <div className="shrink-0">
            <button
              type="button"
              onClick={onGetStarted}
              className="px-4 py-2 text-sm font-medium bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-950 rounded-md hover:bg-slate-800 dark:hover:bg-white transition-colors whitespace-nowrap shrink-0"
            >
              Analyze an article
            </button>
          </div>
        </div>
      </header>

      <main id="top">
        {/* Hero Section */}
        <section className="max-w-6xl mx-auto px-6 pt-20 pb-20 border-b border-slate-200 dark:border-slate-800">
          <div className="max-w-3xl">
            <p className="text-xs font-mono tracking-wide text-slate-500 dark:text-slate-400 mb-4">
              News Credibility · Claim Extraction · Transparent NLP
            </p>
            <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight leading-[1.1] text-balance mb-6">
              Know what to trust. Understand what to verify.
            </h1>
            <p className="text-lg text-slate-600 dark:text-slate-300 leading-relaxed max-w-2xl mb-10">
              TruthLens AI pairs a trained TF-IDF machine learning classifier with linguistic signal detection,
              structured claim extraction, and Gemini contextual analysis—so readers see both the signals and the
              limitations.
            </p>
            <div className="flex flex-wrap items-center gap-4">
              <button
                type="button"
                onClick={onGetStarted}
                className="inline-flex items-center gap-2 px-6 py-3 text-sm font-medium bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-950 rounded-md hover:bg-slate-800 dark:hover:bg-white transition-colors"
              >
                <span>Analyze an article</span>
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={onViewModels}
                className="inline-flex items-center gap-2 px-5 py-3 text-sm font-medium border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-md hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors"
              >
                Inspect model metrics
              </button>
            </div>
          </div>
        </section>

        {/* How it Works */}
        <section id="how-it-works" className="max-w-6xl mx-auto px-6 py-20 border-b border-slate-200 dark:border-slate-800">
          <div className="mb-12">
            <h2 className="font-display text-3xl font-semibold tracking-tight mb-3">Four-stage transparent pipeline</h2>
            <p className="text-slate-600 dark:text-slate-400 max-w-2xl">
              Every submission passes through distinct, inspectable stages. Model scores are never presented as objective
              factual truth.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              {
                step: '01. Ingest & Clean',
                icon: FileSearch,
                desc: 'Submit pasted text, a headline, an SSRF-checked URL, or a .txt/.pdf/.docx document.',
              },
              {
                step: '02. ML & Linguistic Signals',
                icon: Scale,
                desc: 'Trained TF-IDF Logistic Regression scores lexical patterns and surfaces top contributing terms alongside sensationalism cues.',
              },
              {
                step: '03. Claim Extraction',
                icon: BookOpen,
                desc: 'Gemini extracts specific checkable claims, separates opinions, and suggests primary-source verification queries.',
              },
              {
                step: '04. Cautious Review',
                icon: ShieldCheck,
                desc: 'Review evidence provenance, uncertainty caveats, and ask follow-up questions in a streaming assistant.',
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
        <section id="methodology" className="max-w-6xl mx-auto px-6 py-20">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
            <div>
              <h2 className="font-display text-3xl font-semibold tracking-tight mb-4">
                Built for critical reading, not automated censorship
              </h2>
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed mb-4">
                TruthLens AI is an analytical assistant, not an authority that declares truth. It cannot independently
                prove every statement, and results must always be interpreted alongside primary sources.
              </p>
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                When external evidence retrieval is unconfigured, claims are explicitly labeled as unverified rather than
                fabricating citations or URLs.
              </p>
            </div>
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-6 space-y-4">
              <h3 className="text-base font-semibold">Core integrity guarantees</h3>
              <ul className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
                <li className="pb-3 border-b border-slate-100 dark:border-slate-800">
                  <strong className="text-slate-900 dark:text-slate-100 font-medium">Genuine trained ML artifact:</strong>{' '}
                  TF-IDF + Logistic Regression evaluated against Linear SVM with real confusion matrix and ROC-AUC.
                </li>
                <li className="pb-3 border-b border-slate-100 dark:border-slate-800">
                  <strong className="text-slate-900 dark:text-slate-100 font-medium">Zero fabricated evidence:</strong>{' '}
                  Sources are only shown when retrieved from a configured search provider with timestamps.
                </li>
                <li>
                  <strong className="text-slate-900 dark:text-slate-100 font-medium">Private SQLite storage:</strong>{' '}
                  All analyses are isolated per user account in local SQLite storage with full export and deletion controls.
                </li>
              </ul>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 dark:border-slate-800 py-10">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500 dark:text-slate-400">
          <span>TruthLens AI — News Credibility & Claim Analysis Platform</span>
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
