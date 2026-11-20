import { MlPredictionResult } from '../../ml/inference/classifier';
import { LinguisticAnalysisResult } from './linguistic';

export type AssessmentLabel =
  | 'LIKELY_CREDIBLE'
  | 'POTENTIALLY_MISLEADING'
  | 'INSUFFICIENT_EVIDENCE'
  | 'NEEDS_VERIFICATION'
  | 'ANALYSIS_UNAVAILABLE';

export interface AssessmentOutcome {
  label: AssessmentLabel;
  display_label: string;
  reason: string;
  limitations: string[];
}

export function computeCautiousAssessment(
  ml: MlPredictionResult,
  linguistic: LinguisticAnalysisResult,
  evidenceAvailable: boolean
): AssessmentOutcome {
  const limitations = [
    'TruthLens AI is an analytical assistant, not a definitive truth authority.',
    'ML predictions measure lexical similarity to historical labeled patterns, not objective factual truth.',
  ];

  if (linguistic.is_short_input) {
    limitations.push('Input is short or headline-only; limited context reduces classification reliability.');
  }
  if (!evidenceAvailable) {
    limitations.push('External evidence retrieval is not configured; factual claims have not been independently corroborated.');
  }

  if (!ml.available && linguistic.word_count < 10) {
    return {
      label: 'ANALYSIS_UNAVAILABLE',
      display_label: 'Analysis unavailable',
      reason: 'ML model artifact is unavailable and input text is too short for meaningful analysis.',
      limitations,
    };
  }

  if (linguistic.is_short_input) {
    return {
      label: 'INSUFFICIENT_EVIDENCE',
      display_label: 'Insufficient evidence',
      reason: 'Short or headline-only text lacks sufficient context for a reliable credibility assessment.',
      limitations,
    };
  }

  const highRiskLinguisticCount =
    linguistic.sensationalism_indicators.length +
    linguistic.certainty_language.filter((c) => c.severity === 'high').length +
    linguistic.attribution_quality.length;

  if (ml.available && ml.predicted_class === 'misleading_or_sensational' && (ml.score ?? 0) >= 0.65) {
    return {
      label: 'POTENTIALLY_MISLEADING',
      display_label: 'Potentially misleading',
      reason:
        highRiskLinguisticCount > 0
          ? 'Both the trained ML classifier and linguistic indicators flagged sensationalist, unattributed, or misleading patterns.'
          : 'The trained ML classifier flagged lexical patterns associated with misleading or sensationalist articles. Corroborate claims independently.',
      limitations,
    };
  }

  if (highRiskLinguisticCount >= 2) {
    return {
      label: 'POTENTIALLY_MISLEADING',
      display_label: 'Potentially misleading',
      reason: 'Multiple sensationalist, absolutist, or vague attribution signals were detected.',
      limitations,
    };
  }

  if (ml.available && ml.predicted_class === 'credible_reporting' && (ml.score ?? 0) >= 0.65 && highRiskLinguisticCount === 0) {
    if (!evidenceAvailable) {
      return {
        label: 'LIKELY_CREDIBLE',
        display_label: 'Likely credible (unverified)',
        reason: 'Linguistic structure and ML lexical signals align with standard journalistic reporting, though factual claims still require primary-source verification.',
        limitations,
      };
    }
    return {
      label: 'LIKELY_CREDIBLE',
      display_label: 'Likely credible',
      reason: 'ML lexical signals, neutral framing, and transparency indicators align with credible reporting.',
      limitations,
    };
  }

  return {
    label: 'NEEDS_VERIFICATION',
    display_label: 'Needs verification',
    reason: 'Signals are mixed or moderate; key factual claims should be cross-checked against primary sources.',
    limitations,
  };
}

export function extractFallbackClaims(text: string): Array<{
  text: string;
  type: 'statistic' | 'event' | 'quote' | 'policy' | 'science' | 'public_figure' | 'other';
  checkability: 'checkable' | 'opinion' | 'vague' | 'prediction' | 'not_checkable';
  search_query: string;
  caveat: string;
}> {
  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 25 && s.length <= 320);

  const selected = sentences.slice(0, 4);
  return selected.map((s) => {
    const hasStat = /\b\d+(\.\d+)?\s*(%|percent|million|billion|\$)\b/i.test(s);
    const hasPolicy = /\b(bill|council|vote|commission|regulation|federal|government|law)\b/i.test(s);
    const hasScience = /\b(study|researchers|journal|vaccine|climate|temperature|telescope|hospital)\b/i.test(s);
    const type = hasStat ? 'statistic' : hasScience ? 'science' : hasPolicy ? 'policy' : 'event';
    const words = s.replace(/[^a-zA-Z0-9\s]/g, '').split(/\s+/).slice(0, 8).join(' ');
    return {
      text: s,
      type,
      checkability: 'checkable',
      search_query: words,
      caveat: 'Extracted via sentence-level heuristic; verify against primary institutional records.',
    };
  });
}

export const DEMO_ARTICLES = [
  {
    id: 'demo-credible-1',
    title: 'DEMO: Municipal Transit Bond Approved After Public Audit',
    category: 'Public Policy',
    expected_signal: 'Likely credible',
    text: 'City council members voted 7 to 4 on Wednesday to approve a $42 million municipal bond for transit infrastructure repairs. According to the city budget office, the funding will prioritize bridge inspections and bus rapid transit lanes along three high-volume corridors beginning in the second quarter. Auditors verified the expenditure figures against quarterly municipal ledger statements, and the agency scheduled a follow-up review in six months to evaluate preliminary outcomes.',
  },
  {
    id: 'demo-misleading-1',
    title: 'DEMO: Shocking Secret Kitchen Spice Cures Heart Disease Overnight',
    category: 'Public Health',
    expected_signal: 'Potentially misleading',
    text: 'SHOCKING SECRET doctors do not want you to know! A miracle kitchen spice completely cures chronic heart disease in just 48 hours, and Big Pharma is desperately hiding the truth to protect billion-dollar profits. Anonymous insiders revealed the shocking truth that will destroy the establishment! Share this before they censor and delete it forever!',
  },
  {
    id: 'demo-short-1',
    title: 'DEMO: Headline-Only Short Input Example',
    category: 'General',
    expected_signal: 'Insufficient evidence',
    text: 'Central bank officials signal possible rate adjustment ahead of quarterly inflation report.',
  },
];
