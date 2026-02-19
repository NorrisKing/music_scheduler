import { useEffect, useRef } from 'react';
import { View, ActivityIndicator, Text } from 'react-native';

// On web, Spotify redirects back to this URL with ?code=...&state=...
// Instead of using expo-router params (which load async), read directly from window.location.search
export default function SpotifyCallbackScreen() {
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;

    if (typeof window === 'undefined') return;

    const search = window.location.search;
    const urlParams = new URLSearchParams(search);
    const code = urlParams.get('code');
    const state = urlParams.get('state');
    const error = urlParams.get('error');

    if (error) {
      sessionStorage.setItem('spotify_oauth_error', error);
    } else if (code && state) {
      sessionStorage.setItem('spotify_oauth_code', code);
      sessionStorage.setItem('spotify_oauth_state', state);
    }

    // Hard redirect to /accounts so the page fully reloads with sessionStorage populated
    window.location.replace('/accounts');
  }, []);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#09090b' }}>
      <ActivityIndicator size="large" color="#1DB954" />
      <Text style={{ marginTop: 16, color: '#a1a1aa' }}>Connexion en cours...</Text>
    </View>
  );
}
