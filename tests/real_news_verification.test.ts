import test from 'node:test';
import assert from 'node:assert/strict';
import { predictArticle } from '../ml/inference/classifier';
import { analyzeLinguisticSignals } from '../server/services/linguistic';
import { computeCautiousAssessment } from '../server/services/assessment';
import { assessEvidenceRecords } from '../server/services/evidenceService';

test('Real-World Test Case 1: Credible Scientific Breakthrough (JWST Digital Twin)', () => {
  const text =
    'Researchers developed a new computational technique using a digital simulation of the James Webb Space Telescope to model tiny optical shifts and remove the intense glare of host stars, published in Nature.';
  const ml = predictArticle(text);
  const ling = analyzeLinguisticSignals(text);
  const outcome = computeCautiousAssessment(ml, ling, false);

  assert.equal(ml.predicted_class, 'credible_reporting');
  assert.equal(ling.detected_language, 'en');
  assert.equal(outcome.simple_verdict, 'likely_true');
  assert.ok(outcome.simple_result_title.toLowerCase().includes('true'));
});

test('Real-World Test Case 2: Viral Space Hoax (Nibiru / Planet X Doom)', () => {
  const text =
    'SHOCKING DISCOVERY! NASA confirms that the legendary doomsday planet Nibiru / Planet X is hiding at the outer edge of our solar system and heading toward Earth! Share this immediately before they delete it!';
  const ml = predictArticle(text);
  const ling = analyzeLinguisticSignals(text);
  const outcome = computeCautiousAssessment(ml, ling, false);

  assert.equal(ml.predicted_class, 'misleading_or_sensational');
  assert.ok(ling.sensationalism_indicators.length >= 1);
  assert.equal(outcome.simple_verdict, 'likely_fake');
  assert.ok(outcome.simple_result_title.toLowerCase().includes('fake') || outcome.simple_result_title.toLowerCase().includes('misleading'));
});

test('Real-World Test Case 3: User Exact Free-Laptop Claim (Hindi Government Scheme)', () => {
  const text =
    'भारत सरकार ने घोषणा की है कि 1 दिसंबर से देश में सभी निजी और सरकारी कॉलेजों में छात्रों को मुफ्त लैपटॉप दिए जाएंगे। प्रत्येक छात्र को ₹50,000 की आर्थिक सहायता भी मिलेगी। सरकार ने इस योजना के लिए ₹10,000 करोड़ का बजट मंजूर कर दिया है। आवेदन कल से ऑनलाइन शुरू होंगे।';
  const ling = analyzeLinguisticSignals(text);
  const ml = predictArticle(text);
  const outcome = computeCautiousAssessment(ml, ling, false, null, 'hi');

  assert.equal(ling.detected_language, 'hi');
  // Without reliable official evidence confirming this massive financial scheme, it should be unverified or appropriately flagged
  assert.ok(['likely_fake', 'unverified'].includes(outcome.simple_verdict));
});

test('Evidence Relevance Filter excludes unrelated sources (e.g. general Wikipedia or homepages)', () => {
  const claim = 'India government free laptop scheme 50000 rupees';
  const unrelatedEvidence = [
    {
      source_url: 'https://en.wikipedia.org/wiki/Main_Page',
      source_title: 'Main Page - Wikipedia',
      publisher: 'en.wikipedia.org',
      published_at: null,
      retrieved_at: new Date().toISOString(),
      snippet: 'Welcome to Wikipedia, the free encyclopedia that anyone can edit.',
      relation: 'context' as const,
      provider: 'tavily',
      relevance_score: 0.1,
      dedupe_hash: 'w1',
    },
    {
      source_url: 'https://www.indiabudget.gov.in/',
      source_title: 'Union Budget India',
      publisher: 'indiabudget.gov.in',
      published_at: null,
      retrieved_at: new Date().toISOString(),
      snippet: 'Official union budget financial statements and economic reports.',
      relation: 'context' as const,
      provider: 'tavily',
      relevance_score: 0.2,
      dedupe_hash: 'b1',
    },
  ];

  const assessed = assessEvidenceRecords(claim, unrelatedEvidence);
  // Both sources are completely unrelated to laptops/50000 rupees, so relevance filter must discard them
  assert.equal(assessed.items.length, 0);
});

test('Real-World Test Case 4: Short Ambiguous Headline (Unverified)', () => {
  const text = 'Central bank rate adjustment.';
  const ml = predictArticle(text);
  const ling = analyzeLinguisticSignals(text);
  const outcome = computeCautiousAssessment(ml, ling, false);

  assert.equal(ling.is_short_input, true);
  assert.equal(outcome.simple_verdict, 'unverified');
  assert.ok(outcome.simple_result_title.toLowerCase().includes('could not verify') || outcome.simple_result_title.toLowerCase().includes('unverified'));
});
