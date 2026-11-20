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

export function getActiveEvidenceProvider(): 'gemini_search' | 'tavily' | 'wikipedia' | 'none' {
  if (process.env.EVIDENCE_SEARCH_ENABLED === 'false') return 'none';
  const configured = (process.env.EVIDENCE_PROVIDER || 'auto').toLowerCase();
  if (configured === 'none') return 'none';
  if (configured === 'tavily' && process.env.EVIDENCE_API_KEY) return 'tavily';
  if ((configured === 'gemini_search' || configured === 'auto') && isGeminiConfigured()) return 'gemini_search';
  if (configured === 'wikipedia' || configured === 'auto') return 'wikipedia';
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

async function searchViaGeminiGrounding(query: string): Promise<EvidenceRecord[]> {
  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
  });
  const model = process.env.GEMINI_MODEL || 'gemini-4-hydrogen';
  const response = await ai.models.generateContent({
    model,
    contents: `Find reputable primary or news sources relevant to verifying this claim: ${query.slice(0, 200)}`,
    config: {
      tools: [{ googleSearch: {} }],
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
    },
  });

  const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
  const now = new Date().toISOString();
  const records: EvidenceRecord[] = [];

  for (const chunk of chunks) {
    const web = chunk.web;
    if (web?.uri) {
      const host = (() => {
        try {
          return new URL(web.uri).hostname.replace(/^www\./, '');
        } catch {
          return 'web';
        }
      })();
      records.push({
        source_url: web.uri,
        source_title: web.title || host,
        publisher: host,
        published_at: null,
        retrieved_at: now,
        snippet: (response.text || '').slice(0, 260) || `Grounded web source from ${host}.`,
        relation: 'context',
        provider: 'gemini_google_search',
        relevance_score: null,
        dedupe_hash: crypto.createHash('sha256').update(web.uri.toLowerCase()).digest('hex'),
      });
    }
  }
  return deduplicateEvidence(records).slice(0, 3);
}

async function searchViaWikipediaApi(query: string): Promise<EvidenceRecord[]> {
  const cleanQuery = query.replace(/[^a-zA-Z0-9\s-]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120);
  if (!cleanQuery) return [];

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const url = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
      cleanQuery
    )}&srlimit=3&format=json&utf8=1`;
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'TruthLensAI/1.0 (Academic Research Platform)' },
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
      note: 'Evidence search is disabled (EVIDENCE_SEARCH_ENABLED=false). Claims remain unverified.',
    };
  }

  try {
    if (provider === 'gemini_search') {
      try {
        const items = await searchViaGeminiGrounding(query);
        if (items.length > 0) {
          return {
            status: 'completed',
            items,
            note: 'Retrieved via Gemini Google Search grounding.',
          };
        }
      } catch {
        // Fall back to Wikipedia Open Search API on transient provider error
      }
      const fallbackItems = await searchViaWikipediaApi(query);
      return {
        status: 'completed',
        items: fallbackItems,
        note: 'Retrieved via Wikipedia Open Search API fallback.',
      };
    }

    if (provider === 'wikipedia') {
      const items = await searchViaWikipediaApi(query);
      return {
        status: 'completed',
        items,
        note: 'Retrieved via Wikipedia Open Search API (reference context only; verify breaking news with primary newsrooms).',
      };
    }

    if (provider === 'tavily') {
      const apiKey = process.env.EVIDENCE_API_KEY || '';
      const res = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: apiKey,
          query: query.slice(0, 200),
          search_depth: 'basic',
          max_results: 3,
        }),
      });
      if (!res.ok) {
        return { status: 'error', items: [], note: `Evidence provider returned HTTP ${res.status}.` };
      }
      const data = (await res.json()) as { results?: Array<{ url: string; title: string; content: string; score?: number }> };
      const now = new Date().toISOString();
      const raw: EvidenceRecord[] = (data.results || []).map((r) => {
        const host = (() => {
          try {
            return new URL(r.url).hostname.replace(/^www\./, '');
          } catch {
            return 'unknown';
          }
        })();
        return {
          source_url: r.url,
          source_title: r.title || host,
          publisher: host,
          published_at: null,
          retrieved_at: now,
          snippet: (r.content || '').slice(0, 320),
          relation: 'context',
          provider: 'tavily',
          relevance_score: typeof r.score === 'number' ? Number(r.score.toFixed(3)) : null,
          dedupe_hash: crypto.createHash('sha256').update(r.url.toLowerCase()).digest('hex'),
        };
      });
      return { status: 'completed', items: deduplicateEvidence(raw), note: 'Retrieved via Tavily Search API.' };
    }

    return { status: 'unavailable', items: [], note: 'No active evidence provider.' };
  } catch (err) {
    return {
      status: 'error',
      items: [],
      note: err instanceof Error ? err.message : 'Evidence retrieval failed.',
    };
  }
}
