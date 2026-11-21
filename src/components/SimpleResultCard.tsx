import { useState } from 'react';
import {
  CheckCircle2,
  ShieldAlert,
  HelpCircle,
  ExternalLink,
  Copy,
  Check,
  Share2,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Globe,
  Clock,
} from 'lucide-react';
import { AnalysisReport, SimpleVerdict } from '../types/api';
import { isSafeHttpUrl } from '../services/api';
import { resolveSimpleVerdict } from './AssessmentTag';

interface SimpleResultCardProps {
  report: AnalysisReport;
  onRetry?: () => void;
  onCheckAnother?: () => void;
  showTechnicalToggle?: boolean;
}

const STYLES: Record<
  SimpleVerdict,
  {
    container: string;
    badge: string;
    iconColor: string;
    enLabel: string;
    hiLabel: string;
    Icon: typeof CheckCircle2;
  }
> = {
  likely_true: {
    container: 'border-emerald-300 bg-emerald-50/70 dark:border-emerald-900 dark:bg-emerald-950/25',
    badge: 'bg-emerald-600 text-white',
    iconColor: 'text-emerald-700 dark:text-emerald-400',
    enLabel: 'Likely True',
    hiLabel: 'संभवतः सही',
    Icon: CheckCircle2,
  },
  likely_fake: {
    container: 'border-rose-300 bg-rose-50/70 dark:border-rose-900 dark:bg-rose-950/25',
    badge: 'bg-rose-600 text-white',
    iconColor: 'text-rose-700 dark:text-rose-400',
    enLabel: 'Likely Fake / Misleading',
    hiLabel: 'संभवतः झूठी / भ्रामक',
    Icon: ShieldAlert,
  },
  unverified: {
    container: 'border-amber-300 bg-amber-50/70 dark:border-amber-900 dark:bg-amber-950/25',
    badge: 'bg-amber-600 text-white',
    iconColor: 'text-amber-700 dark:text-amber-400',
    enLabel: 'Unverified',
    hiLabel: 'अपुष्ट (पुष्टि नहीं हो सकी)',
    Icon: HelpCircle,
  },
};

