import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri, useAuthRequest } from 'expo-auth-session';
import { api } from './api';

WebBrowser.maybeCompleteAuthSession();

const SPOTIFY_SCOPES = [
  'user-read-email',
  'user-read-private',
  'playlist-read-private',
  'playlist-read-collaborative',
  'user-read-playback-state',
  'user-modify-playback-state',
];

const discovery = {
  authorizationEndpoint: 'https://accounts.spotify.com/authorize',
  tokenEndpoint: 'https://accounts.spotify.com/api/token',
};

export function useSpotifyAuth(clientId: string) {
  const redirectUri = makeRedirectUri({ scheme: 'spotifyscheduler' });

  const [request, response, promptAsync] = useAuthRequest(
    {
      clientId,
      scopes: SPOTIFY_SCOPES,
      usePKCE: true,
      redirectUri,
    },
    discovery
  );

  const login = async (): Promise<{ accountId: string; displayName: string; email: string } | null> => {
    const result = await promptAsync();

    if (result.type !== 'success') return null;

    const { code } = result.params;
    const codeVerifier = request?.codeVerifier;

    if (!code || !codeVerifier) return null;

    return api.exchangeToken({ code, codeVerifier, redirectUri });
  };

  return { login, ready: !!request };
}
