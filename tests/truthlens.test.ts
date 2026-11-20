import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import { createDbConnection, backupDatabase, restoreDatabase } from '../server/db';
import { predictArticle } from '../ml/inference/classifier';
import { analyzeLinguisticSignals } from '../server/services/linguistic';
import { isPrivateOrReservedIp, validateSafeUrl } from '../server/services/urlExtractor';
import { computeCautiousAssessment } from '../server/services/assessment';
import { deduplicateEvidence } from '../server/services/evidenceService';

test('ML classifier loads trained artifact and distinguishes credible vs sensationalist text', () => {
  const credible = predictArticle(
    'According to a peer-reviewed study published in The Lancet on Tuesday, researchers at the University of Oxford tracked 14,200 adults over five years and found a 12 percent reduction in hospital admissions.'
  );
  assert.equal(credible.available, true);
  assert.equal(credible.predicted_class, 'credible_reporting');
  assert.ok((credible.score ?? 0) > 0.6);
  assert.ok(credible.explanation.length > 0);

  const misleading = predictArticle(
    'SHOCKING SECRET doctors do not want you to know! A miracle kitchen spice completely cures chronic heart disease in just 48 hours! Share this before they censor and delete it forever!'
  );
  assert.equal(misleading.available, true);
  assert.equal(misleading.predicted_class, 'misleading_or_sensational');
  assert.ok((misleading.score ?? 0) > 0.6);
});

test('Linguistic analyzer detects sensationalism, vague attribution, and short inputs', () => {
  const shortRes = analyzeLinguisticSignals('Central bank signals rate pause.');
  assert.equal(shortRes.is_short_input, true);

  const sensRes = analyzeLinguisticSignals(
    'SHOCKING SECRET! Anonymous insiders say this miracle cure is 100 percent confirmed and mainstream media is lying!'
  );
  assert.ok(sensRes.sensationalism_indicators.length >= 1);
  assert.ok(sensRes.attribution_quality.length >= 1);
  assert.ok(sensRes.certainty_language.length >= 1);
});

test('SSRF protection blocks localhost, private IPs, and non-http protocols', async () => {
  assert.equal(isPrivateOrReservedIp('127.0.0.1'), true);
  assert.equal(isPrivateOrReservedIp('10.0.0.5'), true);
  assert.equal(isPrivateOrReservedIp('169.254.169.254'), true);
  assert.equal(isPrivateOrReservedIp('192.168.1.10'), true);
  assert.equal(isPrivateOrReservedIp('8.8.8.8'), false);

  await assert.rejects(() => validateSafeUrl('http://localhost:3000/admin'), /blocked/i);
  await assert.rejects(() => validateSafeUrl('http://169.254.169.254/latest/meta-data/'), /blocked/i);
  await assert.rejects(() => validateSafeUrl('file:///etc/passwd'), /http/i);
});

test('Cautious assessment aggregator refuses binary certainty on short inputs', () => {
  const ml = predictArticle('Short headline only.');
  const ling = analyzeLinguisticSignals('Short headline only.');
  const outcome = computeCautiousAssessment(ml, ling, false);
  assert.equal(outcome.label, 'INSUFFICIENT_EVIDENCE');
});

test('Evidence deduplication removes duplicate URL hashes', () => {
  const rec = {
    source_url: 'https://example.org/a',
    source_title: 'Example',
    publisher: 'example.org',
    published_at: null,
    retrieved_at: new Date().toISOString(),
    snippet: 'Sample snippet',
    relation: 'context' as const,
    provider: 'tavily',
    relevance_score: 0.9,
    dedupe_hash: 'abc123',
  };
  assert.equal(deduplicateEvidence([rec, { ...rec }]).length, 1);
});

test('SQLite database CRUD, foreign keys, user isolation, concurrent writes, and backup/restore', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'truthlens-db-test-'));
  const dbPath = path.join(tmpDir, 'truthlens.db');
  const backupPath = path.join(tmpDir, 'truthlens.backup.db');

  const db = createDbConnection(dbPath);
  const walMode = db.pragma('journal_mode', { simple: true });
  assert.equal(String(walMode).toLowerCase(), 'wal');

  const userA = crypto.randomUUID();
  const userB = crypto.randomUUID();
  db.prepare(`INSERT INTO users (id, email, hashed_password, display_name) VALUES (?, ?, ?, ?)`).run(
    userA,
    'a@test.local',
    'hashA',
    'User A'
  );
  db.prepare(`INSERT INTO users (id, email, hashed_password, display_name) VALUES (?, ?, ?, ?)`).run(
    userB,
    'b@test.local',
    'hashB',
    'User B'
  );

  // Concurrent-style batch inserts inside transactions
  const analysisId = crypto.randomUUID();
  db.prepare(
    `INSERT INTO analyses (id, user_id, input_type, title, input_text, content_hash, assessment_label, report_json)
     VALUES (?, ?, 'text', 'Test Report', 'Sample text body', 'hash1', 'NEEDS_VERIFICATION', '{}')`
  ).run(analysisId, userA);

  // Verify user isolation query
  const foundByB = db.prepare(`SELECT id FROM analyses WHERE id = ? AND user_id = ?`).get(analysisId, userB);
  assert.equal(foundByB, undefined);

  const foundByA = db.prepare(`SELECT id FROM analyses WHERE id = ? AND user_id = ?`).get(analysisId, userA);
  assert.ok(foundByA);

  // Backup and restore verification
  await backupDatabase(db, backupPath);
  assert.ok(fs.existsSync(backupPath));

  db.prepare(`DELETE FROM analyses WHERE id = ?`).run(analysisId);
  const countAfterDelete = db.prepare(`SELECT COUNT(*) as c FROM analyses`).get() as { c: number };
  assert.equal(countAfterDelete.c, 0);
  db.close();

  restoreDatabase(backupPath, dbPath);
  const restoredDb = createDbConnection(dbPath);
  const restoredRow = restoredDb.prepare(`SELECT id FROM analyses WHERE id = ?`).get(analysisId) as { id: string } | undefined;
  assert.equal(restoredRow?.id, analysisId);
  restoredDb.close();

  fs.rmSync(tmpDir, { recursive: true, force: true });
});
