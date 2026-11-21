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

test('ML classifier skips English TF-IDF scoring on Hindi Devanagari text', () => {
  const hindi = predictArticle('चौंकाने वाला बड़ा खुलासा! सरकार सभी नागरिकों को मुफ्त लैपटॉप दे रही है। इसे तुरंत शेयर करें!');
  assert.equal(hindi.available, false);
  assert.equal(hindi.score, null);
});

test('Linguistic analyzer detects Hindi viral/sensational patterns and language', () => {
  const hindiLing = analyzeLinguisticSignals('चौंकाने वाला बड़ा खुलासा! अंदरूनी सूत्रों के मुताबिक यह 100% सच है, डिलीट होने से पहले तुरंत शेयर करें!');
  assert.equal(hindiLing.detected_language, 'hi');
  assert.ok(hindiLing.sensationalism_indicators.length >= 1);
  assert.ok(hindiLing.attribution_quality.length >= 1);
});

test('Cautious assessment produces simple 3-category verdicts in English and Hindi without evidence', () => {
  const ling = analyzeLinguisticSignals('चौंकाने वाला बड़ा खुलासा! अंदरूनी सूत्रों के मुताबिक यह 100% सच है, डिलीट होने से पहले तुरंत शेयर करें!');
  const ml = predictArticle('चौंकाने वाला बड़ा खुलासा!');
  const out = computeCautiousAssessment(ml, ling, false, null, 'hi');
  assert.equal(out.simple_verdict, 'likely_fake');
  assert.ok(out.simple_result_title.includes('भ्रामक') || out.simple_result_title.includes('झूठी'));
  assert.ok(out.simple_why.includes('लाइव'));

  // Hindi free-laptop phishing forward must flag as likely_fake
  const hindiScamText =
    'ब्रेकिंग न्यूज़! सरकार सभी छात्रों को फ्री लैपटॉप दे रही है, अभी नीचे दिए लिंक पर क्लिक करके फॉर्म भरें और यह मैसेज 10 ग्रुप में तुरंत फॉरवर्ड करें वरना मौका हाथ से निकल जाएगा!';
  const hindiScamOut = computeCautiousAssessment(
    predictArticle(hindiScamText),
    analyzeLinguisticSignals(hindiScamText),
    false,
    null,
    'hi'
  );
  assert.equal(hindiScamOut.simple_verdict, 'likely_fake');

  // Credible multi-detail English news predicts likely_true while clearly noting live verification was unavailable
  const credibleText =
    'City council members voted 7 to 4 on Wednesday to approve a $42 million municipal bond for transit infrastructure repairs. According to the city budget office, the funding will prioritize bridge inspections and bus rapid transit lanes along three high-volume corridors beginning in the second quarter.';
  const credibleOut = computeCautiousAssessment(
    predictArticle(credibleText),
    analyzeLinguisticSignals(credibleText),
    false,
    null,
    'en'
  );
  assert.equal(credibleOut.simple_verdict, 'likely_true');
  assert.ok(credibleOut.simple_why.toLowerCase().includes('live web'));

  // Calm unverified medical hoax stays unverified (never marked likely_true)
  const calmHoax =
    'Scientists at a European institute reported Tuesday that drinking hot salt water cures dengue fever within 24 hours without medical care, according to an internal circular.';
  const calmHoaxOut = computeCautiousAssessment(
    predictArticle(calmHoax),
    analyzeLinguisticSignals(calmHoax),
    false,
    null,
    'en'
  );
  assert.notEqual(calmHoaxOut.simple_verdict, 'likely_true');
});

