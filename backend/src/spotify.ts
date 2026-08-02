import { db } from './store.js';
import { getSpotifyApp } from './spotifyApps.js';

const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token';

export async function refreshTokenIfNeeded(accountId: string): Promise<string | null> {
  const account = await db.getAccount(accountId);
  if (!account) return null;

  // If token still valid (with 60s buffer)
  if (account.expiresAt > Date.now() + 60_000) {
    return account.accessToken;
  }

  // Refresh — on utilise le Client ID du lot auquel ce compte appartient
  const clientId = getSpotifyApp(account.lotId).clientId;
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

async function resolveTargetDevice(token: string, deviceId?: string): Promise<string | undefined> {
  if (!deviceId) return undefined;
  try {
    const res = await fetch('https://api.spotify.com/v1/me/player/devices', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const data: any = await res.json();
      const found = data.devices?.some((d: any) => d.id === deviceId);
      if (!found) {
        console.log(`[Spotify] Device ${deviceId} not available, falling back to active device`);
        return undefined;
      }
    }
  } catch {
    return undefined;
  }
  return deviceId;
}

async function setVolume(token: string, volume: number): Promise<void> {
  await fetch(`https://api.spotify.com/v1/me/player/volume?volume_percent=${Math.round(volume)}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}` },
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function startPlaylist(
  accountId: string,
  playlistId: string,
  deviceId?: string,
) {
  const token = await refreshTokenIfNeeded(accountId);
  if (!token) return false;

  const targetDeviceId = await resolveTargetDevice(token, deviceId);
  const url = targetDeviceId
    ? `https://api.spotify.com/v1/me/player/play?device_id=${targetDeviceId}`
    : 'https://api.spotify.com/v1/me/player/play';

  const body = JSON.stringify({ context_uri: `spotify:playlist:${playlistId}` });
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  const res = await fetch(url, { method: 'PUT', headers, body });
  console.log(`[Spotify] startPlaylist ${accountId} device=${targetDeviceId || 'active'} → ${res.status}`);
  return res.ok || res.status === 204;
}

export async function fadeAndStartPlaylist(
  accountId: string,
  playlistId: string,
  deviceId?: string,
) {
  const token = await refreshTokenIfNeeded(accountId);
  if (!token) return false;

  // Get current player state to know volume and whether music is playing
  let originalVolume = 100;
  let isPlaying = false;
  try {
    const playerRes = await fetch('https://api.spotify.com/v1/me/player', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (playerRes.ok && playerRes.status !== 204) {
      const playerData: any = await playerRes.json();
      isPlaying = playerData.is_playing === true;
      if (playerData.device?.volume_percent != null) {
        originalVolume = playerData.device.volume_percent;
      }
    }
  } catch {
    // Proceed without fade if player state is unavailable
  }

  // Fade out only if something is currently playing
  // 12 steps over ~5 seconds — gentle ease-in curve starting at 95% of original
  if (isPlaying && originalVolume > 0) {
    const fractions = [0.95, 0.88, 0.79, 0.69, 0.59, 0.48, 0.38, 0.28, 0.19, 0.11, 0.05, 0];
    for (const f of fractions) {
      await setVolume(token, Math.round(originalVolume * f));
      await sleep(400);
    }
  }

  // Start the new playlist
  const targetDeviceId = await resolveTargetDevice(token, deviceId);
  const url = targetDeviceId
    ? `https://api.spotify.com/v1/me/player/play?device_id=${targetDeviceId}`
    : 'https://api.spotify.com/v1/me/player/play';
  const body = JSON.stringify({ context_uri: `spotify:playlist:${playlistId}` });
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  const res = await fetch(url, { method: 'PUT', headers, body });
  console.log(`[Spotify] fadeAndStartPlaylist ${accountId} device=${targetDeviceId || 'active'} → ${res.status}`);
  const ok = res.ok || res.status === 204;

  // Restore volume immediately at full level
  if (ok) {
    await sleep(300);
    await setVolume(token, originalVolume);
  }

  return ok;
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
