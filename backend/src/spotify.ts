import { db } from './store.js';

const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token';

export async function refreshTokenIfNeeded(accountId: string): Promise<string | null> {
  const account = await db.getAccount(accountId);
  if (!account) return null;

  // If token still valid (with 60s buffer)
  if (account.expiresAt > Date.now() + 60_000) {
    return account.accessToken;
  }

  // Refresh
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  if (!clientId) return null;

  try {
    const res = await fetch(SPOTIFY_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: account.refreshToken,
        client_id: clientId,
      }),
    });

    if (!res.ok) {
      console.error(`Token refresh failed for account ${accountId}:`, await res.text());
      return null;
    }

    const data: any = await res.json();
    const expiresAt = Date.now() + data.expires_in * 1000;
    await db.updateAccountTokens(accountId, data.access_token, expiresAt, data.refresh_token);
    return data.access_token;
  } catch (err) {
    console.error('Token refresh error:', err);
    return null;
  }
}

async function spotifyFetch(url: string, token: string, options?: RequestInit): Promise<Response> {
  let retries = 3;
  while (retries-- > 0) {
    const res = await fetch(url, {
      ...options,
      headers: { Authorization: `Bearer ${token}`, ...(options?.headers ?? {}) },
    });
    if (res.status === 429) {
      const retryAfter = parseInt(res.headers.get('Retry-After') || '2', 10);
      console.warn(`[Spotify] Rate limited on ${url}, retrying after ${retryAfter}s...`);
      await new Promise(r => setTimeout(r, (retryAfter + 1) * 1000));
      continue;
    }
    return res;
  }
  throw new Error('Spotify rate limit: max retries exceeded');
}

export async function getSpotifyPlaylists(accountId: string) {
  const token = await refreshTokenIfNeeded(accountId);
  if (!token) return null;

  const allItems: any[] = [];
  let url: string | null = 'https://api.spotify.com/v1/me/playlists?limit=50';

  while (url) {
    try {
      const res = await spotifyFetch(url, token);
      if (!res.ok) {
        console.error(`[Spotify] getPlaylists error ${res.status} for ${accountId}`);
        break;
      }
      const data: any = await res.json();
      allItems.push(...data.items);
      url = data.next ?? null;
    } catch (e) {
      console.error('[Spotify] getPlaylists fetch error:', e);
      break;
    }
  }

  return { items: allItems, total: allItems.length };
}

export async function getSpotifyDevices(accountId: string) {
  const token = await refreshTokenIfNeeded(accountId);
  if (!token) return null;

  const res = await fetch('https://api.spotify.com/v1/me/player/devices', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  return res.json();
}

export async function startPlaylist(
  accountId: string,
  playlistId: string,
  deviceId?: string,
  shuffle?: boolean
) {
  const token = await refreshTokenIfNeeded(accountId);
  if (!token) return false;

  const url = deviceId
    ? `https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`
    : 'https://api.spotify.com/v1/me/player/play';

  // Start the playlist
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      context_uri: `spotify:playlist:${playlistId}`,
    }),
  });

  if (!res.ok && res.status !== 204) return false;

  // Enable/disable shuffle after starting
  if (shuffle !== undefined) {
    await fetch(`https://api.spotify.com/v1/me/player/shuffle?state=${shuffle}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` },
    });
  }

  // Always set repeat to context (playlist loops) for smooth continuous playback
  await fetch('https://api.spotify.com/v1/me/player/repeat?state=context', {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}` },
  });

  return true;
}

export async function enqueuePlaylist(
  accountId: string,
  playlistId: string,
  playlistName: string,
  deviceId?: string,
  shuffle?: boolean
) {
  const token = await refreshTokenIfNeeded(accountId);
  if (!token) return false;

  try {
    // 1. Fetch ALL tracks of the playlist (up to 100 per request, max 500 total)
    let allTracks: string[] = [];
    let url: string | null = `https://api.spotify.com/v1/playlists/${playlistId}/tracks?fields=items(track(uri)),next&limit=100`;
    
    while (url && allTracks.length < 500) {
      const tracksRes = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!tracksRes.ok) break;
      const tracksData: any = await tracksRes.json();
      const tracks = tracksData.items.map((i: any) => i.track?.uri).filter(Boolean);
      allTracks.push(...tracks);
      url = tracksData.next;
    }

    if (allTracks.length === 0) return false;

    // 2. Handle shuffle manually if requested
    if (shuffle) {
      for (let i = allTracks.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [allTracks[i], allTracks[j]] = [allTracks[j], allTracks[i]];
      }
    }

    // 3. Add tracks to queue
    // We add them in order. 
    // We'll enqueue up to 200 tracks (about 12 hours of music)
    const limit = Math.min(allTracks.length, 200);
    for (let i = 0; i < limit; i++) {
      const queueUrl = deviceId
        ? `https://api.spotify.com/v1/me/player/queue?uri=${allTracks[i]}&device_id=${deviceId}`
        : `https://api.spotify.com/v1/me/player/queue?uri=${allTracks[i]}`;
      
      await fetch(queueUrl, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      
      // Small delay between track enqueues to avoid rate limiting
      if (i % 5 === 0) await new Promise(r => setTimeout(r, 100));
    }

    // 4. Store the "pushed" playlist in DB for fallback display
    await db.updateLastPushed(accountId, playlistName);

    return true;
  } catch (err) {
    console.error('Enqueue playlist error:', err);
    return false;
  }
}

