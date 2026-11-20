export interface LinguisticIndicator {
  phrase: string;
  reason: string;
  severity: 'low' | 'medium' | 'high';
}

export interface TransparencyCheck {
  check: string;
  detected: boolean;
  detail: string;
}

export interface LinguisticAnalysisResult {
  sensationalism_indicators: LinguisticIndicator[];
  loaded_language: LinguisticIndicator[];
  certainty_language: LinguisticIndicator[];
  attribution_quality: LinguisticIndicator[];
  framing_notes: string[];
  transparency_checks: TransparencyCheck[];
  word_count: number;
  is_short_input: boolean;
}

const SENSATIONAL_PATTERNS: Array<{ re: RegExp; reason: string; severity: 'medium' | 'high' }> = [
  { re: /\b(shocking|bombshell|unbelievable|mind-blowing|explosive|jaw-dropping)\b/gi, reason: 'Sensationalist adjective used to heighten emotional reaction', severity: 'high' },
  { re: /\b(miracle|secret cure|hidden truth|cover-up|forbidden blueprint|wake up)\b/gi, reason: 'Conspiratorial or sensational framing phrase', severity: 'high' },
  { re: /\b(share this before|before they delete|before it vanishes|forward this immediately)\b/gi, reason: 'Urgency call-to-action common in viral misinformation', severity: 'high' },
  { re: /\b(mainstream media is lying|they don't want you to know|doctors are furious|millionaires are furious)\b/gi, reason: 'Clickbait or adversarial framing', severity: 'medium' },
  { re: /!{2,}/g, reason: 'Repeated exclamation marks indicating heightened sensational tone', severity: 'medium' },
];

const LOADED_PATTERNS: Array<{ re: RegExp; reason: string; severity: 'low' | 'medium' }> = [
  { re: /\b(corrupt|outrageous|betrayal|hoax|propaganda|sheeple|elites|globalists|total chaos)\b/gi, reason: 'Emotionally loaded or polarizing term', severity: 'medium' },
  { re: /\b(destroyed|slammed|blasted|obliterated|furious|terrified|panicking)\b/gi, reason: 'Hyperbolic verb or emotional characterization', severity: 'low' },
];

const CERTAINTY_PATTERNS: Array<{ re: RegExp; reason: string; severity: 'medium' | 'high' }> = [
  { re: /\b(100 percent confirmed|100% proven|guaranteed|undeniable proof|proves beyond doubt|zero risk|completely cures)\b/gi, reason: 'Absolute certainty claim without hedging or methodological caveat', severity: 'high' },
  { re: /\b(always|never|every single|totally|completely)\b/gi, reason: 'Broad absolutist quantifier', severity: 'medium' },
];

const VAGUE_ATTRIBUTION_PATTERNS: Array<{ re: RegExp; reason: string; severity: 'medium' }> = [
  { re: /\b(experts say|insiders say|sources say|anonymous sources|whistleblowers claim|a friend of a|people are saying|viral video proves)\b/gi, reason: 'Vague or unnamed attribution that cannot be independently verified', severity: 'medium' },
];

function collectMatches(
  text: string,
  patterns: Array<{ re: RegExp; reason: string; severity: 'low' | 'medium' | 'high' }>
): LinguisticIndicator[] {
  const seen = new Set<string>();
  const results: LinguisticIndicator[] = [];
  for (const p of patterns) {
    const matches = text.match(p.re);
    if (matches) {
      for (const m of matches) {
        const key = m.toLowerCase();
        if (!seen.has(key)) {
          seen.add(key);
          results.push({ phrase: m, reason: p.reason, severity: p.severity });
        }
      }
    }
  }
  return results.slice(0, 8);
}

export function analyzeLinguisticSignals(text: string, title?: string | null): LinguisticAnalysisResult {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  const isShortInput = wordCount < 35;

  const sensationalism = collectMatches(text, SENSATIONAL_PATTERNS);
  const loaded = collectMatches(text, LOADED_PATTERNS);
  const certainty = collectMatches(text, CERTAINTY_PATTERNS);
  const attribution = collectMatches(text, VAGUE_ATTRIBUTION_PATTERNS);

  // Detect ALL-CAPS shouting words (>= 4 letters, excluding common acronyms)
  const capsWords = text.match(/\b[A-Z]{5,}\b/g) || [];
  const filteredCaps = capsWords.filter((w) => !['HTTPS', 'COVID', 'UNESCO', 'UNICEF', 'OECD', 'BRICS'].includes(w));
  if (filteredCaps.length >= 2) {
    sensationalism.push({
      phrase: filteredCaps.slice(0, 4).join(', '),
      reason: 'Frequent all-caps words used for emphasis',
      severity: 'medium',
    });
  }

  const framingNotes: string[] = [];
  if (sensationalism.length > 0) {
    framingNotes.push('Contains sensationalist or urgency-driven language. Note: sensational tone is a signal only and does not by itself prove falsehood.');
  }
  if (attribution.length > 0) {
    framingNotes.push('Relies on unnamed or vague sources ("experts say", "insiders"). Verify whether named primary sources exist.');
  }
  if (certainty.length > 0) {
    framingNotes.push('Uses high-certainty or absolutist phrasing without methodological caveats.');
  }
  if (isShortInput) {
    framingNotes.push('Short or headline-only input provides limited context; linguistic and ML signals are less reliable.');
  }
  if (framingNotes.length === 0) {
    framingNotes.push('Tone appears relatively neutral and measured. Neutral phrasing does not guarantee factual accuracy—verify underlying claims.');
  }

  // Transparency checks (heuristic detection only)
  const hasNamedSource = /\b(according to|reported by|published in|spokesperson for|university of|department of|bureau of|dr\.|professor)\b/i.test(text);
  const hasDateRef = /\b(january|february|march|april|may|june|july|august|september|october|november|december|monday|tuesday|wednesday|thursday|friday|saturday|sunday|202\d)\b/i.test(text);
  const hasDirectQuote = /"[^"]{12,}"/.test(text);
  const hasNumericData = /\b\d+(\.\d+)?\s*(%|percent|million|billion|thousand|dollars|\$)\b/i.test(text);
  const hasByline = /\bby\s+[A-Z][a-z]+\s+[A-Z][a-z]+\b/.test(text);

  const transparencyChecks: TransparencyCheck[] = [
    {
      check: 'Named institution or expert attribution',
      detected: hasNamedSource,
      detail: hasNamedSource ? 'References named institutions, studies, or titled individuals.' : 'No clearly named institutional or expert attribution detected.',
    },
    {
      check: 'Temporal context (dates / timeline)',
      detected: hasDateRef,
      detail: hasDateRef ? 'Includes explicit date or timeline references.' : 'No clear publication or event date detected in text.',
    },
    {
      check: 'Direct quotations',
      detected: hasDirectQuote,
      detail: hasDirectQuote ? 'Contains direct quoted statements.' : 'No direct quotations detected.',
    },
    {
      check: 'Verifiable quantitative figures',
      detected: hasNumericData,
      detail: hasNumericData ? 'Includes specific statistics or figures that can be cross-checked.' : 'No specific statistics detected.',
    },
    {
      check: 'Author byline pattern',
      detected: hasByline || Boolean(title && title.includes(' - ')),
      detail: hasByline ? 'Author byline pattern detected in text.' : 'Author byline not detected in pasted text.',
    },
  ];

  return {
    sensationalism_indicators: sensationalism,
    loaded_language: loaded,
    certainty_language: certainty,
    attribution_quality: attribution,
    framing_notes: framingNotes,
    transparency_checks: transparencyChecks,
    word_count: wordCount,
    is_short_input: isShortInput,
  };
}
