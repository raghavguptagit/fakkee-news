export type AssessmentLabel =
  | 'LIKELY_CREDIBLE'
  | 'POTENTIALLY_MISLEADING'
  | 'INSUFFICIENT_EVIDENCE'
  | 'NEEDS_VERIFICATION'
  | 'ANALYSIS_UNAVAILABLE';

export interface User {
  id: string;
  email: string;
  display_name: string;
  role: 'user' | 'admin';
}

export interface MlFeatureContribution {
  term: string;
  weight: number;
  contribution: number;
  direction: 'toward_misleading' | 'toward_credible';
}

export interface EvidenceItem {
  source_url: string;
  source_title: string;
  publisher: string;
  published_at: string | null;
  retrieved_at: string;
  snippet: string;
  relation: string;
  provider: string;
  relevance_score: number | null;
}

export interface ClaimItem {
  id: string;
  text: string;
  type: string;
  checkability: string;
  status: string;
  search_query: string;
  explanation: string;
  evidence: EvidenceItem[];
}

export interface LinguisticIndicator {
  phrase: string;
  reason: string;
  severity: 'low' | 'medium' | 'high';
}

export interface AnalysisReport {
  analysis_id: string;
  status: string;
  is_demo?: boolean;
  is_saved?: boolean;
  input: {
    type: string;
    title: string | null;
    url: string | null;
    language: string;
    word_count: number;
    is_short_input: boolean;
  };
  topic?: string;
  assessment: {
    label: AssessmentLabel;
    display_label: string;
    reason: string;
    limitations: string[];
  };
  ml: {
    available: boolean;
    model_name: string | null;
    version: string | null;
    predicted_class: string | null;
    score: number | null;
    score_type: string;
    confidence_label: string;
    explanation: MlFeatureContribution[];
    limitations_note: string;
  };
  summary: string;
  claims: ClaimItem[];
  linguistic_analysis: {
    sensationalism_indicators: LinguisticIndicator[];
    loaded_language: LinguisticIndicator[];
    certainty_language: LinguisticIndicator[];
    attribution_quality: LinguisticIndicator[];
    framing_notes: string[];
  };
  transparency_checks: Array<{
    check: string;
    detected: boolean;
    detail: string;
  }>;
  next_steps: string[];
  providers: {
    gemini: string;
    gemini_error?: string | null;
    evidence_search: string;
  };
  provenance: {
    created_at: string;
    processing_ms: number;
    model_version: string;
    analysis_pipeline_version: string;
  };
}

export interface AnalysisSummaryRow {
  id: string;
  input_type: string;
  original_url: string | null;
  title: string;
  status: string;
  assessment_label: AssessmentLabel;
  model_score: number | null;
  model_confidence_label: string | null;
  model_version: string | null;
  gemini_status: string;
  evidence_status: string;
  summary: string;
  processing_ms: number;
  created_at: string;
  is_saved: number;
}

export interface DemoArticle {
  id: string;
  title: string;
  category: string;
  expected_signal: string;
  text: string;
}

export interface ModelTransparencyData {
  available: boolean;
  setup_command?: string;
  model_name?: string;
  version?: string;
  trained_at?: string;
  artifact_hash?: string;
  vocabulary_size?: number;
  classes?: string[];
  hyperparameters?: Record<string, unknown>;
  dataset_metadata?: {
    name: string;
    license: string;
    total_samples: number;
    train_samples: number;
    test_samples: number;
    class_distribution: Record<string, number>;
    split_strategy: string;
    limitations: string[];
  };
  metrics?: {
    accuracy: number;
    macro_precision: number;
    macro_recall: number;
    macro_f1: number;
    weighted_f1: number;
    roc_auc: number;
    per_class: Record<string, { precision: number; recall: number; f1: number; support: number }>;
    confusion_matrix: {
      labels: string[];
      matrix: number[][];
    };
    baseline_comparison: {
      logistic_regression_f1: number;
      linear_svm_f1: number;
    };
  };
}
