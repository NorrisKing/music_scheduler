import { useEffect } from 'react';
import { View, ActivityIndicator, Text } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';

// This page receives the OAuth redirect from Spotify (web mode).
// It reads the code+state from the URL, stores them, then closes itself.
export default function SpotifyCallbackScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ code?: string; state?: string; error?: string }>();

  useEffect(() => {
    const { code, state, error } = params;

    if (error) {
      // Store error so accounts page can read it
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem('spotify_oauth_error', error);
      }
      router.replace('/accounts');
      return;
    }

    if (code && state) {
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem('spotify_oauth_code', code);
        window.sessionStorage.setItem('spotify_oauth_state', state);
      }
    }

    router.replace('/accounts');
  }, []);

  return (
    <View className="flex-1 items-center justify-center bg-background">
      <ActivityIndicator size="large" color="#1DB954" />
      <Text className="mt-4 text-muted-foreground">Connexion en cours...</Text>
    </View>
  );
}