export function SimpleResultCard({
  report,
  onRetry,
  onCheckAnother,
  showTechnicalToggle = true,
}: SimpleResultCardProps) {
  const [copied, setCopied] = useState(false);
  const [shareMsg, setShareMsg] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  const verdict = resolveSimpleVerdict(report.assessment.label, report.assessment.simple_verdict);
  const style = STYLES[verdict];
  const Icon = style.Icon;
  const isHindi = report.input.language === 'hi';

  const resultTitle = report.assessment.simple_result_title || report.assessment.display_label;
  const whyText = report.assessment.simple_why || report.assessment.reason;
  const adviceText =
    report.assessment.simple_advice ||
    (isHindi
      ? 'किसी भी महत्वपूर्ण खबर को आगे साझा करने से पहले विश्वसनीय समाचार संस्थानों से जांच करें।'
      : 'Check trusted news outlets or official announcements before believing or sharing this.');

  const sources = (report.sources_consulted || []).filter((s) => isSafeHttpUrl(s.source_url));
  const evidenceUsed = report.providers.evidence_search === 'completed' && sources.length > 0;

  const buildShareText = () => {
    const label = isHindi ? style.hiLabel : style.enLabel;
    return `TruthLens AI Check (${label})\n\nResult: ${resultTitle}\nWhy: ${whyText}\nWhat to do: ${adviceText}`;
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(buildShareText());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  const handleShare = async () => {
    const text = buildShareText();
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: `TruthLens AI: ${resultTitle}`,
          text,
        });
        return;
      } catch {
        // user cancelled or unavailable -> fallback to copy
      }
    }
    await handleCopy();
    setShareMsg(isHindi ? 'परिणाम कॉपी हो गया' : 'Result copied to share');
    setTimeout(() => setShareMsg(null), 2500);
  };

  return (
    <div className="space-y-5">
      {/* Main Verdict Card */}
      <div className={`border rounded-xl p-5 sm:p-6 space-y-5 ${style.container}`}>
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <Icon className={`w-7 h-7 shrink-0 mt-0.5 ${style.iconColor}`} aria-hidden="true" />
            <div className="min-w-0 space-y-1">
              <span className={`inline-block px-2.5 py-0.5 text-xs font-semibold rounded-md ${style.badge}`}>
                {isHindi ? style.hiLabel : style.enLabel}
              </span>
              <h2 className="font-display text-xl sm:text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100 break-words">
                {resultTitle}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 shrink-0">
            <Clock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>{new Date(report.provenance.created_at).toLocaleString()}</span>
          </div>
        </div>

        {/* Result / Why / What should I do */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          <div className="bg-white/90 dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800 rounded-lg p-4 space-y-1.5">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {isHindi ? 'ऐसा क्यों?' : 'Why?'}
            </h3>
            <p className="text-sm text-slate-800 dark:text-slate-200 leading-relaxed break-words">{whyText}</p>
          </div>

          <div className="bg-white/90 dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800 rounded-lg p-4 space-y-1.5">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {isHindi ? 'मुझे क्या करना चाहिए?' : 'What should I do?'}
            </h3>
            <p className="text-sm text-slate-800 dark:text-slate-200 leading-relaxed break-words">{adviceText}</p>
          </div>
        </div>

        {/* Live Source Verification Section */}
        <div className="bg-white/90 dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800 rounded-lg p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 inline-flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{isHindi ? 'जांचे गए स्रोत' : 'Sources Consulted'}</span>
            </h3>
            {!evidenceUsed && (
              <span className="text-xs text-amber-700 dark:text-amber-400 font-medium">
                {isHindi ? 'लाइव वेब जांच उपलब्ध नहीं थी' : 'Live web verification unavailable'}
              </span>
            )}
          </div>

          {evidenceUsed ? (
            <div className="space-y-2.5">
              {sources.map((src, idx) => (
                <div
                  key={`${src.source_url}-${idx}`}
                  className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md space-y-1"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-3">
                    <a
                      href={src.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium text-slate-900 dark:text-slate-100 hover:underline inline-flex items-center gap-1.5 break-words min-w-0"
                    >
                      <span className="break-words">{src.source_title}</span>
                      <ExternalLink className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                    </a>
                    <span className="text-xs font-mono text-slate-500 shrink-0">{src.publisher}</span>
                  </div>
                  {src.snippet && <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">{src.snippet}</p>}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              {isHindi
                ? 'लाइव इंटरनेट स्रोतों से पुष्टि उपलब्ध नहीं थी, इसलिए यह परिणाम केवल हमारे AI और भाषा विश्लेषण पर आधारित है। महत्वपूर्ण खबरों की पुष्टि विश्वसनीय समाचार वेबसाइटों से करें।'
                : report.evidence_note ||
                  'Live web source verification was unavailable for this check. This result is based on AI and text analysis only — please confirm important news with trusted news outlets.'}
            </p>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? (isHindi ? 'कॉपी हो गया' : 'Copied') : isHindi ? 'परिणाम कॉपी करें' : 'Copy result'}</span>
            </button>
            <button
              type="button"
              onClick={handleShare}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>{isHindi ? 'शेयर करें' : 'Share'}</span>
            </button>
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>{isHindi ? 'दोबारा जांचें' : 'Retry'}</span>
              </button>
            )}
            {shareMsg && <span className="text-xs text-slate-600 dark:text-slate-300">{shareMsg}</span>}
          </div>

          {onCheckAnother && (
            <button
              type="button"
              onClick={onCheckAnother}
              className="text-xs font-medium text-slate-700 dark:text-slate-200 hover:underline"
            >
              {isHindi ? 'दूसरी खबर जांचें' : 'Check another news item'}
            </button>
          )}
        </div>
      </div>

      {/* Collapsible Plain-Language & Researcher Details */}
      {showTechnicalToggle && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
          <button
            type="button"
            aria-expanded={showDetails}
            onClick={() => setShowDetails((d) => !d)}
            className="w-full px-5 py-3.5 flex items-center justify-between text-left text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50"
          >
            <span>
              {isHindi
                ? 'विस्तृत विवरण देखें (मुख्य दावे और लेखन शैली के संकेत)'
                : 'View detailed breakdown (claims checked, writing cues & technical notes)'}
            </span>
            {showDetails ? <ChevronUp className="w-4 h-4 shrink-0" /> : <ChevronDown className="w-4 h-4 shrink-0" />}
          </button>

          {showDetails && (
            <div className="px-5 pb-5 pt-2 border-t border-slate-200 dark:border-slate-800 space-y-5 text-xs">
              <div>
                <h4 className="font-semibold text-slate-800 dark:text-slate-200 mb-2">
                  {isHindi ? 'संदेश का सारांश' : 'Summary of the news'}
                </h4>
                <p className="text-slate-600 dark:text-slate-300 leading-relaxed">{report.summary}</p>
              </div>

              {report.claims.length > 0 && (
                <div>
                  <h4 className="font-semibold text-slate-800 dark:text-slate-200 mb-2">
                    {isHindi ? 'मुख्य दावे' : 'Main claims identified'}
                  </h4>
                  <ul className="space-y-2">
                    {report.claims.map((c) => (
                      <li key={c.id} className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md">
                        <p className="font-medium text-slate-800 dark:text-slate-200">{c.text}</p>
                        <p className="text-slate-500 dark:text-slate-400 mt-1">{c.explanation}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div>
                <h4 className="font-semibold text-slate-800 dark:text-slate-200 mb-2">
                  {isHindi ? 'लेखन और भाषा के संकेत' : 'Writing & tone observations'}
                </h4>
                <ul className="space-y-1 text-slate-600 dark:text-slate-300">
                  {report.linguistic_analysis.framing_notes.map((n, i) => (
                    <li key={i}>• {n}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