export async function fadeAndStartPlaylist(
  accountId: string,
  playlistId: string,
  deviceId?: string,
  shuffle?: boolean
) {
  const token = await refreshTokenIfNeeded(accountId);
  if (!token) return false;

  const TRIGGER_BEFORE_END_MS = 15_000;
  const FADE_STEPS = 10;
  const FADE_STEP_MS = 500; // 10 × 500ms = 5s fade out

  // 1. Get current playback state
  const stateRes = await fetch('https://api.spotify.com/v1/me/player', {
    headers: { Authorization: `Bearer ${token}` },
  });
  let originalVolume = 50;
  let waitBeforeFade = 0;

  if (stateRes.ok) {
    const state: any = await stateRes.json();
    originalVolume = state?.device?.volume_percent ?? 50;
    const durationMs: number = state?.item?.duration_ms ?? 0;
    const progressMs: number = state?.progress_ms ?? 0;
    const remainingMs = durationMs - progressMs;
    if (remainingMs > TRIGGER_BEFORE_END_MS) {
      waitBeforeFade = remainingMs - TRIGGER_BEFORE_END_MS;
      console.log(`[Spotify] Waiting ${Math.round(waitBeforeFade / 1000)}s before fade for ${accountId}`);
    }
  }

  // 2. Wait until 15s before end of current track
  if (waitBeforeFade > 0) await new Promise(r => setTimeout(r, waitBeforeFade));

  // 3. Fade out over 5 seconds
  for (let i = 1; i <= FADE_STEPS; i++) {
    const vol = Math.round(originalVolume * (1 - i / FADE_STEPS));
    await fetch(`https://api.spotify.com/v1/me/player/volume?volume_percent=${vol}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` },
    });
    await new Promise(r => setTimeout(r, FADE_STEP_MS));
  }

  // 4. Fetch playlist tracks (volume is 0, inaudible)
  let trackUris: string[] = [];
  let nextUrl: string | null = `https://api.spotify.com/v1/playlists/${playlistId}/tracks?fields=items(track(uri)),next&limit=100`;
  while (nextUrl && trackUris.length < 500) {
    const res = await fetch(nextUrl, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) break;
    const data: any = await res.json();
    trackUris.push(...data.items.map((i: any) => i.track?.uri).filter(Boolean));
    nextUrl = data.next;
  }

  if (trackUris.length === 0) {
    // Restore volume and bail
    await fetch(`https://api.spotify.com/v1/me/player/volume?volume_percent=${originalVolume}`, {
      method: 'PUT', headers: { Authorization: `Bearer ${token}` },
    });
    return false;
  }

  // 5. Shuffle if requested
  if (shuffle) {
    for (let i = trackUris.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [trackUris[i], trackUris[j]] = [trackUris[j], trackUris[i]];
    }
  }

  // 6. Start new playlist using uris — instantly replaces queue, no clearing needed
  const playUrl = deviceId
    ? `https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`
    : 'https://api.spotify.com/v1/me/player/play';

  const playRes = await fetch(playUrl, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ uris: trackUris.slice(0, 500) }),
  });

  if (!playRes.ok && playRes.status !== 204) {
    await fetch(`https://api.spotify.com/v1/me/player/volume?volume_percent=${originalVolume}`, {
      method: 'PUT', headers: { Authorization: `Bearer ${token}` },
    });
    return false;
  }

  // 7. Fade in smoothly over 4 seconds using easing curve
  const FADE_IN_STEPS = 16;
  const FADE_IN_STEP_MS = 250; // 16 × 250ms = 4s fade in
  for (let i = 1; i <= FADE_IN_STEPS; i++) {
    // Ease-in-out curve: starts slow, accelerates, ends slow
    const t = i / FADE_IN_STEPS;
    const eased = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    const vol = Math.round(originalVolume * eased);
    await fetch(`https://api.spotify.com/v1/me/player/volume?volume_percent=${vol}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` },
    });
    await new Promise(r => setTimeout(r, FADE_IN_STEP_MS));
  }

  return true;
}

export async function getCurrentlyPlaying(accountId: string) {
  const token = await refreshTokenIfNeeded(accountId);
  if (!token) return null;

  const res = await fetch('https://api.spotify.com/v1/me/player', {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (res.status === 204 || !res.ok) return null;
  const data: any = await res.json();

  if (!data.item) return null;

  let contextName = null;
  if (data.context?.type === 'playlist') {
    const playlistId = data.context.uri.split(':').pop();
    const pRes = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}?fields=name`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (pRes.ok) {
      const pData: any = await pRes.json();
      contextName = pData.name;
    }
  } else if (data.context?.type === 'album') {
    contextName = `Album : ${data.item.album.name}`;
  } else if (data.context?.type === 'artist') {
    contextName = `Artiste : ${data.item.artists[0].name}`;
  }

  return {
    isPlaying: data.is_playing,
    trackName: data.item.name,
    artistName: data.item.artists.map((a: any) => a.name).join(', '),
    playlistName: contextName,
    albumImageUrl: data.item.album.images[0]?.url,
  };
}
