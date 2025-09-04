// Lightweight API client for the frontend
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

export interface ApiRequestOptions {
  method?: HttpMethod;
  headers?: Record<string, string>;
  body?: any;
  token?: string | null;
  cache?: RequestCache;
}

export async function apiFetch<T = any>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const { method = 'GET', headers = {}, body, token, cache } = options;

  const reqHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...headers,
  };

  if (token) {
    reqHeaders['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: reqHeaders,
    body: body ? JSON.stringify(body) : undefined,
    cache,
  });

  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    // non-JSON responses
    data = text as any;
  }

  if (!res.ok) {
    const message = (data && (data.message || data.error)) || `Request failed with ${res.status}`;
    throw new Error(message);
  }

  return data as T;
}

export const Api = {
  // Auth
  register(input: { email: string; password: string; organizationName: string }) {
    return apiFetch<{ success: boolean } & any>('/v1/register', { method: 'POST', body: input });
  },
  login(input: { email: string; password: string }) {
    return apiFetch<{ token: string; user: any }>('/v1/login', { method: 'POST', body: input });
  },
  me(token: string) {
    return apiFetch('/v1/me', { token });
  },
  exchangeSupabaseToken(accessToken: string) {
    return apiFetch<{ token: string; user: any }>('/v1/supabase/exchange', { method: 'POST', body: { accessToken } });
  },

  // Meetings
  listMeetings(token: string, params?: Record<string, string | number | boolean | undefined>) {
    const qs = params
      ? '?' + Object.entries(params)
          .filter(([, v]) => v !== undefined && v !== null)
          .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
          .join('&')
      : '';
    return apiFetch(`/v1/meetings${qs}`, { token });
  },
  getMeeting(token: string, id: string) {
    return apiFetch(`/v1/meetings/${id}`, { token });
  },

  // Search
  search(token: string, q: string) {
    return apiFetch(`/v1/search?q=${encodeURIComponent(q)}`, { token });
  },

  // API Keys
  listApiKeys(token: string) {
    return apiFetch('/v1/api-keys', { token });
  },
  createApiKey(token: string, input: { label: string; scopes: string[] }) {
    return apiFetch('/v1/api-keys', { method: 'POST', token, body: input });
  },
  revokeApiKey(token: string, id: string) {
    return apiFetch(`/v1/api-keys/${id}`, { method: 'DELETE', token });
  },
};


