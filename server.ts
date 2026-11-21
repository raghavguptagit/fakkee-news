import 'dotenv/config';
import dotenv from 'dotenv';
import fs from 'fs';
import express, { NextFunction, Request, Response } from 'express';
import crypto from 'crypto';
import path from 'path';
import multer from 'multer';
import mammoth from 'mammoth';
import { z } from 'zod';
import { createServer as createViteServer } from 'vite';

// Ensure user-configured .env values override blank or disabled default placeholders
const localEnvPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(localEnvPath)) {
  const parsedEnv = dotenv.parse(fs.readFileSync(localEnvPath));
  for (const [k, v] of Object.entries(parsedEnv)) {
    if (v && (!process.env[k] || process.env[k]!.trim() === '' || k.startsWith('EVIDENCE_') || k === 'TAVILY_API_KEY')) {
      process.env[k] = v;
    }
  }
}

import { getDb, DEFAULT_DB_PATH } from './server/db';
import {
  hashPassword,
  verifyPassword,
  signToken,
  setAuthCookie,
  clearAuthCookie,
  requireAuth,
  rateLimit,
  AuthenticatedRequest,
} from './server/auth';
import { loadModelArtifact, predictArticle } from './ml/inference/classifier';
import { analyzeLinguisticSignals } from './server/services/linguistic';
import { extractArticleFromUrl } from './server/services/urlExtractor';
import {
  isGeminiConfigured,
  extractVerificationQueries,
  runGeminiArticleAnalysis,
  streamGeminiFollowup,
} from './server/services/geminiService';
import {
  isEvidenceProviderConfigured,
  getActiveEvidenceProvider,
  retrieveEvidenceForQuery,
  deduplicateEvidence,
  buildVerificationQueries,
  assessEvidenceRecords,
  EvidenceRecord,
} from './server/services/evidenceService';
import { computeCautiousAssessment, extractFallbackClaims, DEMO_ARTICLES } from './server/services/assessment';

const app = express();
app.set('trust proxy', 1);
app.use(express.json({ limit: '2mb' }));

// CORS allowlist middleware
const allowedOrigins = new Set(
  [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    process.env.APP_URL,
    process.env.FRONTEND_URL,
  ].filter(Boolean)
);
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && allowedOrigins.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  next();
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: (Number(process.env.UPLOAD_MAX_MB) || 10) * 1024 * 1024 },
});

const MAX_TEXT_CHARS = Number(process.env.MAX_TEXT_CHARS) || 30000;

function sendError(res: Response, status: number, code: string, message: string, details: Record<string, unknown> = {}) {
  res.status(status).json({
    error: {
      code,
      message,
      details,
      request_id: crypto.randomUUID(),
    },
  });
}

// Ensure default DB and register active ML model version on startup
const db = getDb();
const activeArtifact = loadModelArtifact();
if (activeArtifact) {
  db.prepare(
    `INSERT OR IGNORE INTO model_versions (id, model_name, version, dataset_metadata, metrics, artifact_location, artifact_hash, trained_at, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`
  ).run(
    crypto.randomUUID(),
    activeArtifact.model_name,
    activeArtifact.version,
    JSON.stringify(activeArtifact.dataset_metadata),
    JSON.stringify(activeArtifact.metrics),
    'ml/artifacts/model_v1.json',
    activeArtifact.artifact_hash,
    activeArtifact.trained_at
  );
}

// ==================== HEALTH & SYSTEM ====================
app.get('/api/v1/health', (_req, res) => {
  res.json({ status: 'ok', service: 'TruthLens AI', timestamp: new Date().toISOString() });
});

app.get('/api/v1/ready', (_req, res) => {
  try {
    db.prepare('SELECT 1').get();
    res.json({ status: 'ready', database: 'sqlite', path: 'backend/data/truthlens.db' });
  } catch {
    sendError(res, 503, 'DB_UNAVAILABLE', 'Database service is currently unavailable.');
  }
});

