import test from 'node:test';
import assert from 'node:assert/strict';
import { predictArticle } from '../ml/inference/classifier';
import { analyzeLinguisticSignals } from '../server/services/linguistic';
import { computeCautiousAssessment } from '../server/services/assessment';

interface TestCase {
  id: number;
  category: string;
  news: string;
  expected: 'likely_true' | 'likely_fake' | 'unverified';
}

const FORTY_TEST_CASES: TestCase[] = [
  // Real News (1-20)
  { id: 1, category: 'Science', news: 'Researchers developed a new computational technique using a digital simulation of the James Webb Space Telescope to model tiny optical shifts and remove the intense glare of host stars, published in Nature.', expected: 'likely_true' },
  { id: 2, category: 'Science', news: 'NASA James Webb Space Telescope detected carbon dioxide and methane in the atmosphere of exoplanet K2-18 b, prompting further study by astronomers.', expected: 'likely_true' },
  { id: 3, category: 'Business', news: 'Reserve Bank of India kept the repo rate unchanged at 6.5 percent in its bi-monthly monetary policy committee review meeting.', expected: 'likely_true' },
  { id: 4, category: 'Technology', news: 'Indian Space Research Organisation successfully launched a specialized weather observation satellite into sun-synchronous orbit using its workhorse rocket.', expected: 'likely_true' },
  { id: 5, category: 'Health', news: 'World Health Organization issued updated global health guidance regarding seasonal influenza vaccination and public health preparedness.', expected: 'likely_true' },
  { id: 6, category: 'Government', news: 'Supreme Court of India issued detailed procedural guidelines regarding digital data privacy and intermediary compliance standards.', expected: 'likely_true' },
  { id: 7, category: 'Technology', news: 'Apple announced a new generation of M-series processor architecture featuring an upgraded neural engine for on-device machine learning tasks.', expected: 'likely_true' },
  { id: 8, category: 'Sports', news: 'International Cricket Council confirmed the official dates and match venue for the upcoming World Test Championship final series.', expected: 'likely_true' },
  { id: 9, category: 'Environment', news: 'European Space Agency satellite mission published comprehensive global atmospheric carbon dioxide and methane concentration maps.', expected: 'likely_true' },
  { id: 10, category: 'Government', news: 'Union Cabinet approved funding allocation for the expansion of national highway economic corridors across multiple states.', expected: 'likely_true' },
  { id: 11, category: 'General', news: 'Central bank officials signal possible policy rate adjustment next month pending inflation report data.', expected: 'unverified' },
  { id: 12, category: 'Health', news: 'A new peer-reviewed study published in a medical journal analyzed sleep duration and circadian rhythms among rotating shift workers.', expected: 'likely_true' },
  { id: 13, category: 'Business', news: 'Major technology enterprise reported quarterly financial earnings exceeding consensus Wall Street revenue and profit estimates.', expected: 'likely_true' },
  { id: 14, category: 'Environment', news: 'Municipal corporation launched an urban tree plantation drive across metropolitan zones to curb particulate air pollution.', expected: 'likely_true' },
  { id: 15, category: 'Environment', news: 'Meteorological department forecasted normal monsoon rainfall distribution across coastal and central agricultural regions.', expected: 'likely_true' },
  { id: 16, category: 'Science', news: 'University research team developed a biodegradable packaging material extracted from marine seaweed biomass.', expected: 'likely_true' },
  { id: 17, category: 'Business', news: 'Automobile manufacturers reported steady monthly sales growth figures driven by demand in the electric vehicle segment.', expected: 'likely_true' },
  { id: 18, category: 'Government', news: 'Information ministry updated procedural guidelines for digital media press accreditation and official government briefings.', expected: 'likely_true' },
  { id: 19, category: 'Business', news: 'Stock market benchmark indices closed higher following positive industrial manufacturing and employment sector data releases.', expected: 'likely_true' },
  { id: 20, category: 'Science', news: 'Aerospace agency scheduled a robotic cargo resupply spacecraft launch to the International Space Station for the upcoming weekend.', expected: 'likely_true' },

  // Generated / Crafted News (21-40: 10 Fake, 10 True Rewritten)
  { id: 21, category: 'Health Hoax', news: 'SHOCKING SECRET! Miracle kitchen spice completely cures chronic heart disease in just 48 hours and doctors are hiding it!', expected: 'likely_fake' },
  { id: 22, category: 'Government Scam', news: 'BREAKING: Government announces 100% free luxury cars and villas for all citizens starting next Monday!', expected: 'likely_fake' },
  { id: 23, category: 'Space Hoax', news: 'VIRAL HOAX: NASA confirms doomsday planet Nibiru will collide with Earth this December and destroy humanity!', expected: 'likely_fake' },
  { id: 24, category: 'Financial Scam', news: 'SCAM ALERT: Click this exclusive link to claim your ₹50,000 government scholarship cash instantly before midnight!', expected: 'likely_fake' },
  { id: 25, category: 'Health Hoax', news: 'Drinking boiling salt water cures dengue fever instantly without any medical care or hospital admission!', expected: 'likely_fake' },
  { id: 26, category: 'Banking Scam', news: 'FAKE ANNOUNCEMENT: Ministry declares all bank accounts will be permanently frozen unless verified immediately via WhatsApp!', expected: 'likely_fake' },
  { id: 27, category: 'Conspiracy', news: 'SENSATIONAL CLAIM: Secret leaked government memo proves extraterrestrial beings are controlling stock market trading!', expected: 'likely_fake' },
  { id: 28, category: 'Tech Hoax', news: 'MISLEADING CLAIM: New smartphone software update turns your standard glass screen into a 3D hologram projector!', expected: 'likely_fake' },
  { id: 29, category: 'False Alert', news: 'FALSE REPORT: All major commercial airports are permanently closing tomorrow morning due to unexpected emergency!', expected: 'likely_fake' },
  { id: 30, category: 'Viral Forward', news: 'HOAX FORWARD: Forward this message to 20 family groups right now to activate free lifetime cellular data!', expected: 'likely_fake' },
  { id: 31, category: 'Rewritten True', news: 'City council members voted 7 to 4 to approve a municipal bond for transit repairs.', expected: 'likely_true' },
  { id: 32, category: 'Rewritten True', news: 'Researchers at the university tracked adults over five years and found a 12 percent reduction in hospital admissions.', expected: 'likely_true' },
  { id: 33, category: 'Rewritten True', news: 'Central bank committee maintained the benchmark interest rate during their quarterly meeting.', expected: 'likely_true' },
  { id: 34, category: 'Rewritten True', news: 'Space agency successfully placed an Earth observation satellite into sun-synchronous orbit.', expected: 'likely_true' },
  { id: 35, category: 'Rewritten True', news: 'Ministry of health published an updated advisory regarding annual vaccination drives.', expected: 'likely_true' },
  { id: 36, category: 'Rewritten True', news: 'Apex court bench delivered a verdict upholding digital privacy regulations.', expected: 'likely_true' },
  { id: 37, category: 'Rewritten True', news: 'Technology firm unveiled a new processor architecture focusing on energy efficiency.', expected: 'likely_true' },
  { id: 38, category: 'Rewritten True', news: 'Sports board announced dates and venue hosting for the upcoming championship match.', expected: 'likely_true' },
  { id: 39, category: 'Rewritten True', news: 'Environmental research team published global atmospheric carbon mapping data.', expected: 'likely_true' },
  { id: 40, category: 'Rewritten True', news: 'Cabinet committee cleared funding for the expansion of regional transportation corridors.', expected: 'likely_true' },
];

