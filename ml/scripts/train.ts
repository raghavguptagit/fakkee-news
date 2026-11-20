import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { buildBenchmarkDataset, LabeledSample } from '../data/dataset_generator';

export interface TrainedModelArtifact {
  model_name: string;
  version: string;
  trained_at: string;
  artifact_hash: string;
  classes: ['credible_reporting', 'misleading_or_sensational'];
  vocabulary: Record<string, number>;
  idf: number[];
  weights: number[];
  bias: number;
  hyperparameters: {
    ngram_range: [number, number];
    min_df: number;
    max_features: number;
    learning_rate: number;
    epochs: number;
    l2_lambda: number;
  };
  dataset_metadata: {
    name: string;
    license: string;
    total_samples: number;
    train_samples: number;
    test_samples: number;
    class_distribution: Record<string, number>;
    split_strategy: string;
    limitations: string[];
  };
  metrics: {
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

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'as', 'is', 'was',
  'are', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'it', 'its', 'that', 'this', 'these',
  'those', 'they', 'their', 'them', 'he', 'she', 'we', 'our', 'his', 'her', 'which', 'who', 'whom', 'what', 'when',
]);

export function tokenize(text: string): string[] {
  const cleaned = text
    .toLowerCase()
    .replace(/<[^>]*>/g, ' ')
    .replace(/[^a-z0-9!?%\s'-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const words = cleaned.split(' ').filter((w) => w.length > 1 && !STOP_WORDS.has(w));
  const tokens: string[] = [...words];
  for (let i = 0; i < words.length - 1; i++) {
    tokens.push(`${words[i]} ${words[i + 1]}`);
  }
  return tokens;
}

function vectorize(tokens: string[], vocab: Record<string, number>, idf: number[]): Map<number, number> {
  const tf = new Map<number, number>();
  for (const tok of tokens) {
    const idx = vocab[tok];
    if (idx !== undefined) {
      tf.set(idx, (tf.get(idx) || 0) + 1);
    }
  }
  let normSq = 0;
  const vec = new Map<number, number>();
  for (const [idx, count] of tf.entries()) {
    const val = (1 + Math.log(count)) * idf[idx];
    vec.set(idx, val);
    normSq += val * val;
  }
  const norm = Math.sqrt(normSq) || 1;
  for (const [idx, val] of vec.entries()) {
    vec.set(idx, val / norm);
  }
  return vec;
}

function sigmoid(z: number): number {
  if (z > 20) return 1;
  if (z < -20) return 0;
  return 1 / (1 + Math.exp(-z));
}

function deterministicShuffle<T>(arr: T[], seed = 42): T[] {
  const copy = [...arr];
  let s = seed;
  for (let i = copy.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) % 4294967296;
    const j = s % (i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function computeRocAuc(yTrue: number[], yScores: number[]): number {
  const pairs = yTrue.map((y, i) => ({ y, s: yScores[i] })).sort((a, b) => b.s - a.s);
  const pos = yTrue.filter((y) => y === 1).length;
  const neg = yTrue.length - pos;
  if (pos === 0 || neg === 0) return 0.5;
  let tp = 0;
  let fp = 0;
  let prevTp = 0;
  let prevFp = 0;
  let auc = 0;
  for (const p of pairs) {
    if (p.y === 1) tp++;
    else fp++;
    auc += ((fp - prevFp) / neg) * ((tp + prevTp) / (2 * pos));
    prevTp = tp;
    prevFp = fp;
  }
  return Number(auc.toFixed(4));
}

function evaluatePredictions(yTrue: number[], yPred: number[], yScores: number[]) {
  let tp = 0, tn = 0, fp = 0, fn = 0;
  for (let i = 0; i < yTrue.length; i++) {
    if (yTrue[i] === 1 && yPred[i] === 1) tp++;
    else if (yTrue[i] === 0 && yPred[i] === 0) tn++;
    else if (yTrue[i] === 0 && yPred[i] === 1) fp++;
    else fn++;
  }
  const accuracy = (tp + tn) / yTrue.length;
  const p1 = tp + fp > 0 ? tp / (tp + fp) : 0;
  const r1 = tp + fn > 0 ? tp / (tp + fn) : 0;
  const f1_1 = p1 + r1 > 0 ? (2 * p1 * r1) / (p1 + r1) : 0;

  const p0 = tn + fn > 0 ? tn / (tn + fn) : 0;
  const r0 = tn + fp > 0 ? tn / (tn + fp) : 0;
  const f1_0 = p0 + r0 > 0 ? (2 * p0 * r0) / (p0 + r0) : 0;

  const support0 = tn + fp;
  const support1 = tp + fn;
  const macroPrecision = (p0 + p1) / 2;
  const macroRecall = (r0 + r1) / 2;
  const macroF1 = (f1_0 + f1_1) / 2;
  const weightedF1 = (f1_0 * support0 + f1_1 * support1) / yTrue.length;

  return {
    accuracy: Number(accuracy.toFixed(4)),
    macro_precision: Number(macroPrecision.toFixed(4)),
    macro_recall: Number(macroRecall.toFixed(4)),
    macro_f1: Number(macroF1.toFixed(4)),
    weighted_f1: Number(weightedF1.toFixed(4)),
    roc_auc: computeRocAuc(yTrue, yScores),
    per_class: {
      credible_reporting: {
        precision: Number(p0.toFixed(4)),
        recall: Number(r0.toFixed(4)),
        f1: Number(f1_0.toFixed(4)),
        support: support0,
      },
      misleading_or_sensational: {
        precision: Number(p1.toFixed(4)),
        recall: Number(r1.toFixed(4)),
        f1: Number(f1_1.toFixed(4)),
        support: support1,
      },
    },
    confusion_matrix: {
      labels: ['credible_reporting', 'misleading_or_sensational'],
      matrix: [
        [tn, fp],
        [fn, tp],
      ],
    },
  };
}

export function trainAndSaveModel(outputPath?: string): TrainedModelArtifact {
  const samples: LabeledSample[] = buildBenchmarkDataset();
  const credible = deterministicShuffle(samples.filter((s) => s.label === 'credible_reporting'), 42);
  const misleading = deterministicShuffle(samples.filter((s) => s.label === 'misleading_or_sensational'), 42);

  const splitIdx0 = Math.floor(credible.length * 0.8);
  const splitIdx1 = Math.floor(misleading.length * 0.8);

  const trainSamples = deterministicShuffle([...credible.slice(0, splitIdx0), ...misleading.slice(0, splitIdx1)], 99);
  const testSamples = [...credible.slice(splitIdx0), ...misleading.slice(splitIdx1)];

  // Fit vocabulary strictly on trainSamples (no data leakage)
  const df = new Map<string, number>();
  const trainTokenized = trainSamples.map((s) => tokenize(s.text));
  for (const tokens of trainTokenized) {
    const unique = new Set(tokens);
    for (const tok of unique) {
      df.set(tok, (df.get(tok) || 0) + 1);
    }
  }

  const minDf = 2;
  const maxFeatures = 2500;
  const sortedTerms = Array.from(df.entries())
    .filter(([, count]) => count >= minDf)
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxFeatures);

  const vocabulary: Record<string, number> = {};
  const idf: number[] = [];
  const N = trainSamples.length;
  sortedTerms.forEach(([term, count], idx) => {
    vocabulary[term] = idx;
    idf.push(Math.log((N + 1) / (count + 1)) + 1);
  });

  const XTrain = trainTokenized.map((toks) => vectorize(toks, vocabulary, idf));
  const yTrain = trainSamples.map((s) => (s.label === 'misleading_or_sensational' ? 1 : 0));

  const XTest = testSamples.map((s) => vectorize(tokenize(s.text), vocabulary, idf));
  const yTest = testSamples.map((s) => (s.label === 'misleading_or_sensational' ? 1 : 0));

  // Model 1: TF-IDF + L2-regularized Logistic Regression
  const numFeatures = idf.length;
  const weights = new Array(numFeatures).fill(0);
  let bias = 0;
  const lr = 0.45;
  const epochs = 40;
  const l2 = 0.001;

  for (let epoch = 0; epoch < epochs; epoch++) {
    for (let i = 0; i < XTrain.length; i++) {
      let z = bias;
      for (const [idx, val] of XTrain[i].entries()) {
        z += weights[idx] * val;
      }
      const pred = sigmoid(z);
      const err = pred - yTrain[i];
      bias -= lr * err;
      for (const [idx, val] of XTrain[i].entries()) {
        weights[idx] -= lr * (err * val + l2 * weights[idx]);
      }
    }
  }

  const lrScores = XTest.map((vec) => {
    let z = bias;
    for (const [idx, val] of vec.entries()) z += weights[idx] * val;
    return sigmoid(z);
  });
  const lrPreds = lrScores.map((s) => (s >= 0.5 ? 1 : 0));
  const lrMetrics = evaluatePredictions(yTest, lrPreds, lrScores);

  // Model 2: TF-IDF + Linear SVM (hinge loss) for baseline comparison
  const svmWeights = new Array(numFeatures).fill(0);
  let svmBias = 0;
  for (let epoch = 0; epoch < 30; epoch++) {
    for (let i = 0; i < XTrain.length; i++) {
      const ySigned = yTrain[i] === 1 ? 1 : -1;
      let margin = svmBias;
      for (const [idx, val] of XTrain[i].entries()) margin += svmWeights[idx] * val;
      if (ySigned * margin < 1) {
        svmBias += 0.1 * ySigned;
        for (const [idx, val] of XTrain[i].entries()) {
          svmWeights[idx] += 0.1 * (ySigned * val - 0.002 * svmWeights[idx]);
        }
      }
    }
  }
  const svmScores = XTest.map((vec) => {
    let z = svmBias;
    for (const [idx, val] of vec.entries()) z += svmWeights[idx] * val;
    return sigmoid(z);
  });
  const svmPreds = svmScores.map((s) => (s >= 0.5 ? 1 : 0));
  const svmMetrics = evaluatePredictions(yTest, svmPreds, svmScores);

  const artifactBody = {
    model_name: 'tfidf_logistic_regression',
    version: 'v1.0.0',
    trained_at: new Date().toISOString(),
    classes: ['credible_reporting', 'misleading_or_sensational'] as ['credible_reporting', 'misleading_or_sensational'],
    vocabulary,
    idf: idf.map((v) => Number(v.toFixed(6))),
    weights: weights.map((w) => Number(w.toFixed(6))),
    bias: Number(bias.toFixed(6)),
    hyperparameters: {
      ngram_range: [1, 2] as [number, number],
      min_df: minDf,
      max_features: maxFeatures,
      learning_rate: lr,
      epochs,
      l2_lambda: l2,
    },
    dataset_metadata: {
      name: 'TruthLens Reproducible News Credibility Benchmark Corpus (v1)',
      license: 'CC0-1.0 (Synthetic journalistic vs sensationalist benchmark; supports drop-in LIAR/FakeNewsNet CSVs)',
      total_samples: samples.length,
      train_samples: trainSamples.length,
      test_samples: testSamples.length,
      class_distribution: {
        credible_reporting: credible.length,
        misleading_or_sensational: misleading.length,
      },
      split_strategy: 'Stratified 80/20 train/test split with vocabulary fit strictly on training fold',
      limitations: [
        'Trained on English news-style linguistic patterns; does not verify real-world factual truth.',
        'Headline-only inputs have limited lexical signal and lower reliability.',
        'Satire, opinion columns, and domain-specific technical writing may trigger false positives.',
      ],
    },
    metrics: {
      ...lrMetrics,
      baseline_comparison: {
        logistic_regression_f1: lrMetrics.macro_f1,
        linear_svm_f1: svmMetrics.macro_f1,
      },
    },
  };

  const hash = crypto.createHash('sha256').update(JSON.stringify(artifactBody)).digest('hex');
  const artifact: TrainedModelArtifact = {
    ...artifactBody,
    artifact_hash: hash,
  };

  const target = outputPath || path.resolve(process.cwd(), 'ml/artifacts/model_v1.json');
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, JSON.stringify(artifact, null, 2), 'utf-8');

  return artifact;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const artifact = trainAndSaveModel();
  console.log(`Trained ${artifact.model_name} ${artifact.version}`);
  console.log(`Accuracy: ${artifact.metrics.accuracy}, Macro F1: ${artifact.metrics.macro_f1}, ROC-AUC: ${artifact.metrics.roc_auc}`);
  console.log(`Artifact hash: ${artifact.artifact_hash.slice(0, 16)}...`);
}
