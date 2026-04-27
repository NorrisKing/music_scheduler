import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { db } from './store.js';
import { getSpotifyPlaylists, getSpotifyDevices, refreshTokenIfNeeded, getCurrentlyPlaying, startPlaylist, fadeAndStartPlaylist } from './spotify.js';
import { initScheduler, scheduler } from './scheduler.js';
import { randomUUID } from 'crypto';

const app = new Hono();

app.use('*', logger());
app.use(
  '*',
  cors({
    credentials: true,
    origin: (origin) => origin || '*',
  })
);

// --- Health ---
app.get('/', (c) => c.json({ ok: true, service: 'Spotify Scheduler' }));

// --- Auth: exchange code for tokens ---
app.post(
  '/auth/spotify/token',
  zValidator(
    'json',
    z.object({
      code: z.string(),
      codeVerifier: z.string(),
      redirectUri: z.string(),
    })
  ),
  async (c) => {
    const { code, codeVerifier, redirectUri } = c.req.valid('json');
    console.log('Token exchange attempt:', { redirectUri, codeLength: code.length });
    const clientId = process.env.SPOTIFY_CLIENT_ID;
    if (!clientId) return c.json({ error: 'Missing SPOTIFY_CLIENT_ID' }, 500);

    const res = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        client_id: clientId,
        code_verifier: codeVerifier,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error('Spotify token exchange error:', err);
      return c.json({ error: 'Token exchange failed', detail: err }, 400);
    }

    const tokenData: any = await res.json();
    const expiresAt = Date.now() + tokenData.expires_in * 1000;

    // Fetch user profile
    const profileRes = await fetch('https://api.spotify.com/v1/me', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    if (!profileRes.ok) {
      return c.json({ error: 'Failed to fetch Spotify profile' }, 400);
    }
    const profile: any = await profileRes.json();

    await db.upsertAccount({
      id: profile.id,
      displayName: profile.display_name || profile.id,
      email: profile.email || '',
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      expiresAt,
      addedAt: Date.now(),
    });

    return c.json({
      accountId: profile.id,
      displayName: profile.display_name || profile.id,
      email: profile.email || '',
    });
  }
);

// --- Auth: OAuth callback relay (redirect URI pointe ici, puis redirige vers le frontend) ---
app.get('/auth/spotify/callback', (c) => {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:8081';
  const params = new URL(c.req.url).search; // preserve ?code=...&state=...
  return c.redirect(`${frontendUrl}/spotify-callback${params}`);
});

// --- Accounts ---
app.get('/accounts', async (c) => {
  console.log('--- REQUEST FOR ACCOUNTS RECEIVED --- origin:', c.req.header('origin'));
  const accounts = (await db.getAccounts()).map(({ accessToken, refreshToken, ...safe }) => safe);
  return c.json(accounts);
});

app.get('/accounts/status', async (c) => {
  const accounts = await db.getAccounts();
  const statuses = await Promise.all(
    accounts.map(async (acc) => {
      try {
        const cp: any = await getCurrentlyPlaying(acc.id);
        
        // lastPushedPlaylistName takes priority over Spotify context (enqueue doesn't change context)
        if (cp && acc.lastPushedPlaylistName) {
          const isRecent = acc.lastPushedAt && (Date.now() - acc.lastPushedAt < 2 * 60 * 60 * 1000);
          if (isRecent) {
            cp.playlistName = acc.lastPushedPlaylistName;
          }
        }

        return {
          accountId: acc.id,
          displayName: acc.displayName,
          currentlyPlaying: cp,
        };
      } catch (e) {
        return {
          accountId: acc.id,
          displayName: acc.displayName,
          currentlyPlaying: null,
        };
      }
    })
  );
  return c.json(statuses);
});

app.delete('/accounts/:id', async (c) => {
  const { id } = c.req.param();
  // Stop all schedules for this account
  const accountSchedules = await db.getSchedulesByAccount(id);
  for (const s of accountSchedules) {
    scheduler.unregister(s.id);
  }
  await db.deleteAccount(id);
  return c.json({ ok: true });
});

// --- Spotify resources ---
app.get('/accounts/:id/playlists', async (c) => {
  const { id } = c.req.param();
  const data = await getSpotifyPlaylists(id);
  if (!data) return c.json({ error: 'Failed to fetch playlists' }, 400);
  return c.json(data);
});

app.get('/accounts/:id/devices', async (c) => {
  const { id } = c.req.param();
  const data = await getSpotifyDevices(id);
  if (!data) return c.json({ error: 'Failed to fetch devices' }, 400);
  return c.json(data);
});

app.get('/accounts/:id/currently-playing', async (c) => {
  const { id } = c.req.param();
  const acc = await db.getAccount(id);
  const data: any = await getCurrentlyPlaying(id);
  
  if (data && acc?.lastPushedPlaylistName) {
    const isRecent = acc.lastPushedAt && (Date.now() - acc.lastPushedAt < 2 * 60 * 60 * 1000);
    if (isRecent) {
      data.playlistName = acc.lastPushedPlaylistName;
    }
  }

  return c.json(data);
});

