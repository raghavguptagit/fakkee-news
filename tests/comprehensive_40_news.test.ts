import test from 'node:test';
import assert from 'node:assert/strict';
import { predictArticle } from '../ml/inference/classifier';
import { analyzeLinguisticSignals } from '../server/services/linguistic';
import { computeCautiousAssessment, SimpleVerdict } from '../server/services/assessment';

interface TestCase {
  id: number;
  topic: string;
  text: string;
  expected: SimpleVerdict;
}

const TEST_CASES: TestCase[] = [
  // 20 Real News Cases (Expected: likely_true)
  { id: 1, topic: 'India & Govt', text: 'Union cabinet approves infrastructure development outlay for highway expansion projects across multiple states.', expected: 'likely_true' },
  { id: 2, topic: 'Technology', text: 'Apple announces new silicon processor benchmarks in an official press release published Tuesday morning.', expected: 'likely_true' },
  { id: 3, topic: 'Science', text: 'NASA James Webb Space Telescope discovers atmospheric components on a distant exoplanet in peer-reviewed study.', expected: 'likely_true' },
  { id: 4, topic: 'Education', text: 'University Grants Commission issues updated guidelines regarding higher education grading standards and curriculum.', expected: 'likely_true' },
  { id: 5, topic: 'Sports', text: 'International Cricket Council officially releases match schedule and venue details for the upcoming world tournament.', expected: 'likely_true' },
  { id: 6, topic: 'Health', text: 'World Health Organization publishes annual global health statistics report detailing life expectancy trends.', expected: 'likely_true' },
  { id: 7, topic: 'Business', text: 'Reserve Bank of India keeps repo rate unchanged at 6.5 percent in monetary policy committee statement.', expected: 'likely_true' },
  { id: 8, topic: 'International', text: 'United Nations climate summit opens in Geneva with delegates from 190 countries negotiating emission targets.', expected: 'likely_true' },
  { id: 9, topic: 'Environment', text: 'Meteorological department forecasts normal monsoon rainfall across central and southern regions this season.', expected: 'likely_true' },
  { id: 10, topic: 'General', text: 'National railway operator launches high-speed sleeper train service connecting major metropolitan corridors.', expected: 'likely_true' },
  { id: 11, topic: 'India & Govt', text: 'Supreme Court issues constitutional bench judgment clarifying employment reservation guidelines.', expected: 'likely_true' },
  { id: 12, topic: 'Technology', text: 'Semiconductor manufacturing plant inauguration ceremony held with state officials and industry leaders.', expected: 'likely_true' },
  { id: 13, topic: 'Science', text: 'ISRO successfully launches communication satellite into geostationary orbit using LVM3 launch vehicle.', expected: 'likely_true' },
  { id: 14, topic: 'Education', text: 'Ministry of Education reviews implementation progress of national education policy across participating states.', expected: 'likely_true' },
  { id: 15, topic: 'Sports', text: 'National Olympic association announces candidate host cities for upcoming international athletic games.', expected: 'likely_true' },
  { id: 16, topic: 'Health', text: 'Ministry of Health launches nationwide vaccination awareness campaign for immunization programs.', expected: 'likely_true' },
  { id: 17, topic: 'Business', text: 'Stock exchange indices hit record high following strong quarterly corporate earnings reports.', expected: 'likely_true' },
  { id: 18, topic: 'International', text: 'Bilateral trade agreement signed between allied economic partners to reduce tariffs on agricultural goods.', expected: 'likely_true' },
  { id: 19, topic: 'Environment', text: 'Renewable solar energy generation capacity crosses milestone target ahead of schedule.', expected: 'likely_true' },
  { id: 20, topic: 'General', text: 'National postal department issues commemorative postage stamp celebrating historical anniversary.', expected: 'likely_true' },

  // 10 Fake / Misleading Generated Cases (Expected: likely_fake)
  { id: 21, topic: 'Fake Scheme', text: 'भारत सरकार सभी नागरिकों को बिल्कुल मुफ्त लैपटॉप और 50,000 रुपये दे रही है। तुरंत लिंक पर क्लिक करें!', expected: 'likely_fake' },
  { id: 22, topic: 'Fake Grant', text: 'Ministry offers $10,000 monthly cash grant to every student who clicks this registration link immediately!', expected: 'likely_fake' },
  { id: 23, topic: 'Fake Health Cure', text: 'SHOCKING SECRET! Miracle kitchen spice completely cures chronic heart disease in 48 hours guaranteed!', expected: 'likely_fake' },
  { id: 24, topic: 'Fake Tech', text: 'Secret developer code unlocks unlimited 5G high-speed mobile data forever on any carrier without paying!', expected: 'likely_fake' },
  { id: 25, topic: 'Fake Celebrity', text: 'Famous movie star announces free cryptocurrency giveaway doubling all transferred funds instantly.', expected: 'likely_fake' },
  { id: 26, topic: 'Fake Sports', text: 'Massive match fixing scandal cancels international cricket tournament permanently starting today.', expected: 'likely_fake' },
  { id: 27, topic: 'Fake Finance', text: 'Central bank declares all existing currency notes completely invalid starting midnight tonight.', expected: 'likely_fake' },
  { id: 28, topic: 'Fake Disaster', text: 'DOOMSDAY ALERT! Giant asteroid impact predicted to destroy major city next Tuesday without warning!', expected: 'likely_fake' },
  { id: 29, topic: 'Fake Election', text: 'Anonymous insider reveals voting machines rigged nationwide in unprecedented electoral conspiracy.', expected: 'likely_fake' },
  { id: 30, topic: 'Fake Tax', text: 'Government abolishes all income tax for every citizen earning under 20 lakhs starting tomorrow.', expected: 'likely_fake' },

  // 10 Real News Rewritten Cases (Expected: likely_true)
  { id: 31, topic: 'Real Rewritten', text: 'Reserve Bank officials announced monetary policy decisions maintaining benchmark interest rates steady.', expected: 'likely_true' },
  { id: 32, topic: 'Real Rewritten', text: 'Space research agency successfully launched orbital satellite payload into designated space sector.', expected: 'likely_true' },
  { id: 33, topic: 'Real Rewritten', text: 'Astronomers using space telescope instruments published findings regarding exoplanet atmospheric compositions.', expected: 'likely_true' },
  { id: 34, topic: 'Real Rewritten', text: 'Apex court delivered judicial ruling regarding statutory interpretation and employment matters.', expected: 'likely_true' },
  { id: 35, topic: 'Real Rewritten', text: 'Federal budget allocation figures show increased expenditure directed toward national highway infrastructure.', expected: 'likely_true' },
  { id: 36, topic: 'Real Rewritten', text: 'Global health agency released statistical indicators monitoring public health and demographic trends.', expected: 'likely_true' },
  { id: 37, topic: 'Real Rewritten', text: 'Cricket governing body finalized tournament match fixtures and stadium locations for upcoming series.', expected: 'likely_true' },
  { id: 38, topic: 'Real Rewritten', text: 'Railway ministry inaugurated high-speed passenger train connection linking major commercial hubs.', expected: 'likely_true' },
  { id: 39, topic: 'Real Rewritten', text: 'Weather forecasting department issued seasonal monsoon outlook predicting standard rainfall levels.', expected: 'likely_true' },
  { id: 40, topic: 'Real Rewritten', text: 'Higher education commission issued updated regulatory framework for university academic standards.', expected: 'likely_true' },
];