test('Comprehensive 40-News System Evaluation & Report', () => {
  let correct = 0;
  let incorrect = 0;
  let falsePositives = 0; // expected true, got fake
  let falseNegatives = 0; // expected fake, got true
  let unverifiedCount = 0;

  console.log('\n=========================================');
  console.log('TRUTHLENS AI — 40-NEWS EVALUATION REPORT');
  console.log('=========================================\n');
  console.log('| No. | Category | Expected | Actual | Match? |');
  console.log('|---|---|---|---|---|');

  for (const tc of FORTY_TEST_CASES) {
    const ml = predictArticle(tc.news);
    const ling = analyzeLinguisticSignals(tc.news);
    const outcome = computeCautiousAssessment(ml, ling, false);
    const actual = outcome.simple_verdict;

    const isMatch = actual === tc.expected || (tc.expected === 'likely_true' && actual === 'unverified') || (tc.expected === 'unverified' && actual === 'likely_true');
    // Strict match or safe unverified
    const strictMatch = actual === tc.expected;

    if (strictMatch) {
      correct++;
    } else {
      incorrect++;
      if (tc.expected === 'likely_true' && actual === 'likely_fake') falsePositives++;
      if (tc.expected === 'likely_fake' && actual === 'likely_true') falseNegatives++;
    }

    if (actual === 'unverified') {
      unverifiedCount++;
    }

    console.log(`| ${tc.id} | ${tc.category} | ${tc.expected} | ${actual} | ${strictMatch ? '✅' : '❌'} |`);
  }

  const accuracy = Number(((correct / FORTY_TEST_CASES.length) * 100).toFixed(1));

  console.log('\n=========================================');
  console.log('EVALUATION METRICS SUMMARY');
  console.log('=========================================');
  console.log(`Total Test Cases: ${FORTY_TEST_CASES.length}`);
  console.log(`Correct Predictions: ${correct}`);
  console.log(`Incorrect Predictions: ${incorrect}`);
  console.log(`Accuracy: ${accuracy}%`);
  console.log(`False Positives (True marked Fake): ${falsePositives}`);
  console.log(`False Negatives (Fake marked True): ${falseNegatives}`);
  console.log(`Unverified Cases: ${unverifiedCount}`);
  console.log('=========================================\n');

  assert.ok(accuracy >= 80, `Model accuracy (${accuracy}%) should be at least 80% across 40 test cases.`);
});
