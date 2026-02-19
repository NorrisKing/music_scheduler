import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';
import { api } from './api';

const SPOTIFY_SCOPES = [
  'user-read-email',
  'user-read-private',
  'playlist-read-private',
  'playlist-read-collaborative',
  'user-read-playback-state',
  'user-modify-playback-state',
].join(' ');

function getRedirectUri(): string {
  if (Platform.OS === 'web') {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:8081';
    return `${origin}/spotify-callback`;
  }
  return 'spotifyscheduler://spotify-callback';
}

async function generateCodeVerifier(): Promise<string> {
  const bytes = await Crypto.getRandomBytesAsync(32);
  return base64UrlEncode(bytes);
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const digest = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    verifier,
    { encoding: Crypto.CryptoEncoding.BASE64 }
  );
  return digest.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlEncode(bytes: Uint8Array): string {
  let str = '';
  for (let i = 0; i < bytes.length; i++) {
    str += String.fromCharCode(bytes[i]);
  }
  if (typeof btoa !== 'undefined') {
    return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  return Buffer.from(str, 'binary').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Web-mode: redirect the current tab to Spotify, come back via /spotify-callback
function loginWeb(clientId: string): Promise<{ accountId: string; displayName: string; email: string } | null> {
  return new Promise(async (resolve, reject) => {
    const verifier = await generateCodeVerifier();
    const challenge = await generateCodeChallenge(verifier);
    const state = Math.random().toString(36).substring(2, 15);
    const redirectUri = getRedirectUri();

    // Persist verifier + state so we can finish the exchange after redirect
    sessionStorage.setItem('spotify_pkce_verifier', verifier);
    sessionStorage.setItem('spotify_pkce_state', state);
    sessionStorage.setItem('spotify_pkce_redirect_uri', redirectUri);

    const params = new URLSearchParams({
      client_id: clientId,
      response_type: 'code',
      redirect_uri: redirectUri,
      code_challenge_method: 'S256',
      code_challenge: challenge,
      state,
      scope: SPOTIFY_SCOPES,
    });

    // Navigate the current tab to Spotify — the callback page will handle the return
    window.location.href = `https://accounts.spotify.com/authorize?${params.toString()}`;

    // This promise will never resolve here; resolution happens in finishWebLogin()
    // called by AccountsScreen on mount when it detects sessionStorage tokens
  });
}

// Called by AccountsScreen after returning from /spotify-callback
export async function finishWebLogin(): Promise<{ accountId: string; displayName: string; email: string } | null> {
  const code = sessionStorage.getItem('spotify_oauth_code');
  const state = sessionStorage.getItem('spotify_oauth_state');
  const verifier = sessionStorage.getItem('spotify_pkce_verifier');
  const expectedState = sessionStorage.getItem('spotify_pkce_state');
  const redirectUri = sessionStorage.getItem('spotify_pkce_redirect_uri') || getRedirectUri();

  const error = sessionStorage.getItem('spotify_oauth_error');

  // Clear all session keys
  sessionStorage.removeItem('spotify_oauth_code');
  sessionStorage.removeItem('spotify_oauth_state');
  sessionStorage.removeItem('spotify_oauth_error');
  sessionStorage.removeItem('spotify_pkce_verifier');
  sessionStorage.removeItem('spotify_pkce_state');
  sessionStorage.removeItem('spotify_pkce_redirect_uri');

  if (error) throw new Error(`Spotify error: ${error}`);
  if (!code || !verifier) return null;
  if (state !== expectedState) throw new Error('OAuth state mismatch');

  return api.exchangeToken({ code, codeVerifier: verifier, redirectUri });
}

export function useSpotifyAuth(clientId: string) {
  const login = async (): Promise<{ accountId: string; displayName: string; email: string } | null> => {
    if (!clientId) throw new Error('SPOTIFY_CLIENT_ID non configuré');

    if (Platform.OS === 'web') {
      // Redirects the page — promise never resolves here; AccountsScreen handles the return
      return loginWeb(clientId);
    }

    // Native: use WebBrowser in-app tab
    const { default: WebBrowser } = await import('expo-web-browser');
    const verifier = await generateCodeVerifier();
    const challenge = await generateCodeChallenge(verifier);
    const state = Math.random().toString(36).substring(2, 15);
    const redirectUri = getRedirectUri();

    const params = new URLSearchParams({
      client_id: clientId,
      response_type: 'code',
      redirect_uri: redirectUri,
      code_challenge_method: 'S256',
      code_challenge: challenge,
      state,
      scope: SPOTIFY_SCOPES,
    });

    const authUrl = `https://accounts.spotify.com/authorize?${params.toString()}`;
    const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);

    if (result.type !== 'success') return null;

    const url = new URL(result.url);
    const code = url.searchParams.get('code');
    const returnedState = url.searchParams.get('state');

    if (!code || returnedState !== state) throw new Error('OAuth state mismatch ou code manquant');

    return api.exchangeToken({ code, codeVerifier: verifier, redirectUri });
  };

  return { login, ready: true };
}
