import fs from 'fs';
import path from 'path';
import { tokenize, TrainedModelArtifact } from '../scripts/train';

export interface MlFeatureContribution {
  term: string;
  weight: number;
  contribution: number;
  direction: 'toward_misleading' | 'toward_credible';
}

export interface MlPredictionResult {
  available: boolean;
  model_name: string | null;
  version: string | null;
  predicted_class: string | null;
  score: number | null;
  score_type: 'uncalibrated_model_score';
  confidence_label: 'high' | 'moderate' | 'low' | 'unavailable';
  explanation: MlFeatureContribution[];
  limitations_note: string;
  metrics_reference: string | null;
}

let cachedArtifact: TrainedModelArtifact | null = null;

export function getArtifactPath(): string {
  return process.env.ML_MODEL_PATH || path.resolve(process.cwd(), 'ml/artifacts/model_v1.json');
}

export function loadModelArtifact(): TrainedModelArtifact | null {
  if (cachedArtifact) return cachedArtifact;
  const p = getArtifactPath();
  if (!fs.existsSync(p)) return null;
  try {
    const raw = fs.readFileSync(p, 'utf-8');
    cachedArtifact = JSON.parse(raw) as TrainedModelArtifact;
    return cachedArtifact;
  } catch {
    return null;
  }
}

export function clearModelCache(): void {
  cachedArtifact = null;
}

export function predictArticle(text: string): MlPredictionResult {
  if (process.env.ML_ENABLED === 'false') {
    return {
      available: false,
      model_name: null,
      version: null,
      predicted_class: null,
      score: null,
      score_type: 'uncalibrated_model_score',
      confidence_label: 'unavailable',
      explanation: [],
      limitations_note: 'ML classifier is disabled via ML_ENABLED=false.',
      metrics_reference: null,
    };
  }

  const artifact = loadModelArtifact();
  if (!artifact) {
    return {
      available: false,
      model_name: null,
      version: null,
      predicted_class: null,
      score: null,
      score_type: 'uncalibrated_model_score',
      confidence_label: 'unavailable',
      explanation: [],
      limitations_note: 'Trained model artifact not found. Run `npm run train:ml` to train and save ml/artifacts/model_v1.json.',
      metrics_reference: null,
    };
  }

  const devanagariChars = (text.match(/[\u0900-\u097F]/g) || []).length;
  const latinChars = (text.match(/[a-zA-Z]/g) || []).length;
  if (devanagariChars > latinChars) {
    return {
      available: false,
      model_name: artifact.model_name,
      version: artifact.version,
      predicted_class: null,
      score: null,
      score_type: 'uncalibrated_model_score',
      confidence_label: 'unavailable',
      explanation: [],
      limitations_note:
        'The local TF-IDF classifier is trained on English articles only. Hindi and non-English news is analyzed using multilingual AI and linguistic cues instead.',
      metrics_reference: '/models',
    };
  }

  const tokens = tokenize(text);
  const tf = new Map<number, number>();
  const idxToTerm = new Map<number, string>();

  for (const tok of tokens) {
    const idx = artifact.vocabulary[tok];
    if (idx !== undefined) {
      tf.set(idx, (tf.get(idx) || 0) + 1);
      idxToTerm.set(idx, tok);
    }
  }

  if (tf.size === 0) {
    return {
      available: false,
      model_name: artifact.model_name,
      version: artifact.version,
      predicted_class: null,
      score: null,
      score_type: 'uncalibrated_model_score',
      confidence_label: 'unavailable',
      explanation: [],
      limitations_note: 'Not enough recognizable English vocabulary for local pattern scoring.',
      metrics_reference: '/models',
    };
  }

  let normSq = 0;
  const vec = new Map<number, number>();
  for (const [idx, count] of tf.entries()) {
    const val = (1 + Math.log(count)) * artifact.idf[idx];
    vec.set(idx, val);
    normSq += val * val;
  }
  const norm = Math.sqrt(normSq) || 1;

  let z = artifact.bias;
  const contributions: MlFeatureContribution[] = [];

  for (const [idx, rawVal] of vec.entries()) {
    const normVal = rawVal / norm;
    const w = artifact.weights[idx];
    const contrib = w * normVal;
    z += contrib;
    contributions.push({
      term: idxToTerm.get(idx) || '',
      weight: Number(w.toFixed(4)),
      contribution: Number(contrib.toFixed(4)),
      direction: contrib >= 0 ? 'toward_misleading' : 'toward_credible',
    });
  }

  const probMisleading = 1 / (1 + Math.exp(-Math.max(-20, Math.min(20, z))));
  const predictedClass = probMisleading >= 0.5 ? 'misleading_or_sensational' : 'credible_reporting';
  const classScore = predictedClass === 'misleading_or_sensational' ? probMisleading : 1 - probMisleading;

  const distance = Math.abs(probMisleading - 0.5);
  let confidenceLabel: 'high' | 'moderate' | 'low' = 'low';
  if (tokens.length < 15 || vec.size < 3) {
    confidenceLabel = 'low';
  } else if (distance >= 0.3) {
    confidenceLabel = 'high';
  } else if (distance >= 0.15) {
    confidenceLabel = 'moderate';
  }

  const topExplanation = contributions
    .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution))
    .slice(0, 8);

  return {
    available: true,
    model_name: artifact.model_name,
    version: artifact.version,
    predicted_class: predictedClass,
    score: Number(classScore.toFixed(4)),
    score_type: 'uncalibrated_model_score',
    confidence_label: confidenceLabel,
    explanation: topExplanation,
    limitations_note:
      'Model score reflects lexical similarity to labeled training patterns, NOT objective factual truth. Always corroborate claims against primary sources.',
    metrics_reference: '/models',
  };
}
