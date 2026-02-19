import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const DATA_FILE = join(process.cwd(), 'data.json');

export interface SpotifyAccount {
  id: string; // Spotify user ID
  displayName: string;
  email: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // timestamp ms
  addedAt: number;
}

export interface Schedule {
  id: string;
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
}

interface Store {
  accounts: Record<string, SpotifyAccount>;
  schedules: Record<string, Schedule>;
}

function loadStore(): Store {
  if (existsSync(DATA_FILE)) {
    try {
      const raw = readFileSync(DATA_FILE, 'utf-8');
      return JSON.parse(raw);
    } catch {
      // ignore parse error
    }
  }
  return { accounts: {}, schedules: {} };
}

function saveStore(store: Store) {
  writeFileSync(DATA_FILE, JSON.stringify(store, null, 2), 'utf-8');
}

let store = loadStore();

export const db = {
  // Accounts
  getAccounts(): SpotifyAccount[] {
    return Object.values(store.accounts);
  },
  getAccount(id: string): SpotifyAccount | undefined {
    return store.accounts[id];
  },
  upsertAccount(account: SpotifyAccount) {
    store.accounts[account.id] = account;
    saveStore(store);
  },
  deleteAccount(id: string) {
    delete store.accounts[id];
    // also remove related schedules
    for (const key of Object.keys(store.schedules)) {
      if (store.schedules[key].accountId === id) {
        delete store.schedules[key];
      }
    }
    saveStore(store);
  },
  updateAccountTokens(id: string, accessToken: string, expiresAt: number, refreshToken?: string) {
    if (store.accounts[id]) {
      store.accounts[id].accessToken = accessToken;
      store.accounts[id].expiresAt = expiresAt;
      if (refreshToken) store.accounts[id].refreshToken = refreshToken;
      saveStore(store);
    }
  },

  // Schedules
  getSchedules(): Schedule[] {
    return Object.values(store.schedules);
  },
  getSchedulesByAccount(accountId: string): Schedule[] {
    return Object.values(store.schedules).filter((s) => s.accountId === accountId);
  },
  getSchedule(id: string): Schedule | undefined {
    return store.schedules[id];
  },
  upsertSchedule(schedule: Schedule) {
    store.schedules[schedule.id] = schedule;
    saveStore(store);
  },
  deleteSchedule(id: string) {
    delete store.schedules[id];
    saveStore(store);
  },
  markTriggered(id: string) {
    if (store.schedules[id]) {
      store.schedules[id].lastTriggeredAt = Date.now();
      saveStore(store);
    }
  },
};
