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
  detected_language: 'en' | 'hi';
  sensationalism_indicators: LinguisticIndicator[];
  loaded_language: LinguisticIndicator[];
  certainty_language: LinguisticIndicator[];
  attribution_quality: LinguisticIndicator[];
  framing_notes: string[];
  transparency_checks: TransparencyCheck[];
  word_count: number;
  is_short_input: boolean;
}

export function detectInputLanguage(text: string): 'en' | 'hi' {
  const devanagari = (text.match(/[\u0900-\u097F]/g) || []).length;
  const latin = (text.match(/[a-zA-Z]/g) || []).length;
  return devanagari > latin ? 'hi' : 'en';
}

const SENSATIONAL_PATTERNS: Array<{ re: RegExp; reason: string; severity: 'medium' | 'high' }> = [
  { re: /\b(shocking|bombshell|unbelievable|mind-blowing|explosive|jaw-dropping)\b/gi, reason: 'Sensationalist word designed to trigger a strong emotional reaction', severity: 'high' },
  { re: /\b(miracle|secret cure|hidden truth|cover-up|forbidden blueprint|wake up)\b/gi, reason: 'Dramatic or secretive framing common in misleading posts', severity: 'high' },
  { re: /\b(share this before|before they delete|before it vanishes|forward this immediately|forward to \w+ groups|share with everyone)\b/gi, reason: 'Urgent pressure to forward or share quickly without checking', severity: 'high' },
  { re: /\b(click the link below|claim your free|free laptop|free smartphone|free recharge|whatsapp forward)\b/gi, reason: 'Common viral giveaway or phishing lure pattern', severity: 'high' },
  { re: /\b(mainstream media is lying|they don't want you to know|doctors are furious|millionaires are furious|big pharma)\b/gi, reason: 'Clickbait or adversarial framing', severity: 'medium' },
  { re: /!{2,}/g, reason: 'Repeated exclamation marks used for dramatic emphasis', severity: 'medium' },
  // Hindi viral / sensational / giveaway scam patterns
  { re: /(चौंकाने वाला|सनसनीखेज|बड़ा खुलासा|होश उड़ जाएंगे|चमत्कारी इलाज|गुप्त सच|रातोरात अमीर|ब्रेकिंग न्यूज़|बड़ी खबर)/g, reason: 'Sensational Hindi clickbait phrasing', severity: 'high' },
  { re: /(फ्री लैपटॉप|मुफ्त लैपटॉप|फ्री रिचार्ज|मुफ्त रिचार्ज|फ्री स्मार्टफोन|मुफ्त स्मार्टफोन|लिंक पर क्लिक|नीचे दिए लिंक|फॉर्म भरें|आखिरी मौका|वरना मौका)/g, reason: 'Common Hindi viral giveaway or phishing scam lure', severity: 'high' },
  { re: /(शेयर करें|फॉरवर्ड करें|वायरल वीडियो|डिलीट होने से पहले|सबको भेजें|ग्रुप में तुरंत|सभी ग्रुप में)/g, reason: 'Urgent call to forward a message without checking', severity: 'high' },
];

const LOADED_PATTERNS: Array<{ re: RegExp; reason: string; severity: 'low' | 'medium' }> = [
  { re: /\b(corrupt|outrageous|betrayal|hoax|propaganda|sheeple|elites|globalists|total chaos)\b/gi, reason: 'Emotionally charged or polarizing wording', severity: 'medium' },
  { re: /\b(destroyed|slammed|blasted|obliterated|furious|terrified|panicking)\b/gi, reason: 'Exaggerated or dramatic phrasing', severity: 'low' },
  { re: /(साजिश|धोखाधड़ी|भंडाफोड़|आतंक|हड़कंप)/g, reason: 'Emotionally charged Hindi phrasing', severity: 'medium' },
];

const CERTAINTY_PATTERNS: Array<{ re: RegExp; reason: string; severity: 'medium' | 'high' }> = [
  { re: /\b(100 percent confirmed|100% proven|100% effective|100% true|guaranteed|undeniable proof|proves beyond doubt|zero risk|completely cures|cures cancer|cures diabetes|instant cure)\b/gi, reason: 'Claims 100% certainty or miracle medical cure without proof', severity: 'high' },
  { re: /\b(always|never|every single|totally|completely)\b/gi, reason: 'Absolute wording without qualification', severity: 'medium' },
  { re: /(100% सच|100% असली|पक्की खबर|गारंटी|बिल्कुल मुफ्त|पूरी तरह ठीक|रामबाण इलाज|बीमारी जड़ से खत्म)/g, reason: 'Absolute certainty claim in Hindi without proof', severity: 'high' },
];

const VAGUE_ATTRIBUTION_PATTERNS: Array<{ re: RegExp; reason: string; severity: 'medium' }> = [
  { re: /\b(experts say|insiders say|sources say|anonymous sources|anonymous insiders|whistleblowers claim|a friend of a|people are saying|viral video proves|retired nurse|internal circular|unnamed officials)\b/gi, reason: 'Uses unnamed or vague sources that cannot be checked', severity: 'medium' },
  { re: /(सूत्रों के मुताबिक|अंदरूनी सूत्रों|एक वायरल वीडियो|लोग कह रहे हैं|वायरल हो रहा)/g, reason: 'Vague or unnamed source reference in Hindi', severity: 'medium' },
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
  const detectedLanguage = detectInputLanguage(text);
  const words = text.trim().split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  const isShortInput = wordCount < 25;

  const sensationalism = collectMatches(text, SENSATIONAL_PATTERNS);
  const loaded = collectMatches(text, LOADED_PATTERNS);
  const certainty = collectMatches(text, CERTAINTY_PATTERNS);
  const attribution = collectMatches(text, VAGUE_ATTRIBUTION_PATTERNS);

  const capsWords = text.match(/\b[A-Z]{5,}\b/g) || [];
  const filteredCaps = capsWords.filter((w) => !['HTTPS', 'COVID', 'UNESCO', 'UNICEF', 'OECD', 'BRICS', 'WHO', 'NASA'].includes(w));
  if (filteredCaps.length >= 2) {
    sensationalism.push({
      phrase: filteredCaps.slice(0, 4).join(', '),
      reason: 'Frequent all-caps words used for dramatic emphasis',
      severity: 'medium',
    });
  }

  const framingNotes: string[] = [];
  if (sensationalism.length > 0) {
    framingNotes.push('Uses dramatic or urgent wording encouraging quick sharing. Dramatic wording alone is a warning sign, though facts still need checking.');
  }
  if (attribution.length > 0) {
    framingNotes.push('Mentions unnamed "insiders" or "sources" instead of verifiable official or named records.');
  }
  if (certainty.length > 0) {
    framingNotes.push('Makes sweeping or absolute promises (such as "guaranteed" or "100% proven") without evidence.');
  }
  if (isShortInput) {
    framingNotes.push('The message is very short or headline-only, which provides limited context to verify.');
  }
  if (framingNotes.length === 0) {
    framingNotes.push('The tone appears calm and straightforward, though calm wording alone does not guarantee accuracy.');
  }

  const hasNamedSource = /\b(according to|reported by|published in|spokesperson for|university of|department of|bureau of|ministry of|reuters|associated press|pti|ani|bbc|official press release|reserve bank|city council|supreme court|dr\.|professor)\b|(के अनुसार|मंत्रालय|विश्वविद्यालय|रिपोर्ट के मुताबिक|रिजर्व बैंक|सुप्रीम कोर्ट|पीटीआई)/i.test(text);
  const hasDateRef = /\b(january|february|march|april|may|june|july|august|september|october|november|december|monday|tuesday|wednesday|thursday|friday|saturday|sunday|202\d)\b|(जनवरी|फरवरी|मार्च|अप्रैल|मई|जून|जुलाई|अगस्त|सितंबर|अक्टूबर|नवंबर|दिसंबर)/i.test(text);
  const hasDirectQuote = /"[^"]{12,}"|“[^”]{12,}”/.test(text);
  const hasNumericData = /\b\d+(\.\d+)?\s*(%|percent|million|billion|thousand|crore|lakh|dollars|rupees|\$|₹)\b/i.test(text);
  const hasByline = /\bby\s+[A-Z][a-z]+\s+[A-Z][a-z]+\b/.test(text);

  const transparencyChecks: TransparencyCheck[] = [
    {
      check: 'Named institution or expert attribution',
      detected: hasNamedSource,
      detail: hasNamedSource ? 'References named institutions, officials, or studies.' : 'No clearly named official or expert source detected.',
    },
    {
      check: 'Temporal context (dates / timeline)',
      detected: hasDateRef,
      detail: hasDateRef ? 'Includes specific date or timeline details.' : 'No clear date or timeline mentioned.',
    },
    {
      check: 'Direct quotations',
      detected: hasDirectQuote,
      detail: hasDirectQuote ? 'Contains direct quoted statements.' : 'No direct quotations detected.',
    },
    {
      check: 'Verifiable figures or numbers',
      detected: hasNumericData,
      detail: hasNumericData ? 'Includes specific figures that can be checked.' : 'No specific statistics detected.',
    },
    {
      check: 'Author byline pattern',
      detected: hasByline || Boolean(title && title.includes(' - ')),
      detail: hasByline ? 'Author name pattern detected.' : 'No author name detected in pasted text.',
    },
  ];

  return {
    detected_language: detectedLanguage,
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