// --- Schedules ---
const ScheduleInput = z.object({
  name: z.string().optional(),
  accountId: z.string(),
  playlistId: z.string(),
  playlistName: z.string(),
  playlistImageUrl: z.string().optional(),
  days: z.array(z.number().min(0).max(6)).min(1),
  hour: z.number().min(0).max(23),
  minute: z.number().min(0).max(59),
  active: z.boolean().default(true),
  deviceId: z.string().optional(),
  deviceName: z.string().optional(),
  shuffle: z.boolean().optional(),
});

app.get('/schedules', async (c) => {
  return c.json(await db.getSchedules());
});

app.get('/schedules/:id', async (c) => {
  const { id } = c.req.param();
  const schedule = await db.getSchedule(id);
  if (!schedule) return c.json({ error: 'Schedule not found' }, 404);
  return c.json(schedule);
});

app.post('/schedules', zValidator('json', ScheduleInput), async (c) => {
  const data = c.req.valid('json');

  // Check for time conflict on same account
  const existing = await db.getSchedulesByAccount(data.accountId);
  const conflict = existing.find(
    (s) =>
      s.hour === data.hour &&
      s.minute === data.minute &&
      s.days.some((d) => data.days.includes(d))
  );
  if (conflict) {
    const conflictDays = conflict.days
      .filter((d) => data.days.includes(d))
      .map((d) => ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'][d])
      .join(', ');
    return c.json(
      { error: `Conflit : "${conflict.name || conflict.playlistName}" est déjà planifiée à ${String(data.hour).padStart(2,'0')}:${String(data.minute).padStart(2,'0')} (${conflictDays})` },
      409
    );
  }

  const cronExpression = scheduler.buildCronExpression(data.days, data.hour, data.minute);

  const schedule = {
    id: randomUUID(),
    cronExpression,
    createdAt: Date.now(),
    ...data,
    active: data.active ?? true,
  };

  await db.upsertSchedule(schedule);
  if (schedule.active) scheduler.register(schedule);

  return c.json(schedule, 201);
});

app.put(
  '/schedules/:id',
  zValidator('json', ScheduleInput.partial()),
  async (c) => {
    const { id } = c.req.param();
    const existing = await db.getSchedule(id);
    if (!existing) return c.json({ error: 'Schedule not found' }, 404);

    const updates = c.req.valid('json');
    const updated = { ...existing, ...updates };

    // Check for time conflict (exclude self)
    if (updates.hour !== undefined || updates.minute !== undefined || updates.days) {
      const accountSchedules = await db.getSchedulesByAccount(updated.accountId);
      const conflict = accountSchedules.find(
        (s) =>
          s.id !== id &&
          s.hour === updated.hour &&
          s.minute === updated.minute &&
          s.days.some((d: number) => updated.days.includes(d))
      );
      if (conflict) {
        const conflictDays = conflict.days
          .filter((d: number) => updated.days.includes(d))
          .map((d: number) => ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'][d])
          .join(', ');
        return c.json(
          { error: `Conflit : "${conflict.name || conflict.playlistName}" est déjà planifiée à ${String(updated.hour).padStart(2,'0')}:${String(updated.minute).padStart(2,'0')} (${conflictDays})` },
          409
        );
      }
    }

    if (updates.days || updates.hour !== undefined || updates.minute !== undefined) {
      updated.cronExpression = scheduler.buildCronExpression(
        updated.days,
        updated.hour,
        updated.minute
      );
    }

    await db.upsertSchedule(updated);
    await scheduler.reload(id);

    return c.json(updated);
  }
);

app.delete('/schedules/:id', async (c) => {
  const { id } = c.req.param();
  scheduler.unregister(id);
  await db.deleteSchedule(id);
  return c.json({ ok: true });
});

// --- Trigger manually ---
app.post('/schedules/:id/trigger', async (c) => {
  const { id } = c.req.param();
  const schedule = await db.getSchedule(id);
  if (!schedule) return c.json({ error: 'Schedule not found' }, 404);

  // Try fade+start first (best experience), then direct start as fallback
  const ok = await fadeAndStartPlaylist(
    schedule.accountId,
    schedule.playlistId,
    schedule.deviceId,
  );

  if (ok) {
    await db.markTriggered(id);
    await db.updateLastPushed(schedule.accountId, schedule.playlistName);
    return c.json({ ok: true });
  }

  const fallbackOk = await startPlaylist(
    schedule.accountId,
    schedule.playlistId,
    schedule.deviceId,
  );

  if (fallbackOk) {
    await db.markTriggered(id);
    await db.updateLastPushed(schedule.accountId, schedule.playlistName);
    return c.json({ ok: true });
  }

  return c.json({ error: 'Failed to start playlist. Is Spotify active on a device?' }, 400);
});

// --- Init ---
initScheduler();

export default {
  fetch: app.fetch,
  port: parseInt(process.env.PORT || '3002'),
  hostname: '0.0.0.0',
};