app.get('/api/v1/system/status', (_req, res) => {
  const artifact = loadModelArtifact();
  res.json({
    database: { engine: 'sqlite', status: 'connected', path: path.relative(process.cwd(), DEFAULT_DB_PATH) },
    ml_model: {
      available: Boolean(artifact),
      model_name: artifact?.model_name || null,
      version: artifact?.version || null,
      trained_at: artifact?.trained_at || null,
    },
    gemini: {
      configured: isGeminiConfigured(),
      model: process.env.GEMINI_MODEL || 'gemini-4-hydrogen',
    },
    evidence_search: {
      configured: isEvidenceProviderConfigured(),
      provider: getActiveEvidenceProvider(),
    },
  });
});

app.get('/api/v1/demo-articles', (_req, res) => {
  res.json({ items: DEMO_ARTICLES });
});

// ==================== AUTH ====================
const RegisterSchema = z.object({
  email: z.string().email().max(180),
  password: z.string().min(8).max(128),
  display_name: z.string().min(2).max(80),
});

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

app.post('/api/v1/auth/register', rateLimit(20, 60_000), (req, res) => {
  const parsed = RegisterSchema.safeParse(req.body);
  if (!parsed.success) {
    sendError(res, 400, 'INVALID_INPUT', 'Please provide a valid email, display name (2+ characters), and password (8+ characters).');
    return;
  }

  const email = parsed.data.email.toLowerCase().trim();
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) {
    sendError(res, 409, 'EMAIL_EXISTS', 'An account with this email already exists.');
    return;
  }

  const id = crypto.randomUUID();
  const hashed = hashPassword(parsed.data.password);
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO users (id, email, hashed_password, display_name, role, is_active, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'user', 1, ?, ?)`
  ).run(id, email, hashed, parsed.data.display_name.trim(), now, now);

  db.prepare(`INSERT INTO audit_events (id, user_id, action, metadata, created_at) VALUES (?, ?, 'user_registered', '{}', ?)`).run(
    crypto.randomUUID(),
    id,
    now
  );

  const user = { id, email, display_name: parsed.data.display_name.trim(), role: 'user' as const };
  const token = signToken(user);
  setAuthCookie(req, res, token);
  res.status(201).json({ user, token });
});

app.post('/api/v1/auth/login', rateLimit(25, 60_000), (req, res) => {
  const parsed = LoginSchema.safeParse(req.body);
  if (!parsed.success) {
    sendError(res, 400, 'INVALID_INPUT', 'Please provide a valid email and password.');
    return;
  }

  const email = parsed.data.email.toLowerCase().trim();
  const row = db
    .prepare('SELECT id, email, hashed_password, display_name, role, is_active FROM users WHERE email = ?')
    .get(email) as { id: string; email: string; hashed_password: string; display_name: string; role: 'user' | 'admin'; is_active: number } | undefined;

  if (!row || !row.is_active || !verifyPassword(parsed.data.password, row.hashed_password)) {
    sendError(res, 401, 'INVALID_CREDENTIALS', 'Invalid email or password.');
    return;
  }

  const user = { id: row.id, email: row.email, display_name: row.display_name, role: row.role };
  const token = signToken(user);
  setAuthCookie(req, res, token);
  res.json({ user, token });
});

app.post('/api/v1/auth/logout', requireAuth, (req: AuthenticatedRequest, res) => {
  db.prepare(`INSERT INTO audit_events (id, user_id, action, metadata, created_at) VALUES (?, ?, 'user_logout', '{}', ?)`).run(
    crypto.randomUUID(),
    req.user!.id,
    new Date().toISOString()
  );
  clearAuthCookie(req, res);
  res.json({ ok: true });
});

app.get('/api/v1/auth/me', requireAuth, (req: AuthenticatedRequest, res) => {
  res.json({ user: req.user });
});

app.delete('/api/v1/auth/account', requireAuth, (req: AuthenticatedRequest, res) => {
  db.prepare('DELETE FROM users WHERE id = ?').run(req.user!.id);
  clearAuthCookie(req, res);
  res.json({ ok: true, message: 'Account and all associated analyses permanently deleted.' });
});

// ==================== URL & FILE EXTRACTION ====================
async function handleExtractUrl(req: Request, res: Response) {
  const url = typeof req.body?.url === 'string' ? req.body.url.trim() : '';
  if (!url) {
    sendError(res, 400, 'INVALID_INPUT', 'Please enter a valid http:// or https:// URL.');
    return;
  }
  try {
    const extracted = await extractArticleFromUrl(url);
    res.json(extracted);
  } catch (err) {
    sendError(res, 422, 'URL_EXTRACTION_FAILED', err instanceof Error ? err.message : 'Could not read that webpage. Please paste the article text directly.');
  }
}

async function handleExtractFile(req: Request, res: Response) {
  const file = req.file;
  if (!file) {
    sendError(res, 400, 'INVALID_FILE', 'No file uploaded.');
    return;
  }
  const ext = path.extname(file.originalname).toLowerCase();
  try {
    let text = '';
    if (ext === '.txt') {
      text = file.buffer.toString('utf-8');
    } else if (ext === '.docx') {
      const result = await mammoth.extractRawText({ buffer: file.buffer });
      text = result.value || '';
    } else if (ext === '.pdf') {
      const pdfParseModule = await import('pdf-parse');
      const pdfParse =
        (pdfParseModule as unknown as { default?: (buf: Buffer) => Promise<{ text: string }> }).default ||
        (pdfParseModule as unknown as (buf: Buffer) => Promise<{ text: string }>);
      const parsed = await pdfParse(file.buffer);
      text = parsed.text || '';
    } else {
      sendError(res, 400, 'UNSUPPORTED_FORMAT', 'Only .txt, .pdf, and .docx files are supported.');
      return;
    }

    const cleaned = text.replace(/\s+/g, ' ').trim().slice(0, MAX_TEXT_CHARS);
    if (cleaned.length < 20) {
      sendError(res, 422, 'EMPTY_DOCUMENT', 'Could not read enough text from that file. Please paste the news text directly.');
      return;
    }

    res.json({
      filename: path.basename(file.originalname),
      text: cleaned,
      char_count: cleaned.length,
    });
  } catch {
    sendError(res, 422, 'FILE_EXTRACTION_FAILED', 'Could not read that file. Please try another file or paste the text directly.');
  }
}

app.post('/api/v1/extract-url', requireAuth, rateLimit(20, 60_000), handleExtractUrl);
app.post('/api/v1/extract-file', requireAuth, rateLimit(20, 60_000), upload.single('file'), handleExtractFile);
app.post('/api/v1/public/extract-url', rateLimit(15, 60_000), handleExtractUrl);
app.post('/api/v1/public/extract-file', rateLimit(15, 60_000), upload.single('file'), handleExtractFile);

// ==================== SHARED ANALYSIS PIPELINE ====================
const CreateAnalysisSchema = z.object({
  input_type: z.enum(['text', 'url', 'file', 'headline', 'demo']).default('text'),
  title: z.string().max(300).optional().nullable(),
  url: z.string().max(2048).optional().nullable(),
  text: z
    .string()
    .trim()
    .min(10, 'Please enter at least 10 characters of news text or a headline.')
    .max(MAX_TEXT_CHARS, `Input is too long (maximum ${MAX_TEXT_CHARS.toLocaleString()} characters).`)
    .refine((val) => /[\p{L}\p{N}]/u.test(val), 'Please enter readable text or a headline to check.'),
  is_demo: z.boolean().optional().default(false),
  output_language: z.enum(['en', 'hi']).optional(),
});

async function runAnalysisPipeline(input: z.infer<typeof CreateAnalysisSchema>) {
  const startedAt = Date.now();
  const analysisId = crypto.randomUUID();
  const { input_type, title, url, text, is_demo } = input;

  // 1. Local ML Pattern Classifier & Linguistic Signals
  const ml = predictArticle(text);
  const linguistic = analyzeLinguisticSignals(text, title);
  const outputLanguage: 'en' | 'hi' = input.output_language || linguistic.detected_language;

  // 2. Optional Live Source Verification (Google CSE / Tavily / Gemini Search Grounding)
  const evidenceConfigured = isEvidenceProviderConfigured();
  let evidenceStatus: 'completed' | 'unavailable' | 'error' = evidenceConfigured ? 'completed' : 'unavailable';
  let evidenceNote = evidenceConfigured
    ? 'Live source verification ready.'
    : 'Live web source verification is unavailable. Result is based on AI and pattern analysis only.';
  let retrievedEvidence: EvidenceRecord[] = [];

  if (evidenceConfigured) {
    let queries = isGeminiConfigured() ? await extractVerificationQueries(text) : [];
    if (queries.length === 0) {
      queries = buildVerificationQueries(text);
    } else if (queries.length === 1 && !/\bfact[\s-]?check\b/i.test(queries[0])) {
      queries.push(`${queries[0]} fact check`.slice(0, 120));
    }

    if (queries.length > 0) {
      const lookups = await Promise.all(queries.slice(0, 2).map((q) => retrieveEvidenceForQuery(q)));
      const allItems = lookups.flatMap((l) => l.items);
      retrievedEvidence = deduplicateEvidence(allItems).slice(0, 5);
      if (lookups.some((l) => l.status === 'completed') && retrievedEvidence.length > 0) {
        evidenceStatus = 'completed';
        evidenceNote = lookups.find((l) => l.items.length > 0)?.note || 'Consulted live web sources.';
      } else if (lookups.some((l) => l.status === 'error')) {
        evidenceStatus = 'error';
        evidenceNote = 'Live web source verification could not be completed right now.';
      } else {
        evidenceStatus = 'unavailable';
        evidenceNote = 'No matching external sources were found for this claim.';
      }
    } else {
      evidenceStatus = 'unavailable';
      evidenceNote = 'Could not form a search query for external source lookup.';
    }
  }

  const evidenceStance = assessEvidenceRecords(text, retrievedEvidence);
  const stanceWeight = (rel: EvidenceRecord['relation']) =>
    rel === 'contradicts' ? 2 : rel === 'supports' ? 1 : 0;
  retrievedEvidence = [...evidenceStance.items].sort(
    (a, b) => stanceWeight(b.relation) - stanceWeight(a.relation)
  );

  // 3. Gemini Contextual & Evidence-Grounded Analysis
  const mlSummaryStr = ml.available
    ? `writing-style pattern aligns with ${ml.predicted_class === 'misleading_or_sensational' ? 'sensational/misleading' : 'standard reporting'} style`
    : 'local English style check not applicable';
  const lingFlagsStr = [
    linguistic.sensationalism_indicators.length > 0 ? 'dramatic/urgent phrasing detected' : '',
    linguistic.attribution_quality.length > 0 ? 'unnamed/vague attribution detected' : '',
    linguistic.certainty_language.length > 0 ? 'absolute certainty phrasing detected' : '',
    linguistic.is_short_input ? 'short or headline-only input' : '',
  ]
    .filter(Boolean)
    .join(', ') || 'neutral phrasing';

  const geminiResult = await runGeminiArticleAnalysis(text, {
    mlSummary: mlSummaryStr,
    linguisticFlagsSummary: lingFlagsStr,
    retrievedEvidence,
    evidenceStatus,
    outputLanguage,
  });

  // 4. Cautious Verdict Aggregation
  const hasRealEvidence = evidenceStatus === 'completed' && retrievedEvidence.length > 0;
  const assessment = computeCautiousAssessment(
    ml,
    linguistic,
    hasRealEvidence,
    geminiResult.data,
    outputLanguage,
    evidenceStance
  );

  const rawClaims =
    geminiResult.status === 'completed' && geminiResult.data && geminiResult.data.claims.length > 0
      ? geminiResult.data.claims
      : extractFallbackClaims(text);

  const structuredClaims = rawClaims.map((c, idx) => {
    const claimId = crypto.randomUUID();
    const ev = idx === 0 ? retrievedEvidence.slice(0, 3) : [];
    const fallbackStatus =
      idx === 0 && evidenceStance.contradictingCount > 0
        ? 'contradicted'
        : idx === 0 && evidenceStance.supportingCount > 0
          ? 'supported'
          : c.claim_status;
    const status =
      c.checkability !== 'checkable'
        ? 'not_checkable'
        : !hasRealEvidence
          ? 'retrieval_unavailable'
          : geminiResult.status === 'completed'
            ? c.claim_status
            : fallbackStatus;
    return {
      id: claimId,
      text: c.text,
      type: c.type,
      checkability: c.checkability,
      status,
      search_query: c.search_query,
      explanation: c.caveat,
      evidence: ev,
    };
  });

  const summary = geminiResult.data?.summary || assessment.simple_why;
  const topic = geminiResult.data?.topic || 'General News';
  const framingNotes =
    geminiResult.data?.framing_observations && geminiResult.data.framing_observations.length > 0
      ? geminiResult.data.framing_observations
      : linguistic.framing_notes;

  const nextSteps =
    geminiResult.data?.next_steps && geminiResult.data.next_steps.length > 0
      ? geminiResult.data.next_steps
      : [
          'Check official government or institutional websites if the message mentions an official announcement.',
          'Search for the main claim on at least two well-known, trusted news outlets.',
          'Avoid forwarding alarming claims until you confirm when and where the event actually happened.',
        ];

  const createdAt = new Date().toISOString();
  const processingMs = Date.now() - startedAt;

  return {
    analysisId,
    createdAt,
    processingMs,
    ml,
    linguistic,
    geminiResult,
    evidenceStatus,
    evidenceNote,
    retrievedEvidence,
    assessment,
    summary,
    structuredClaims,
    reportPayload: {
      analysis_id: analysisId,
      status: geminiResult.status === 'error' ? 'partial' : 'completed',
      is_demo: Boolean(is_demo || input_type === 'demo'),
      input: {
        type: input_type,
        title: title || text.slice(0, 80).trim() + (text.length > 80 ? '...' : ''),
        url: url || null,
        language: outputLanguage,
        detected_language: linguistic.detected_language,
        word_count: linguistic.word_count,
        is_short_input: linguistic.is_short_input,
      },
      topic,
      assessment,
      ml,
      summary,
      sources_consulted: retrievedEvidence,
      evidence_note: evidenceNote,
      claims: structuredClaims,
      linguistic_analysis: {
        sensationalism_indicators: linguistic.sensationalism_indicators,
        loaded_language: linguistic.loaded_language,
        certainty_language: linguistic.certainty_language,
        attribution_quality: linguistic.attribution_quality,
        framing_notes: framingNotes,
      },
      transparency_checks: linguistic.transparency_checks,
      next_steps: nextSteps,
      providers: {
        gemini: geminiResult.status,
        gemini_error: geminiResult.error || null,
        evidence_search: evidenceStatus,
      },
      provenance: {
        created_at: createdAt,
        processing_ms: processingMs,
        model_version: ml.version || 'unavailable',
        analysis_pipeline_version: '1.1.0',
      },
    },
  };
}

// Public Check News endpoint (no sign-in required; rate-limited; does not persist private history)
app.post('/api/v1/public/analyze', rateLimit(20, 60_000), async (req, res) => {
  const parsed = CreateAnalysisSchema.safeParse(req.body);
  if (!parsed.success) {
    sendError(res, 400, 'INVALID_INPUT', parsed.error.issues[0]?.message || 'Please enter valid news text or a headline.');
    return;
  }

  try {
    const result = await runAnalysisPipeline(parsed.data);
    res.status(200).json(result.reportPayload);
  } catch {
    sendError(res, 500, 'ANALYSIS_FAILED', 'Sorry, we could not check this news right now. Please try again.');
  }
});

// ==================== ANALYSES (AUTHENTICATED & PERSISTED) ====================
app.post('/api/v1/analyses', requireAuth, rateLimit(30, 60_000), async (req: AuthenticatedRequest, res) => {
  const parsed = CreateAnalysisSchema.safeParse(req.body);
  if (!parsed.success) {
    sendError(res, 400, 'INVALID_INPUT', parsed.error.issues[0]?.message || 'Please enter valid news text or a headline.');
    return;
  }

  try {
    const userId = req.user!.id;
    const contentHash = crypto.createHash('sha256').update(parsed.data.text.trim()).digest('hex');
    const result = await runAnalysisPipeline(parsed.data);
    const { analysisId, createdAt, processingMs, ml, geminiResult, evidenceStatus, assessment, summary, structuredClaims, reportPayload } =
      result;

    const insertTx = db.transaction(() => {
      db.prepare(
        `INSERT INTO analyses (
          id, user_id, input_type, original_url, title, input_text, content_hash, language, status,
          assessment_label, model_score, model_confidence_label, model_version, gemini_status,
          evidence_status, summary, report_json, processing_ms, created_at, completed_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        analysisId,
        userId,
        parsed.data.input_type,
        parsed.data.url || null,
        reportPayload.input.title,
        parsed.data.text,
        contentHash,
        reportPayload.input.language,
        reportPayload.status,
        assessment.label,
        ml.score,
        ml.confidence_label,
        ml.version,
        geminiResult.status,
        evidenceStatus,
        summary,
        JSON.stringify(reportPayload),
        processingMs,
        createdAt,
        createdAt
      );

      const insertClaim = db.prepare(
        `INSERT INTO claims (id, analysis_id, claim_text, claim_type, checkability, status, explanation, search_query, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      );
      const insertEv = db.prepare(
        `INSERT INTO evidence_items (id, claim_id, analysis_id, source_url, source_title, publisher, published_at, retrieved_at, snippet, relation, provider, relevance_score, dedupe_hash)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      );

      for (const c of structuredClaims) {
        insertClaim.run(c.id, analysisId, c.text, c.type, c.checkability, c.status, c.explanation, c.search_query, createdAt);
        for (const e of c.evidence) {
          insertEv.run(
            crypto.randomUUID(),
            c.id,
            analysisId,
            e.source_url,
            e.source_title,
            e.publisher,
            e.published_at,
            e.retrieved_at,
            e.snippet,
            e.relation,
            e.provider,
            e.relevance_score,
            e.dedupe_hash
          );
        }
      }
    });

    insertTx();
    res.status(201).json(reportPayload);
  } catch {
    sendError(res, 500, 'ANALYSIS_FAILED', 'Sorry, we could not check this news right now. Please try again.');
  }
});

