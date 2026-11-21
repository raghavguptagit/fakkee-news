import crypto from 'crypto';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import { isGeminiConfigured } from './geminiService';

export interface EvidenceRecord {
  source_url: string;
  source_title: string;
  publisher: string;
  published_at: string | null;
  retrieved_at: string;
  snippet: string;
  relation: 'supports' | 'contradicts' | 'mixed' | 'context' | 'unclear';
  provider: string;
  relevance_score: number | null;
  dedupe_hash: string;
}

const TRUSTED_DOMAIN_PATTERNS = [
  /\.gov$/i,
  /\.gov\.[a-z]{2}$/i,
  /\.nic\.in$/i,
  /\.edu$/i,
  /\.ac\.[a-z]{2}$/i,
  /(^|\.)who\.int$/i,
  /(^|\.)un\.org$/i,
  /(^|\.)reuters\.com$/i,
  /(^|\.)apnews\.com$/i,
  /(^|\.)bbc\.(com|co\.uk)$/i,
  /(^|\.)npr\.org$/i,
  /(^|\.)pbs\.org$/i,
  /(^|\.)factcheck\.org$/i,
  /(^|\.)factcheck\.afp\.com$/i,
  /(^|\.)fullfact\.org$/i,
  /(^|\.)leadstories\.com$/i,
  /(^|\.)snopes\.com$/i,
  /(^|\.)politifact\.com$/i,
  /(^|\.)altnews\.in$/i,
  /(^|\.)boomlive\.in$/i,
  /(^|\.)vishvasnews\.com$/i,
  /(^|\.)thehindu\.com$/i,
  /(^|\.)indianexpress\.com$/i,
  /(^|\.)ndtv\.com$/i,
  /(^|\.)nytimes\.com$/i,
  /(^|\.)washingtonpost\.com$/i,
  /(^|\.)nature\.com$/i,
  /(^|\.)thelancet\.com$/i,
  /(^|\.)nejm\.org$/i,
  /(^|\.)cdc\.gov$/i,
  /(^|\.)nasa\.gov$/i,
  /(^|\.)pib\.gov\.in$/i,
  /(^|\.)earthsky\.org$/i,
  /(^|\.)cancerfactfinder\.org$/i,
  /(^|\.)center4research\.org$/i,
  /(^|\.)bhf\.org\.uk$/i,
];

function isValidHttpUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function getDomainAuthorityScore(host: string): number {
  for (const pattern of TRUSTED_DOMAIN_PATTERNS) {
    if (pattern.test(host)) return 2;
  }
  if (/wikipedia\.org$/i.test(host)) return 1;
  return 0;
}

function prioritizeTrustedSources(items: EvidenceRecord[]): EvidenceRecord[] {
  return [...items].sort((a, b) => getDomainAuthorityScore(b.publisher) - getDomainAuthorityScore(a.publisher));
}

function getEvidenceApiKey(): string {
  return (process.env.EVIDENCE_API_KEY || process.env.TAVILY_API_KEY || '').trim();
}

export function getActiveEvidenceProvider(): 'tavily' | 'gemini_search' | 'wikipedia' | 'none' {
  if (process.env.EVIDENCE_SEARCH_ENABLED === 'false') return 'none';
  const configured = (process.env.EVIDENCE_PROVIDER || 'auto').toLowerCase().trim();
  if (configured === 'none') return 'none';

  const hasApiKey = getEvidenceApiKey().length > 5;

  if ((configured === 'tavily' || configured === 'auto') && hasApiKey) {
    return 'tavily';
  }
  if ((configured === 'gemini_search' || configured === 'auto') && isGeminiConfigured()) {
    return 'gemini_search';
  }
  if (configured === 'wikipedia') {
    return 'wikipedia';
  }
  return 'none';
}

export function isEvidenceProviderConfigured(): boolean {
  return getActiveEvidenceProvider() !== 'none';
}

export function deduplicateEvidence(items: EvidenceRecord[]): EvidenceRecord[] {
  const seen = new Set<string>();
  const out: EvidenceRecord[] = [];
  for (const item of items) {
    if (!seen.has(item.dedupe_hash)) {
      seen.add(item.dedupe_hash);
      out.push(item);
    }
  }
  return out;
}

