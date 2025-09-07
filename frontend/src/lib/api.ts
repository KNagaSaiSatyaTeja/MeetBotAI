// Lightweight API client for the frontend
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
console.log('🔧 API_BASE_URL configured as:', API_BASE_URL);

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
    console.log('🔑 API Request with token:', { path, method, hasToken: !!token });
  } else {
    console.log('❌ API Request without token:', { path, method });
  }

  const fullUrl = `${API_BASE_URL}${path}`;
  console.log('🌐 Making API request to:', fullUrl);
  console.log('📤 Request details:', {
    method,
    headers: reqHeaders,
    body: body ? JSON.stringify(body) : undefined,
    bodyType: typeof body,
    bodyStringified: body ? JSON.stringify(body) : 'undefined'
  });

  const res = await fetch(fullUrl, {
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
    console.log('❌ API Error:', { path, status: res.status, data });
    const message = (data && (data.message || data.error)) || `Request failed with ${res.status}`;
    throw new Error(message);
  }

  return data as T;
}

export const Api = {
  // Auth
  register(input: { email: string; password: string; name: string; companyName?: string }) {
    return apiFetch<{ success: boolean; user: any }>('/v1/register', { method: 'POST', body: input });
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

  // Google OAuth
  getGoogleAuthUrl(redirectUri?: string) {
    const params = redirectUri ? `?redirect_uri=${encodeURIComponent(redirectUri)}` : '';
    return apiFetch<{ url: string; state: string }>(`/v1/google/url${params}`);
  },
  googleCallback(code: string, state?: string) {
    return apiFetch<{ token: string; user: any }>('/v1/google/callback', {
      method: 'POST',
      body: { code, state }
    });
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
  createMeeting(token: string, input: { title: string; platform: string; meetingLink?: string; scheduledAt?: string }) {
    return apiFetch('/v1/meetings', { method: 'POST', token, body: input });
  },
  updateMeeting(token: string, id: string, input: any) {
    return apiFetch(`/v1/meetings/${id}`, { method: 'PUT', token, body: input });
  },
  deleteMeeting(token: string, id: string) {
    return apiFetch(`/v1/meetings/${id}`, { method: 'DELETE', token });
  },

  // Bot Management
  joinMeeting(token: string, input: { meetingLink: string; title?: string; displayName?: string; passcode?: string; consentFlags?: any }) {
    return apiFetch('/v1/bot/join', { method: 'POST', token, body: input });
  },
  getBotStatus(token: string) {
    return apiFetch('/v1/bot/status', { token });
  },
  endBot(token: string, botId: string) {
    return apiFetch(`/v1/bot/${botId}/end`, { method: 'POST', token });
  },

  // B2B API
  b2b: {
    createBot(token: string, input: any) {
      return apiFetch('/v1/b2b/bot/create', { method: 'POST', token, body: input });
    },
    getBotStatus(token: string, botId: string) {
      return apiFetch(`/v1/b2b/bot/${botId}/status`, { token });
    },
    endBot(token: string, botId: string) {
      return apiFetch(`/v1/b2b/bot/${botId}/end`, { method: 'POST', token });
    },
    listBots(token: string) {
      return apiFetch('/v1/b2b/bots', { token });
    }
  },

  // Search
  search(token: string, q: string) {
    return apiFetch(`/v1/search?q=${encodeURIComponent(q)}`, { token });
  },

  // API Tokens (User)
  listTokens(token: string) {
    return apiFetch('/v1/tokens', { token });
  },
  createToken(token: string, input: { label: string }) {
    return apiFetch('/v1/tokens', { method: 'POST', token, body: input });
  },
  revokeToken(token: string, id: string) {
    return apiFetch(`/v1/tokens/${id}`, { method: 'DELETE', token });
  },

  // Admin endpoints
  admin: {
    listUsers(token: string) {
      return apiFetch('/v1/admin/users', { token });
    },
    updateUserStatus(token: string, userId: string, isActive: boolean) {
      return apiFetch(`/v1/admin/users/${userId}/status`, { method: 'PATCH', token, body: { isActive } });
    },
    listMeetings(token: string) {
      return apiFetch('/v1/admin/meetings', { token });
    },
    revokeToken(token: string, tokenId: string) {
      return apiFetch(`/v1/admin/tokens/${tokenId}`, { method: 'DELETE', token });
    },
    getLogs(token: string, params?: { limit?: number; offset?: number }) {
      const qs = params
        ? '?' + Object.entries(params)
          .filter(([, v]) => v !== undefined)
          .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
          .join('&')
        : '';
      return apiFetch(`/v1/admin/logs${qs}`, { token });
    },
    getHealth(token: string) {
      return apiFetch('/v1/admin/health', { token });
    },
  },
};


