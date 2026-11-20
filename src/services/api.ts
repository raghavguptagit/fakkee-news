const TOKEN_KEY = 'truthlens_auth_token';

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string | null): void {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
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

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> | undefined),
  };

  if (!(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(path, { ...options, headers });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const errMsg = data?.error?.message || `Request failed with status ${res.status}`;
    const errCode = data?.error?.code || 'REQUEST_FAILED';
    throw new ApiError(errMsg, errCode, res.status);
  }
  return data as T;
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
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ question, history }),
    signal,
  });

  if (!res.ok || !res.body) {
    throw new Error('Failed to start assistant stream.');
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