test('Comprehensive 40-News Evaluation Report & Accuracy Test', () => {
  let correctCount = 0;
  let incorrectCount = 0;
  let truePositives = 0;
  let trueNegatives = 0;
  let falsePositives = 0;
  let falseNegatives = 0;
  let unverifiedCount = 0;

  console.log('\n--- TRUTHLENS AI 40-NEWS EVALUATION REPORT ---');
  console.log('| No. | Topic | Expected | Actual | Status |');
  console.log('|---|---|---|---|---|');

  for (const t of TEST_CASES) {
    const ml = predictArticle(t.text);
    const ling = analyzeLinguisticSignals(t.text);
    const outcome = computeCautiousAssessment(ml, ling, false, null, t.text.match(/[\u0900-\u097F]/) ? 'hi' : 'en');
    const actual = outcome.simple_verdict;

    const isMatch = actual === t.expected;
    if (isMatch) {
      correctCount++;
    } else {
      incorrectCount++;
    }

    if (actual === 'unverified') unverifiedCount++;

    if (t.expected === 'likely_fake') {
      if (actual === 'likely_fake') truePositives++;
      else falseNegatives++;
    } else if (t.expected === 'likely_true') {
      if (actual === 'likely_true') trueNegatives++;
      else falsePositives++;
    }

    console.log(`| ${t.id} | ${t.topic} | ${t.expected} | ${actual} | ${isMatch ? '✅ CORRECT' : '❌ WRONG'} |`);
  }

  const accuracy = (correctCount / TEST_CASES.length) * 100;
  const precision = truePositives + falsePositives > 0 ? truePositives / (truePositives + falsePositives) : 0;
  const recall = truePositives + falseNegatives > 0 ? truePositives / (truePositives + falseNegatives) : 0;
  const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;

  console.log('\n--- PERFORMANCE METRICS ---');
  console.log(`Total Test Cases: ${TEST_CASES.length}`);
  console.log(`Correct Predictions: ${correctCount}`);
  console.log(`Incorrect Predictions: ${incorrectCount}`);
  console.log(`Accuracy: ${accuracy.toFixed(1)}%`);
  console.log(`Unverified Cases: ${unverifiedCount}`);
  console.log(`Precision: ${precision.toFixed(3)}`);
  console.log(`Recall: ${recall.toFixed(3)}`);
  console.log(`F1 Score: ${f1.toFixed(3)}`);

  assert.ok(accuracy >= 85, `Expected accuracy >= 85%, got ${accuracy}%`);
});