const QUERY_FILLER_RE =
  /\b(breaking news|breaking|shocking|secret|urgent|alert|viral|exposed|bombshell|unbelievable|doctors don't want you to know|doctors do not want you to know|share this before|forward this immediately|click the link below)\b|(ब्रेकिंग न्यूज़|बड़ी खबर|चौंकाने वाला|सनसनीखेज|बड़ा खुलासा|तुरंत फॉरवर्ड करें|तुरंत शेयर करें|लिंक पर क्लिक करके)/gi;

export function buildVerificationQueries(articleText: string): string[] {
  const cleaned = articleText
    .replace(/https?:\/\/\S+/gi, ' ')
    .replace(QUERY_FILLER_RE, ' ')
    .replace(/[^\p{L}\p{N}\s.-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const words = cleaned.split(' ').filter((w) => w.length >= 2);
  const core = words.slice(0, 10).join(' ').trim().slice(0, 120);
  if (!core || core.length < 4) return [];

  const queries = [core];
  if (!/\bfact[\s-]?check\b/i.test(core)) {
    queries.push(`${words.slice(0, 8).join(' ')} fact check`.slice(0, 120));
  }
  return queries;
}

const STOPWORDS = new Set([
  'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had', 'her', 'was', 'one', 'our', 'out',
  'with', 'that', 'this', 'from', 'they', 'have', 'has', 'will', 'been', 'were', 'what', 'when', 'where',
  'who', 'why', 'how', 'into', 'than', 'then', 'them', 'their', 'about', 'after', 'before', 'just', 'over',
  'says', 'said', 'told', 'according', 'report', 'reported', 'reports', 'news', 'breaking', 'claim', 'claims',
  'share', 'forward', 'message', 'post', 'video', 'today', 'viral', 'people', 'every', 'everyone',
  'है', 'हैं', 'था', 'थे', 'थी', 'को', 'के', 'की', 'का', 'में', 'से', 'पर', 'और', 'यह', 'वह', 'इस', 'उस',
  'करें', 'करने', 'रही', 'रहा', 'रहे', 'गया', 'गई', 'लिए', 'सभी', 'अभी', 'तुरंत', 'नीचे', 'दिए', 'गए',
]);

function extractTopicTokens(text: string): string[] {
  const raw = text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOPWORDS.has(w));
  return Array.from(new Set(raw)).slice(0, 18);
}

const DEBUNK_RE =
  /\b(hoax busted|fact[\s-]?check[:\s-]+(no|false|fake|misleading|altered|satire|unfounded)|debunked|fake news|is fake|is a hoax|is false|are false|false claim|misleading claim|fabricated|baseless|unfounded|conspiracy theory|warns public against fake|scam alert|phishing|rumor|rumour|myth|not true|isn't true|is not true|no scientific basis|no evidence|doesn't cure|does not cure|doesn't kill|does not kill|doesn't cause|does not cause|doesn't prevent|does not prevent|of course not|did not announce|never announced|did not confirm|never confirmed|bogus)\b|(फर्जी|झूठा|झूठी|भ्रामक|अफवाह|गलत दावा|कोई सबूत नहीं|दावा गलत)/i;

const NEGATIVE_GUARD_RE =
  /\b(fake|false|hoax|debunk|misleading|baseless|unfounded|conspiracy|rumor|rumour|scam|phishing|myth|not true|doesn't|does not|didn't|did not|never|warn|warns|warning|busted)\b|(फर्जी|झूठा|झूठी|भ्रामक|अफवाह|गलत|चेतावनी)/i;

const FACT_CHECKER_HOST_RE =
  /(snopes\.com|politifact\.com|factcheck\.org|factcheck\.afp\.com|altnews\.in|boomlive\.in|vishvasnews\.com|fullfact\.org|leadstories\.com|pib\.gov\.in|newsonair\.gov\.in|cancerfactfinder\.org)/i;

export interface EvidenceStanceSummary {
  items: EvidenceRecord[];
  contradictingCount: number;
  supportingCount: number;
  authoritativeDebunk: boolean;
  authoritativeSupport: boolean;
  topDebunkNote: string | null;
}

export function assessEvidenceRecords(articleText: string, items: EvidenceRecord[]): EvidenceStanceSummary {
  const topicTokens = extractTopicTokens(articleText);
  let contradictingCount = 0;
  let supportingCount = 0;
  let authoritativeDebunk = false;
  let authoritativeSupport = false;
  let topDebunkNote: string | null = null;

  const updated = items.map((item) => {
    const haystack = `${item.source_title} ${item.snippet} ${item.source_url}`.toLowerCase();
    const overlapCount = topicTokens.filter((tok) => haystack.includes(tok)).length;
    const minOverlap = topicTokens.length <= 3 ? 1 : 2;
    const authority = getDomainAuthorityScore(item.publisher);
    const isFactChecker = FACT_CHECKER_HOST_RE.test(item.publisher) || /fact[\s-]?check/i.test(item.source_title);

    const hasDebunkSignal = DEBUNK_RE.test(`${item.source_title} ${item.snippet}`);
    if (overlapCount >= 1 && hasDebunkSignal && (overlapCount >= minOverlap || isFactChecker || authority >= 1)) {
      contradictingCount += 1;
      if (isFactChecker || authority >= 1) {
        authoritativeDebunk = true;
      }
      if (!topDebunkNote) {
        topDebunkNote = `${item.publisher}: ${item.source_title}`;
      }
      return { ...item, relation: 'contradicts' as const };
    }

    const hasAnyNegative = NEGATIVE_GUARD_RE.test(`${item.source_title} ${item.snippet}`);
    if (authority >= 1 && overlapCount >= minOverlap && !hasAnyNegative && !isFactChecker) {
      supportingCount += 1;
      if (authority >= 2) {
        authoritativeSupport = true;
      }
      return { ...item, relation: 'supports' as const };
    }

    return { ...item, relation: 'context' as const };
  });

  return {
    items: updated,
    contradictingCount,
    supportingCount,
    authoritativeDebunk,
    authoritativeSupport,
    topDebunkNote,
  };
}

async function searchViaTavily(query: string): Promise<{ status: 'completed' | 'error'; items: EvidenceRecord[]; note: string }> {
  const apiKey = getEvidenceApiKey();
  if (!apiKey) {
    return {
      status: 'error',
      items: [],
      note: 'Live web source verification is unavailable because EVIDENCE_API_KEY is not configured.',
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        query: query.slice(0, 220),
        topic: 'general',
        search_depth: 'basic',
        max_results: 5,
        include_answer: false,
      }),
    });
    if (!res.ok) {
      return { status: 'error', items: [], note: 'Live web search is temporarily unavailable.' };
    }
    const data = (await res.json()) as {
      results?: Array<{ url?: string; title?: string; content?: string; published_date?: string | null; score?: number }>;
    };
    const now = new Date().toISOString();
    const raw: EvidenceRecord[] = (data.results || [])
      .filter((r): r is { url: string; title?: string; content?: string; published_date?: string | null; score?: number } =>
        Boolean(r.url && isValidHttpUrl(r.url))
      )
      .map((r) => {
        const host = (() => {
          try {
            return new URL(r.url).hostname.replace(/^www\./, '');
          } catch {
            return 'unknown';
          }
        })();
        return {
          source_url: r.url,
          source_title: (r.title || host).trim(),
          publisher: host,
          published_at: r.published_date || null,
          retrieved_at: now,
          snippet: (r.content || '').replace(/\s+/g, ' ').trim().slice(0, 320),
          relation: 'context',
          provider: 'tavily',
          relevance_score: typeof r.score === 'number' ? Number(r.score.toFixed(3)) : null,
          dedupe_hash: crypto.createHash('sha256').update(r.url.toLowerCase()).digest('hex'),
        };
      });
    const items = prioritizeTrustedSources(deduplicateEvidence(raw)).slice(0, 4);
    return {
      status: 'completed',
      items,
      note:
        items.length > 0
          ? 'Consulted live web sources via Tavily Search.'
          : 'Live web search ran, but no matching external web sources were found.',
    };
  } finally {
    clearTimeout(timer);
  }
}

