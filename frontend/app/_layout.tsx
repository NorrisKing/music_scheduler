import '@/global.css';

import { NAV_THEME } from '@/lib/theme';
import { ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'nativewind';
import { ErrorBoundary } from './error-boundary';
import { useState, useEffect } from 'react';
import LoginScreen from './login';

function isAuthenticated() {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem('auth') === '1';
}

export default function RootLayout() {
  const { setColorScheme } = useColorScheme();
  const [authed, setAuthed] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    setColorScheme('dark');
    setAuthed(isAuthenticated());
    setChecked(true);
  }, []);

  if (!checked) return null;

  if (!authed) {
    return <LoginScreen onLogin={() => setAuthed(true)} />;
  }

  return (
    <ErrorBoundary>
      <ThemeProvider value={NAV_THEME.dark}>
        <StatusBar style="light" />
        <Stack>
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen
            name="accounts"
            options={{ title: 'Comptes Spotify', headerBackTitle: 'Retour' }}
          />
          <Stack.Screen
            name="schedules"
            options={{ title: 'Planifications', headerBackTitle: 'Retour' }}
          />
          <Stack.Screen
            name="new-schedule"
            options={{ title: 'Nouvelle planification', headerBackTitle: 'Retour', presentation: 'modal' }}
          />
        </Stack>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