test('Evidence provider selects tavily when EVIDENCE_API_KEY is set, rejects legacy google_cse, and degrades cleanly when missing/disabled', async () => {
  const { getActiveEvidenceProvider, retrieveEvidenceForQuery } = await import('../server/services/evidenceService');
  const origKey = process.env.EVIDENCE_API_KEY;
  const origTavily = process.env.TAVILY_API_KEY;
  const origEnabled = process.env.EVIDENCE_SEARCH_ENABLED;
  const origProv = process.env.EVIDENCE_PROVIDER;
  const origFetch = globalThis.fetch;

  try {
    delete process.env.TAVILY_API_KEY;
    process.env.EVIDENCE_SEARCH_ENABLED = 'true';
    process.env.EVIDENCE_PROVIDER = 'auto';
    process.env.EVIDENCE_API_KEY = 'tvly-test-api-key-12345';
    assert.equal(getActiveEvidenceProvider(), 'tavily');

    // Legacy google_cse setting must never activate Google Custom Search
    process.env.EVIDENCE_PROVIDER = 'google_cse';
    assert.equal(getActiveEvidenceProvider(), 'none');

    // Verify Tavily request/response mapping & trusted-domain ranking
    process.env.EVIDENCE_PROVIDER = 'tavily';
    let capturedAuth = '';
    globalThis.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
      const headers = init?.headers as Record<string, string> | undefined;
      capturedAuth = headers?.Authorization || '';
      return new Response(
        JSON.stringify({
          results: [
            {
              url: 'https://randomblog.example/post',
              title: 'Blog Commentary',
              content: 'Opinion blog post about claim.',
              score: 0.9,
            },
            {
              url: 'https://www.reuters.com/world/sample-report',
              title: 'Reuters Fact Check',
              content: 'Official verification details from Reuters.',
              published_date: '2026-10-01T12:00:00Z',
              score: 0.85,
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }) as typeof fetch;

    const result = await retrieveEvidenceForQuery('municipal transit bond audit');
    assert.equal(capturedAuth, 'Bearer tvly-test-api-key-12345');
    assert.equal(result.status, 'completed');
    assert.equal(result.items.length, 2);
    assert.equal(result.items[0].provider, 'tavily');
    assert.equal(result.items[0].publisher, 'reuters.com');
    assert.equal(result.items[0].published_at, '2026-10-01T12:00:00Z');

    // Missing API key + disabled search degrades cleanly without throwing
    delete process.env.EVIDENCE_API_KEY;
    process.env.EVIDENCE_SEARCH_ENABLED = 'false';
    assert.equal(getActiveEvidenceProvider(), 'none');
    const unavailable = await retrieveEvidenceForQuery('any claim');
    assert.equal(unavailable.status, 'unavailable');
    assert.equal(unavailable.items.length, 0);
  } finally {
    globalThis.fetch = origFetch;
    if (origKey === undefined) delete process.env.EVIDENCE_API_KEY;
    else process.env.EVIDENCE_API_KEY = origKey;
    if (origTavily === undefined) delete process.env.TAVILY_API_KEY;
    else process.env.TAVILY_API_KEY = origTavily;
    if (origEnabled === undefined) delete process.env.EVIDENCE_SEARCH_ENABLED;
    else process.env.EVIDENCE_SEARCH_ENABLED = origEnabled;
    if (origProv === undefined) delete process.env.EVIDENCE_PROVIDER;
    else process.env.EVIDENCE_PROVIDER = origProv;
  }
});

test('Evidence stance analysis detects fact-check debunks on short/calm fake news and authoritative corroboration on real news', async () => {
  const { buildVerificationQueries, assessEvidenceRecords } = await import('../server/services/evidenceService');

  const queries = buildVerificationQueries('SHOCKING SECRET! NASA confirms Earth will go completely dark for 6 days in December!');
  assert.equal(queries.length, 2);
  assert.ok(!queries[0].toLowerCase().includes('shocking'));
  assert.ok(queries[1].endsWith('fact check'));

  const calmFakeClaim = 'NASA confirms Earth will go completely dark for 6 days in December';
  const debunkStance = assessEvidenceRecords(calmFakeClaim, [
    {
      source_url: 'https://www.snopes.com/fact-check/six-days-darkness/',
      source_title: '6 Days of Darkness in December? | Snopes.com',
      publisher: 'snopes.com',
      published_at: null,
      retrieved_at: new Date().toISOString(),
      snippet: 'False claim: NASA did not confirm that Earth will experience 6 days of darkness. This viral hoax circulates every year.',
      relation: 'context',
      provider: 'tavily',
      relevance_score: 0.95,
      dedupe_hash: 'h1',
    },
  ]);
  assert.equal(debunkStance.contradictingCount, 1);
  assert.equal(debunkStance.authoritativeDebunk, true);
  assert.equal(debunkStance.items[0].relation, 'contradicts');

  const fakeVerdict = computeCautiousAssessment(
    predictArticle(calmFakeClaim),
    analyzeLinguisticSignals(calmFakeClaim),
    true,
    null,
    'en',
    debunkStance
  );
  assert.equal(fakeVerdict.simple_verdict, 'likely_fake');

  const shortTrueClaim = 'NASA James Webb telescope detects carbon dioxide on exoplanet K2-18 b';
  const supportStance = assessEvidenceRecords(shortTrueClaim, [
    {
      source_url: 'https://www.nasa.gov/universe/webb-discovers-methane-carbon-dioxide-in-atmosphere-of-k2-18-b/',
      source_title: 'Webb Discovers Methane, Carbon Dioxide in Atmosphere of K2-18 b - NASA',
      publisher: 'nasa.gov',
      published_at: null,
      retrieved_at: new Date().toISOString(),
      snippet: 'An investigation with NASA James Webb Space Telescope into exoplanet K2-18 b revealed carbon dioxide and methane.',
      relation: 'context',
      provider: 'tavily',
      relevance_score: 0.96,
      dedupe_hash: 'h2',
    },
    {
      source_url: 'https://www.bbc.com/news/science-environment-66786611',
      source_title: 'Tantalising sign of possible life on faraway world - BBC News',
      publisher: 'bbc.com',
      published_at: null,
      retrieved_at: new Date().toISOString(),
      snippet: 'NASA James Webb Space Telescope detected carbon dioxide and methane in the atmosphere of exoplanet K2-18 b.',
      relation: 'context',
      provider: 'tavily',
      relevance_score: 0.92,
      dedupe_hash: 'h3',
    },
  ]);
  assert.equal(supportStance.supportingCount, 2);
  assert.equal(supportStance.authoritativeSupport, true);

  const trueVerdict = computeCautiousAssessment(
    predictArticle(shortTrueClaim),
    analyzeLinguisticSignals(shortTrueClaim),
    true,
    null,
    'en',
    supportStance
  );
  assert.equal(trueVerdict.simple_verdict, 'likely_true');
});