async function searchViaGeminiGrounding(query: string): Promise<EvidenceRecord[]> {
  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
  });
  const model = process.env.GEMINI_MODEL || 'gemini-4-hydrogen';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Google Search grounding timed out')), 10000)
    );
    const apiPromise = ai.models.generateContent({
      model,
      contents: `Search for official websites, established news organizations, or reputable fact-checking reports about this claim: ${query.slice(
        0,
        220
      )}`,
      config: {
        tools: [{ googleSearch: {} }],
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      },
    });
    const response = await Promise.race([apiPromise, timeoutPromise]);

    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const now = new Date().toISOString();
    const records: EvidenceRecord[] = [];
    const summaryText = (response.text || '').replace(/\s+/g, ' ').trim();

    for (const chunk of chunks) {
      const web = chunk.web;
      if (web?.uri && isValidHttpUrl(web.uri)) {
        const titleOrDomain = (web.title || '').trim();
        const host = (() => {
          try {
            const parsedHost = new URL(web.uri).hostname.replace(/^www\./, '');
            if (parsedHost === 'vertexaisearch.cloud.google.com' && titleOrDomain) {
              return titleOrDomain;
            }
            return parsedHost;
          } catch {
            return titleOrDomain || 'web';
          }
        })();
        records.push({
          source_url: web.uri,
          source_title: titleOrDomain || host,
          publisher: host,
          published_at: null,
          retrieved_at: now,
          snippet: summaryText.slice(0, 280) || `Consulted source: ${titleOrDomain || host}.`,
          relation: 'context',
          provider: 'gemini_google_search',
          relevance_score: null,
          dedupe_hash: crypto.createHash('sha256').update(web.uri.toLowerCase()).digest('hex'),
        });
      }
    }
    return prioritizeTrustedSources(deduplicateEvidence(records)).slice(0, 4);
  } finally {
    clearTimeout(timer);
  }
}

