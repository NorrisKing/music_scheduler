import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export const supabase = createClient(supabaseUrl, supabaseKey);

export interface SpotifyAccount {
  id: string; // Spotify user ID
  displayName: string;
  email: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // timestamp ms
  addedAt: number;
  lastPushedPlaylistName?: string;
  lastPushedAt?: number;
}

export interface Schedule {
  id: string;
  name?: string;       // user-defined label
  accountId: string;
  playlistId: string;
  playlistName: string;
  playlistImageUrl?: string;
  // cron expression like "30 7 * * 1" = monday 7:30
  cronExpression: string;
  // human readable: days of week as numbers (0=Sun..6=Sat), hour, minute
  days: number[];
  hour: number;
  minute: number;
  active: boolean;
  createdAt: number;
  lastTriggeredAt?: number;
  deviceId?: string; // Spotify device ID to play on
  deviceName?: string;
  shuffle?: boolean;  // play in random order
}

function mapAccountFromDb(data: any): SpotifyAccount {
  return {
    id: data.id,
    displayName: data.display_name,
    email: data.email,
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Number(data.expires_at),
    addedAt: Number(data.added_at),
  };
}

function mapAccountToDb(account: SpotifyAccount) {
  return {
    id: account.id,
    display_name: account.displayName,
    email: account.email,
    access_token: account.accessToken,
    refresh_token: account.refreshToken,
    expires_at: account.expiresAt,
    added_at: account.addedAt,
  };
}

function mapScheduleFromDb(data: any): Schedule {
  return {
    id: data.id,
    name: data.name,
    accountId: data.account_id,
    playlistId: data.playlist_id,
    playlistName: data.playlist_name,
    playlistImageUrl: data.playlist_image_url,
    cronExpression: data.cron_expression,
    days: data.days,
    hour: data.hour,
    minute: data.minute,
    active: data.active,
    createdAt: Number(data.created_at),
    lastTriggeredAt: data.last_triggered_at ? Number(data.last_triggered_at) : undefined,
    deviceId: data.device_id,
    deviceName: data.device_name,
    shuffle: data.shuffle,
  };
}

function mapScheduleToDb(schedule: Schedule) {
  return {
    id: schedule.id,
    name: schedule.name,
    account_id: schedule.accountId,
    playlist_id: schedule.playlistId,
    playlist_name: schedule.playlistName,
    playlist_image_url: schedule.playlistImageUrl,
    cron_expression: schedule.cronExpression,
    days: schedule.days,
    hour: schedule.hour,
    minute: schedule.minute,
    active: schedule.active,
    created_at: schedule.createdAt,
    last_triggered_at: schedule.lastTriggeredAt,
    device_id: schedule.deviceId,
    device_name: schedule.deviceName,
    shuffle: schedule.shuffle,
  };
}

export const db = {
  // Accounts
  async getAccounts(): Promise<SpotifyAccount[]> {
    const { data, error } = await supabase.from('spotify_accounts').select('*');
    if (error) throw error;
    return (data || []).map(mapAccountFromDb);
  },
  async getAccount(id: string): Promise<SpotifyAccount | undefined> {
    const { data, error } = await supabase.from('spotify_accounts').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    return data ? mapAccountFromDb(data) : undefined;
  },
  async upsertAccount(account: SpotifyAccount) {
    const { error } = await supabase.from('spotify_accounts').upsert(mapAccountToDb(account));
    if (error) throw error;
  },
  async deleteAccount(id: string) {
    const { error } = await supabase.from('spotify_accounts').delete().eq('id', id);
    if (error) throw error;
    // schedules will be deleted by cascade in DB
  },
  async updateAccountTokens(id: string, accessToken: string, expiresAt: number, refreshToken?: string) {
    const updates: any = {
      access_token: accessToken,
      expires_at: expiresAt,
    };
    if (refreshToken) updates.refresh_token = refreshToken;

    const { error } = await supabase.from('spotify_accounts').update(updates).eq('id', id);
    if (error) throw error;
  },

  // Schedules
  async getSchedules(): Promise<Schedule[]> {
    const { data, error } = await supabase.from('schedules').select('*');
    if (error) throw error;
    return (data || []).map(mapScheduleFromDb);
  },
  async getSchedulesByAccount(accountId: string): Promise<Schedule[]> {
    const { data, error } = await supabase.from('schedules').select('*').eq('account_id', accountId);
    if (error) throw error;
    return (data || []).map(mapScheduleFromDb);
  },
  async getSchedule(id: string): Promise<Schedule | undefined> {
    const { data, error } = await supabase.from('schedules').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    return data ? mapScheduleFromDb(data) : undefined;
  },
  async upsertSchedule(schedule: Schedule) {
    const { error } = await supabase.from('schedules').upsert(mapScheduleToDb(schedule));
    if (error) throw error;
  },
  async deleteSchedule(id: string) {
    const { error } = await supabase.from('schedules').delete().eq('id', id);
    if (error) throw error;
  },
  async markTriggered(id: string) {
    const { error } = await supabase.from('schedules').update({ last_triggered_at: Date.now() }).eq('id', id);
    if (error) throw error;
  },
};
