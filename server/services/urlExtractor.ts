import dns from 'dns/promises';
import net from 'net';

export interface ExtractedArticle {
  url: string;
  title: string | null;
  text: string;
  publisher: string;
  limitations: string[];
}

export function isPrivateOrReservedIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const parts = ip.split('.').map(Number);
    if (parts[0] === 10) return true; // 10.0.0.0/8
    if (parts[0] === 127) return true; // 127.0.0.0/8 loopback
    if (parts[0] === 0) return true; // 0.0.0.0/8
    if (parts[0] === 169 && parts[1] === 254) return true; // link-local / cloud metadata
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true; // 172.16.0.0/12
    if (parts[0] === 192 && parts[1] === 168) return true; // 192.168.0.0/16
    if (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127) return true; // CGNAT
    if (parts[0] >= 224) return true; // multicast/reserved
    return false;
  }
  if (net.isIPv6(ip)) {
    const normalized = ip.toLowerCase();
    if (normalized === '::1' || normalized === '::') return true;
    if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true; // ULA
    if (normalized.startsWith('fe80')) return true; // link-local
    if (normalized.startsWith('::ffff:')) {
      const mapped = normalized.replace('::ffff:', '');
      return isPrivateOrReservedIp(mapped);
    }
    return false;
  }
  return true;
}

export async function validateSafeUrl(rawUrl: string): Promise<URL> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    throw new Error('Invalid URL format. Please provide a valid http:// or https:// URL.');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Only http:// and https:// URLs are permitted.');
  }

  const host = parsed.hostname.toLowerCase();
  if (
    host === 'localhost' ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    host === 'metadata.google.internal' ||
    host === '169.254.169.254'
  ) {
    throw new Error('Access to local or internal network addresses is blocked for security.');
  }

  if (net.isIP(host)) {
    if (isPrivateOrReservedIp(host)) {
      throw new Error('Access to private or reserved IP ranges is blocked for security.');
    }
    return parsed;
  }

  try {
    const records = await dns.lookup(host, { all: true });
    if (!records.length) {
      throw new Error('Could not resolve hostname.');
    }
    for (const rec of records) {
      if (isPrivateOrReservedIp(rec.address)) {
        throw new Error('URL resolves to a private or restricted IP address and was blocked.');
      }
    }
  } catch (err) {
    if (err instanceof Error && err.message.includes('blocked')) throw err;
    throw new Error('Unable to resolve URL host. Please verify the address or paste the article text directly.');
  }

  return parsed;
}

function stripHtmlToReadableText(html: string): { title: string | null; text: string } {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? titleMatch[1].replace(/\s+/g, ' ').trim() : null;

  const cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<nav[\s\S]*?<\/nav>/gi, ' ')
    .replace(/<footer[\s\S]*?<\/footer>/gi, ' ')
    .replace(/<header[\s\S]*?<\/header>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ');

  const paragraphs = Array.from(cleaned.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi))
    .map((m) =>
      m[1]
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/\s+/g, ' ')
        .trim()
    )
    .filter((p) => p.length > 30);

  const text = paragraphs.join('\n\n').slice(0, 30000);
  return { title, text };
}

export async function extractArticleFromUrl(rawUrl: string): Promise<ExtractedArticle> {
  const parsed = await validateSafeUrl(rawUrl);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const res = await fetch(parsed.toString(), {
      method: 'GET',
      redirect: 'manual',
      signal: controller.signal,
      headers: {
        'User-Agent': 'TruthLensAI-AcademicAnalyzer/1.0',
        Accept: 'text/html, text/plain;q=0.9',
      },
    });

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('location');
      if (!location) throw new Error('Redirect missing location header.');
      const nextUrl = new URL(location, parsed).toString();
      await validateSafeUrl(nextUrl);
      throw new Error('Cross-host redirect encountered; please paste the final canonical URL or article text.');
    }

    if (!res.ok) {
      throw new Error(`Remote server returned HTTP ${res.status}. Please paste the article text directly.`);
    }

    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('text/html') && !contentType.includes('text/plain')) {
      throw new Error(`Unsupported content type (${contentType}). Only HTML and plain text articles are supported.`);
    }

    const maxBytes = 1_500_000;
    const buffer = await res.arrayBuffer();
    if (buffer.byteLength > maxBytes) {
      throw new Error('Webpage exceeds maximum safe download size (1.5 MB). Please paste the article text.');
    }

    const rawBody = new TextDecoder('utf-8').decode(buffer);
    const { title, text } = contentType.includes('text/plain')
      ? { title: parsed.hostname, text: rawBody.slice(0, 30000) }
      : stripHtmlToReadableText(rawBody);

    if (!text || text.length < 60) {
      throw new Error('Could not extract sufficient readable article text (site may use client-side rendering or a paywall). Please paste the text directly.');
    }

    return {
      url: parsed.toString(),
      title,
      text,
      publisher: parsed.hostname.replace(/^www\./, ''),
      limitations: ['Automated HTML extraction may omit captions, tables, or paywalled sections.'],
    };
  } finally {
    clearTimeout(timeout);
  }
}