async function searchViaWikipediaApi(query: string): Promise<EvidenceRecord[]> {
  const cleanQuery = query.replace(/[^\p{L}\p{N}\s-]/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, 120);
  if (!cleanQuery) return [];

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const url = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
      cleanQuery
    )}&srlimit=3&format=json&utf8=1`;
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'TruthLensAI/1.0 (News Verification Platform)' },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      query?: { search?: Array<{ pageid: number; title: string; snippet: string; timestamp?: string }> };
    };
    const now = new Date().toISOString();
    const records: EvidenceRecord[] = (data.query?.search || []).map((item) => {
      const pageUrl = `https://en.wikipedia.org/wiki/${encodeURIComponent(item.title.replace(/ /g, '_'))}`;
      const plainSnippet = item.snippet.replace(/<[^>]+>/g, '').replace(/&quot;/g, '"').replace(/&amp;/g, '&');
      return {
        source_url: pageUrl,
        source_title: item.title,
        publisher: 'en.wikipedia.org',
        published_at: item.timestamp || null,
        retrieved_at: now,
        snippet: plainSnippet.slice(0, 300),
        relation: 'context',
        provider: 'wikipedia_api',
        relevance_score: null,
        dedupe_hash: crypto.createHash('sha256').update(pageUrl.toLowerCase()).digest('hex'),
      };
    });
    return deduplicateEvidence(records);
  } finally {
    clearTimeout(timer);
  }
}

export async function retrieveEvidenceForQuery(query: string): Promise<{
  status: 'completed' | 'unavailable' | 'error';
  items: EvidenceRecord[];
  note: string;
}> {
  const provider = getActiveEvidenceProvider();
  if (provider === 'none') {
    return {
      status: 'unavailable',
      items: [],
      note: 'Live web source verification is unavailable. Result is based on AI and pattern analysis only.',
    };
  }

  try {
    if (provider === 'tavily') {
      return await searchViaTavily(query);
    }

    if (provider === 'gemini_search') {
      const items = await searchViaGeminiGrounding(query);
      return {
        status: items.length > 0 ? 'completed' : 'unavailable',
        items,
        note:
          items.length > 0
            ? 'Consulted live web sources via Google Search grounding.'
            : 'No external web sources returned for this query.',
      };
    }

    if (provider === 'wikipedia') {
      const items = await searchViaWikipediaApi(query);
      return {
        status: 'completed',
        items,
        note: 'Consulted Wikipedia reference articles (background context only).',
      };
    }

    return { status: 'unavailable', items: [], note: 'No active evidence provider.' };
  } catch {
    return {
      status: 'error',
      items: [],
      note: 'Live source verification could not be completed right now.',
    };
  }
}
