// Keep auth token strictly in JS memory (never in localStorage/sessionStorage);
// persistent sessions rely on the server-issued HttpOnly cookie.
let memoryToken: string | null = null;

export function getStoredToken(): string | null {
  return memoryToken;
}

export function setStoredToken(token: string | null): void {
  memoryToken = token;
}

export function isSafeHttpUrl(rawUrl: string | null | undefined): boolean {
  if (!rawUrl || typeof rawUrl !== 'string') return false;
  try {
    const parsed = new URL(rawUrl);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export class ApiError extends Error {
  code: string;
  status: number;
  constructor(message: string, code = 'API_ERROR', status = 500) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export async function apiFetch<T>(path: string, options: RequestInit = {}, timeoutMs = 30000): Promise<T> {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    'X-Requested-With': 'TruthLens',
    ...(options.headers as Record<string, string> | undefined),
  };

  if (!(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(path, {
      ...options,
      headers,
      credentials: 'include',
      signal: options.signal || controller.signal,
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const errMsg = data?.error?.message || 'Sorry, we could not complete that request right now. Please try again.';
      const errCode = data?.error?.code || 'REQUEST_FAILED';
      throw new ApiError(errMsg, errCode, res.status);
    }
    return data as T;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    if (err instanceof Error && err.name === 'AbortError') {
      throw new ApiError('The request took too long. Please try again.', 'TIMEOUT', 408);
    }
    throw new ApiError('Sorry, we could not reach the server right now. Please try again.', 'NETWORK_ERROR', 0);
  } finally {
    clearTimeout(timer);
  }
}

export async function streamChatFollowup(
  analysisId: string,
  question: string,
  history: Array<{ role: 'user' | 'assistant'; text: string }>,
  onChunk: (text: string) => void,
  signal?: AbortSignal
): Promise<void> {
  const token = getStoredToken();
  const res = await fetch(`/api/v1/analyses/${analysisId}/chat/stream`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'X-Requested-With': 'TruthLens',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ question, history }),
    signal,
  });

  if (!res.ok || !res.body) {
    throw new Error('Sorry, the assistant could not respond right now.');
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n\n');
    buffer = lines.pop() || '';
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try {
          const payload = JSON.parse(line.slice(6));
          if (payload.text) onChunk(payload.text);
          if (payload.error) throw new Error(payload.error);
        } catch {
          // ignore partial JSON chunks
        }
      }
    }
  }
}