app.get('/api/v1/analyses', requireAuth, (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
  const label = typeof req.query.label === 'string' ? req.query.label.trim() : '';
  const savedOnly = req.query.saved === 'true';

  let sql = `
    SELECT a.id, a.input_type, a.original_url, a.title, a.status, a.assessment_label,
           a.model_score, a.model_confidence_label, a.model_version, a.gemini_status,
           a.evidence_status, a.summary, a.processing_ms, a.created_at,
           CASE WHEN s.id IS NOT NULL THEN 1 ELSE 0 END AS is_saved
    FROM analyses a
    LEFT JOIN saved_analyses s ON s.analysis_id = a.id AND s.user_id = a.user_id
    WHERE a.user_id = ?
  `;
  const params: unknown[] = [userId];

  if (savedOnly) {
    sql += ' AND s.id IS NOT NULL';
  }
  if (label && label !== 'ALL') {
    sql += ' AND a.assessment_label = ?';
    params.push(label);
  }
  if (search) {
    sql += ' AND (a.title LIKE ? OR a.summary LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }

  sql += ' ORDER BY a.created_at DESC LIMIT 100';
  const rows = db.prepare(sql).all(...params);
  res.json({ items: rows });
});

app.get('/api/v1/analyses/:id', requireAuth, (req: AuthenticatedRequest, res) => {
  const row = db
    .prepare(
      `SELECT a.report_json, CASE WHEN s.id IS NOT NULL THEN 1 ELSE 0 END AS is_saved
       FROM analyses a
       LEFT JOIN saved_analyses s ON s.analysis_id = a.id AND s.user_id = a.user_id
       WHERE a.id = ? AND a.user_id = ?`
    )
    .get(req.params.id, req.user!.id) as { report_json: string; is_saved: number } | undefined;

  if (!row) {
    sendError(res, 404, 'NOT_FOUND', 'Analysis report not found.');
    return;
  }

  const report = JSON.parse(row.report_json);
  res.json({ ...report, is_saved: Boolean(row.is_saved) });
});

app.delete('/api/v1/analyses/:id', requireAuth, (req: AuthenticatedRequest, res) => {
  const result = db.prepare('DELETE FROM analyses WHERE id = ? AND user_id = ?').run(req.params.id, req.user!.id);
  if (result.changes === 0) {
    sendError(res, 404, 'NOT_FOUND', 'Analysis report not found.');
    return;
  }
  res.json({ ok: true });
});

app.post('/api/v1/analyses/:id/save', requireAuth, (req: AuthenticatedRequest, res) => {
  const exists = db.prepare('SELECT id FROM analyses WHERE id = ? AND user_id = ?').get(req.params.id, req.user!.id);
  if (!exists) {
    sendError(res, 404, 'NOT_FOUND', 'Analysis report not found.');
    return;
  }
  db.prepare(`INSERT OR IGNORE INTO saved_analyses (id, user_id, analysis_id, created_at) VALUES (?, ?, ?, ?)`).run(
    crypto.randomUUID(),
    req.user!.id,
    req.params.id,
    new Date().toISOString()
  );
  res.json({ ok: true, is_saved: true });
});

app.delete('/api/v1/analyses/:id/save', requireAuth, (req: AuthenticatedRequest, res) => {
  db.prepare('DELETE FROM saved_analyses WHERE analysis_id = ? AND user_id = ?').run(req.params.id, req.user!.id);
  res.json({ ok: true, is_saved: false });
});

app.post('/api/v1/analyses/:id/feedback', requireAuth, (req: AuthenticatedRequest, res) => {
  const exists = db.prepare('SELECT id FROM analyses WHERE id = ? AND user_id = ?').get(req.params.id, req.user!.id);
  if (!exists) {
    sendError(res, 404, 'NOT_FOUND', 'Analysis report not found.');
    return;
  }
  const category = typeof req.body?.category === 'string' ? req.body.category.slice(0, 64) : 'general';
  const feedbackText = typeof req.body?.feedback_text === 'string' ? req.body.feedback_text.slice(0, 1000) : '';
  db.prepare(
    `INSERT INTO feedback (id, user_id, analysis_id, category, feedback_text, created_at) VALUES (?, ?, ?, ?, ?, ?)`
  ).run(crypto.randomUUID(), req.user!.id, req.params.id, category, feedbackText, new Date().toISOString());
  res.status(201).json({ ok: true });
});

app.post('/api/v1/analyses/:id/chat/stream', requireAuth, rateLimit(20, 60_000), async (req: AuthenticatedRequest, res) => {
  const row = db
    .prepare('SELECT report_json FROM analyses WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.user!.id) as { report_json: string } | undefined;

  if (!row) {
    sendError(res, 404, 'NOT_FOUND', 'Analysis report not found.');
    return;
  }

  const question = typeof req.body?.question === 'string' ? req.body.question.trim().slice(0, 1000) : '';
  const history = Array.isArray(req.body?.history)
    ? req.body.history
        .filter((m: unknown): m is { role: 'user' | 'assistant'; text: string } => {
          return (
            typeof m === 'object' &&
            m !== null &&
            ((m as { role?: unknown }).role === 'user' || (m as { role?: unknown }).role === 'assistant') &&
            typeof (m as { text?: unknown }).text === 'string'
          );
        })
        .map((m: { role: 'user' | 'assistant'; text: string }) => ({ role: m.role, text: m.text.slice(0, 1000) }))
    : [];

  if (!question) {
    sendError(res, 400, 'INVALID_INPUT', 'Please enter a follow-up question.');
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    for await (const chunk of streamGeminiFollowup(row.report_json, question, history)) {
      res.write(`data: ${JSON.stringify({ text: chunk })}\n\n`);
    }
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
  } catch {
    res.write(`data: ${JSON.stringify({ error: 'Sorry, the assistant could not reply right now.' })}\n\n`);
  } finally {
    res.end();
  }
});

// ==================== DASHBOARD & COMPARE ====================
app.get('/api/v1/dashboard', requireAuth, (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const totalRow = db
    .prepare('SELECT COUNT(*) as total, COALESCE(AVG(processing_ms), 0) as avg_ms FROM analyses WHERE user_id = ?')
    .get(userId) as { total: number; avg_ms: number };

  const savedRow = db
    .prepare('SELECT COUNT(*) as saved FROM saved_analyses WHERE user_id = ?')
    .get(userId) as { saved: number };

  const distRows = db
    .prepare('SELECT assessment_label as label, COUNT(*) as count FROM analyses WHERE user_id = ? GROUP BY assessment_label')
    .all(userId) as Array<{ label: string; count: number }>;

  const recentRows = db
    .prepare(
      `SELECT a.id, a.title, a.input_type, a.assessment_label, a.model_score, a.created_at,
              CASE WHEN s.id IS NOT NULL THEN 1 ELSE 0 END AS is_saved
       FROM analyses a
       LEFT JOIN saved_analyses s ON s.analysis_id = a.id AND s.user_id = a.user_id
       WHERE a.user_id = ?
       ORDER BY a.created_at DESC LIMIT 6`
    )
    .all(userId);

  res.json({
    kpis: {
      total_analyses: totalRow.total,
      saved_reports: savedRow.saved,
      avg_processing_ms: Math.round(totalRow.avg_ms),
    },
    distribution: distRows,
    recent: recentRows,
  });
});

app.post('/api/v1/compare', requireAuth, (req: AuthenticatedRequest, res) => {
  const ids = Array.isArray(req.body?.analysis_ids) ? req.body.analysis_ids.filter((x: unknown) => typeof x === 'string') : [];
  if (ids.length < 2 || ids.length > 4) {
    sendError(res, 400, 'INVALID_INPUT', 'Select between 2 and 4 analyses to compare.');
    return;
  }

  const placeholders = ids.map(() => '?').join(',');
  const rows = db
    .prepare(`SELECT report_json FROM analyses WHERE user_id = ? AND id IN (${placeholders})`)
    .all(req.user!.id, ...ids) as Array<{ report_json: string }>;

  if (rows.length < 2) {
    sendError(res, 404, 'NOT_FOUND', 'At least 2 owned analyses are required for comparison.');
    return;
  }

  const reports = rows.map((r) => JSON.parse(r.report_json));
  res.json({
    items: reports,
    note: 'Side-by-side comparison highlights differences in claims, tone, and sources consulted.',
  });
});

// ==================== MODEL TRANSPARENCY ====================
app.get('/api/v1/models/active', (_req, res) => {
  const artifact = loadModelArtifact();
  if (!artifact) {
    res.json({ available: false, setup_command: 'npm run train:ml' });
    return;
  }
  res.json({
    available: true,
    model_name: artifact.model_name,
    version: artifact.version,
    trained_at: artifact.trained_at,
    artifact_hash: artifact.artifact_hash,
    classes: artifact.classes,
    hyperparameters: artifact.hyperparameters,
    dataset_metadata: artifact.dataset_metadata,
    metrics: artifact.metrics,
    vocabulary_size: Object.keys(artifact.vocabulary).length,
  });
});

// ==================== SETTINGS ====================
app.get('/api/v1/settings/export', requireAuth, (req: AuthenticatedRequest, res) => {
  const analyses = db.prepare('SELECT id, title, input_type, assessment_label, summary, created_at FROM analyses WHERE user_id = ?').all(req.user!.id);
  res.json({
    exported_at: new Date().toISOString(),
    user: req.user,
    analyses,
  });
});

app.delete('/api/v1/settings/history', requireAuth, (req: AuthenticatedRequest, res) => {
  db.prepare('DELETE FROM analyses WHERE user_id = ?').run(req.user!.id);
  res.json({ ok: true, message: 'All analysis history deleted.' });
});

// Friendly API error middleware (Multer & unexpected exceptions)
app.use('/api', (err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err && typeof err === 'object' && 'code' in err && (err as { code?: string }).code === 'LIMIT_FILE_SIZE') {
    sendError(res, 413, 'FILE_TOO_LARGE', 'The uploaded file is too large (maximum 10 MB).');
    return;
  }
  sendError(res, 500, 'SERVER_ERROR', 'Sorry, we could not check this news right now. Please try again.');
});

// ==================== START SERVER ====================
async function startServer() {
  const PORT = Number(process.env.PORT) || 3000;
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(process.cwd(), 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(process.cwd(), 'dist/index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`TruthLens AI server running on http://localhost:${PORT}`);
  });
}

if (process.env.NODE_ENV !== 'test') {
  startServer();
}

export { app };
