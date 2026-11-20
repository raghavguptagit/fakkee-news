export interface LabeledSample {
  id: string;
  label: 'credible_reporting' | 'misleading_or_sensational';
  topic: string;
  text: string;
}

const CREDIBLE_TEMPLATES: Array<{ topic: string; text: string }> = [
  {
    topic: 'Public Health',
    text: 'According to a peer-reviewed study published in The Lancet on Tuesday, researchers at the University of Oxford tracked 14,200 adults over five years and found a 12 percent reduction in hospital admissions among participants who received the updated seasonal vaccine. Dr. Sarah Patel, lead epidemiologist on the project, noted that while the findings are statistically significant, further longitudinal monitoring is required across older cohorts.',
  },
  {
    topic: 'Economics',
    text: 'The Bureau of Labor Statistics reported Friday that consumer prices rose 0.2 percent in October, bringing the annual inflation rate to 2.6 percent. Economists surveyed by Reuters had projected a 2.5 percent increase. Core inflation, which excludes food and energy costs, remained unchanged from the prior month, according to the agency release.',
  },
  {
    topic: 'Climate & Energy',
    text: 'Data released by the National Oceanic and Atmospheric Administration indicates that global surface temperatures in 2024 exceeded the twentieth-century average by 1.28 degrees Celsius. The agency based its assessment on measurements from weather stations, ocean buoys, and satellite observations, and published the full methodology in its annual climate bulletin.',
  },
  {
    topic: 'Technology',
    text: 'The European Commission announced a formal inquiry into data portability practices among major cloud infrastructure providers, citing feedback from 38 software vendors. A spokesperson for the commission stated that the investigation does not prejudge the outcome and is expected to conclude within twelve months.',
  },
  {
    topic: 'Public Policy',
    text: 'City council members voted 7 to 4 on Wednesday to approve a $42 million municipal bond for transit infrastructure repairs. According to the city budget office, the funding will prioritize bridge inspections and bus rapid transit lanes along three high-volume corridors beginning in the second quarter.',
  },
  {
    topic: 'Science',
    text: 'Astronomers using the James Webb Space Telescope detected carbon dioxide and methane signatures in the atmosphere of exoplanet K2-18 b, according to a paper accepted by the Astrophysical Journal Letters. The research team emphasized that the chemical signatures alone do not confirm biological activity and require follow-up spectroscopic observations.',
  },
  {
    topic: 'Education',
    text: 'A state department of education audit covering 410 public high schools found that graduation rates increased by 1.8 percentage points between 2022 and 2024. District superintendents attributed part of the gain to expanded tutoring programs, though analysts cautioned that attendance rates in rural districts remain below pre-2020 levels.',
  },
  {
    topic: 'Agriculture',
    text: 'The Department of Agriculture revised its quarterly wheat harvest forecast upward by 3.1 percent following favorable rainfall across the Midwest. Commodity analysts noted that global export prices responded modestly, as elevated shipping insurance costs continue to weigh on regional supply chains.',
  },
  {
    topic: 'Transportation',
    text: 'Federal aviation regulators issued an airworthiness directive requiring inspections of cabin pressure sensors on 215 regional aircraft within 90 days. The directive follows two non-injury incidents reported by maintenance crews earlier this year, and airlines stated they expect minimal schedule disruptions.',
  },
  {
    topic: 'Finance',
    text: 'Central bank minutes released Wednesday showed policymakers divided over the pace of interest rate adjustments, with several officials citing resilient labor market data and others pointing to slowing manufacturing orders. The committee reiterated that future decisions will remain data-dependent.',
  },
  {
    topic: 'Healthcare',
    text: 'Hospital administrators in three metropolitan areas reported a 9 percent decrease in emergency room wait times after deploying nurse-led triage protocols. The findings were presented at the annual Health Systems Research Symposium, where independent reviewers noted the need for randomized controlled trials.',
  },
  {
    topic: 'Environment',
    text: 'Municipal water utility tests conducted across 64 sampling sites confirmed that lead concentrations remained below federal action thresholds. Utility officials published the laboratory reports online and scheduled a public comment hearing for next month.',
  },
];

