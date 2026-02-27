// En production sur Vercel, on utilise EXPO_PUBLIC_BACKEND_URL (qui doit pointer vers Railway)
// En développement local, on utilise localhost
export const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL 
  ? process.env.EXPO_PUBLIC_BACKEND_URL.replace(/\/$/, '') // On enlève le / à la fin s'il y en a un
  : 'http://localhost:3002';

console.log('Backend configuré sur :', BACKEND_URL);

export interface SpotifyAccount {
  id: string;
  displayName: string;
  email: string;
  expiresAt: number;
  addedAt: number;
}

export interface Schedule {
  id: string;
  name?: string;
  accountId: string;
  playlistId: string;
  playlistName: string;
  playlistImageUrl?: string;
  cronExpression: string;
  days: number[];
  hour: number;
  minute: number;
  active: boolean;
  createdAt: number;
  lastTriggeredAt?: number;
  deviceId?: string;
  deviceName?: string;
  shuffle?: boolean;
}

export interface SpotifyPlaylist {
  id: string;
  name: string;
  images: { url: string }[];
  tracks: { total: number };
  owner: { display_name: string };
}

export interface SpotifyDevice {
  id: string;
  name: string;
  type: string;
  is_active: boolean;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BACKEND_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'ngrok-skip-browser-warning': 'true',
      ...options?.headers,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    try {
      const json = JSON.parse(text);
      throw new Error(json.error || text || res.statusText);
    } catch (e: any) {
      if (e.message && e.message !== text) throw e;
      throw new Error(text || res.statusText);
    }
  }
  return res.json();
}

export const api = {
  exchangeToken: (body: { code: string; codeVerifier: string; redirectUri: string }) =>
    request<{ accountId: string; displayName: string; email: string }>('/auth/spotify/token', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  getAccounts: () => request<SpotifyAccount[]>('/accounts'),
  deleteAccount: (id: string) => request<{ ok: boolean }>(`/accounts/${id}`, { method: 'DELETE' }),

  getPlaylists: (accountId: string) =>
    request<{ items: SpotifyPlaylist[] }>(`/accounts/${accountId}/playlists`),
  getDevices: (accountId: string) =>
    request<{ devices: SpotifyDevice[] }>(`/accounts/${accountId}/devices`),

  getSchedules: () => request<Schedule[]>('/schedules'),
  getSchedule: (id: string) => request<Schedule>(`/schedules/${id}`),
  createSchedule: (data: Omit<Schedule, 'id' | 'createdAt' | 'cronExpression' | 'lastTriggeredAt'>) =>
    request<Schedule>('/schedules', { method: 'POST', body: JSON.stringify(data) }),
  updateSchedule: (id: string, data: Partial<Schedule>) =>
    request<Schedule>(`/schedules/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteSchedule: (id: string) =>
    request<{ ok: boolean }>(`/schedules/${id}`, { method: 'DELETE' }),
  triggerSchedule: (id: string) =>
    request<{ ok: boolean }>(`/schedules/${id}/trigger`, { method: 'POST' }),
};