const MISLEADING_TEMPLATES: Array<{ topic: string; text: string }> = [
  {
    topic: 'Public Health',
    text: 'SHOCKING SECRET doctors do not want you to know! A miracle kitchen spice completely cures chronic heart disease in just 48 hours, and Big Pharma is desperately hiding the truth to protect billion-dollar profits. Share this before they censor and delete it forever!',
  },
  {
    topic: 'Economics',
    text: 'BREAKING: Total economic collapse GUARANTEED by Friday! Insiders say banks are secretly freezing every single savings account overnight while elites move their wealth offshore. Wake up people, mainstream media is lying to you!',
  },
  {
    topic: 'Climate & Energy',
    text: 'EXPOSED: The entire climate agenda is a massive hoax fabricated by shadowy globalists to ban your car and control your thermostat! Unnamed insiders leaked proof that weather stations are being heated with blowtorches to fake the numbers!',
  },
  {
    topic: 'Technology',
    text: 'URGENT WARNING: New 5G towers are secretly scanning your brainwaves and draining your phone battery to spy on every private thought! Experts say wrapping your router in foil is the ONLY proven way to stop the mind-control radiation right now!',
  },
  {
    topic: 'Public Policy',
    text: 'OUTRAGEOUS! Corrupt politicians just passed a secret midnight bill that will confiscate 80 percent of your property next week! Nobody in the mainstream press will report this bombshell betrayal — forward this to everyone you know immediately!',
  },
  {
    topic: 'Science',
    text: 'UNBELIEVABLE DISCOVERY: NASA caught red-handed hiding an alien megastructure behind the moon! Whistleblowers claim the government has been negotiating with extraterrestrials for decades while keeping citizens completely in the dark!',
  },
  {
    topic: 'Finance',
    text: 'MILLIONAIRES ARE FURIOUS! This one weird loophole lets anyone turn $100 into $50,000 in seven days with ZERO risk! Financial experts are stunned and terrified that ordinary people will discover this guaranteed secret before midnight!',
  },
  {
    topic: 'Healthcare',
    text: 'BOMBSHELL LEAK: Common tap water contains a secret chemical designed to make the population docile and obedient! Anonymous sources confirm that hospitals are covering up millions of cases while suppressing the natural cure!',
  },
  {
    topic: 'Agriculture',
    text: 'THEY ARE POISONING YOUR FOOD! Shocking viral video proves grocery store apples are coated in synthetic plastic wax that causes instant organ failure! Stop buying produce immediately and share this urgent alert!',
  },
  {
    topic: 'Transportation',
    text: 'TOTAL CHAOS: Airlines are secretly grounding all flights next month as part of a covert lockdown plot! A friend of a pilot confirmed the shocking plan that the government refuses to admit!',
  },
  {
    topic: 'Education',
    text: 'SCANDAL OF THE CENTURY: Schools are secretly replacing all textbooks with mind-control propaganda funded by foreign billionaires! Parents are furious after an unverified rumor spread online overnight!',
  },
  {
    topic: 'Environment',
    text: 'MIRACLE BREAKTHROUGH SUPPRESSED: A backyard inventor built a free-energy water engine that runs forever without fuel, and oil corporations immediately silenced him! Click here to see the forbidden blueprint before it vanishes!',
  },
];

const CREDIBLE_MODIFIERS = [
  'The report includes a 40-page technical appendix detailing confidence intervals and sample limitations.',
  'Independent researchers who were not involved in the study described the methodology as rigorous.',
  'Public records reviewed by reporters corroborate the timeline outlined in the official statement.',
  'Spokespeople for both organizations declined to comment beyond their written filings.',
  'The agency scheduled a follow-up review in six months to evaluate preliminary outcomes.',
  'Historical data from the past decade shows a similar seasonal pattern, analysts noted.',
  'Auditors verified the expenditure figures against quarterly municipal ledger statements.',
  'The full dataset has been made available to academic institutions for replication.',
  'Committee members requested additional testimony from industry and consumer advocates.',
  'According to court documents filed in federal district court, the hearing will resume Monday.',
];

const MISLEADING_MODIFIERS = [
  'You will NOT believe what happens next — the truth is finally coming out!',
  'They are trying to silence anyone who talks about this, so repost before it gets banned!',
  'Sources say this is 100 percent confirmed and the cover-up goes all the way to the top!',
  'Mainstream journalists refuse to touch this explosive story because they are paid off!',
  'Every single expert who spoke out was mysteriously fired the very next morning!',
  'Do not trust official data — this viral thread exposes the real hidden agenda!',
  'Act now before the secret deadline expires and you lose everything forever!',
  'Anonymous insiders revealed the shocking truth that will destroy the establishment!',
  'This is the biggest cover-up in human history and nobody is talking about it!',
  'Guaranteed results overnight — doctors and scientists are completely baffled!',
];

export function buildBenchmarkDataset(): LabeledSample[] {
  const samples: LabeledSample[] = [];
  let idx = 1;

  for (let i = 0; i < CREDIBLE_TEMPLATES.length; i++) {
    for (let j = 0; j < CREDIBLE_MODIFIERS.length; j++) {
      const tpl = CREDIBLE_TEMPLATES[i];
      const mod = CREDIBLE_MODIFIERS[(i + j) % CREDIBLE_MODIFIERS.length];
      samples.push({
        id: `cred-${idx++}`,
        label: 'credible_reporting',
        topic: tpl.topic,
        text: `${tpl.text} ${mod}`,
      });
    }
  }

  for (let i = 0; i < MISLEADING_TEMPLATES.length; i++) {
    for (let j = 0; j < MISLEADING_MODIFIERS.length; j++) {
      const tpl = MISLEADING_TEMPLATES[i];
      const mod = MISLEADING_MODIFIERS[(i + j) % MISLEADING_MODIFIERS.length];
      samples.push({
        id: `misl-${idx++}`,
        label: 'misleading_or_sensational',
        topic: tpl.topic,
        text: `${tpl.text} ${mod}`,
      });
    }
  }

  return samples;
}
