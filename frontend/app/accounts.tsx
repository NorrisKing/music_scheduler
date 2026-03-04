import { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Stack, router } from 'expo-router';
import { PlusCircleIcon, UserCircleIcon, ChevronRightIcon, LogOutIcon, MusicIcon } from 'lucide-react-native';
import { api, BACKEND_URL, type SpotifyAccount } from '@/lib/api';
import { useSpotifyAuth, finishWebLogin } from '@/lib/useSpotifyAuth';

interface AccountStatus {
  accountId: string;
  displayName: string;
  currentlyPlaying: {
    isPlaying: boolean;
    trackName: string;
    artistName: string;
    playlistName: string | null;
    albumImageUrl?: string;
  } | null;
}

export default function AccountsScreen() {
  const [accounts, setAccounts] = useState<SpotifyAccount[]>([]);
  const [statuses, setStatuses] = useState<Record<string, AccountStatus['currentlyPlaying']>>({});
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const { login, ready } = useSpotifyAuth(CLIENT_ID);

  const [error, setError] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    try {
      const data = await api.getAccountsStatus();
      const newStatuses: Record<string, AccountStatus['currentlyPlaying']> = {};
      data.forEach(s => {
        newStatuses[s.accountId] = s.currentlyPlaying;
      });
      setStatuses(newStatuses);
    } catch (e) {
      console.error('Failed to fetch statuses', e);
    }
  }, []);

  const load = useCallback(async () => {
    try {
      setError(null);
      const data = await api.getAccounts();
      setAccounts(data);
      await loadStatus();
    } catch (e: any) {
      console.error(e);
      setError(e.message || 'Impossible de charger les comptes');
    } finally {
      setLoading(false);
    }
  }, [loadStatus]);

  useEffect(() => {
    const interval = setInterval(loadStatus, 15000);
    return () => clearInterval(interval);
  }, [loadStatus]);


  const connectingRef = useRef(false);

  // On web: check if we're returning from a Spotify OAuth redirect
  useEffect(() => {
    if (Platform.OS !== 'web') {
      load();
      return;
    }

    const hasCode = typeof window !== 'undefined' &&
      (sessionStorage.getItem('spotify_oauth_code') || sessionStorage.getItem('spotify_oauth_error'));

    if (hasCode && !connectingRef.current) {
      console.log('Detected OAuth code in session storage, starting exchange...');
      connectingRef.current = true;
      setConnecting(true);
      finishWebLogin()
        .then(async (result) => {
          if (result) {
            console.log('Successfully connected:', result);
            Alert.alert('Succès', `Compte ${result.displayName} connecté !`);
          }
        })
        .catch((e: any) => {
          console.error('Connection failed:', e);
          setError(`Erreur d'échange de jeton: ${e.message}`);
          Alert.alert('Erreur', e.message || 'Connexion échouée');
        })
        .finally(async () => {
          console.log('Finishing connection process, reloading accounts...');
          setConnecting(false);
          await load();
          connectingRef.current = false;
        });
    } else if (!connectingRef.current) {
      load();
    }
  }, [load]);

  const handleConnect = async () => {
    if (!CLIENT_ID) {
      Alert.alert(
        'Configuration manquante',
        'Veuillez configurer EXPO_PUBLIC_SPOTIFY_CLIENT_ID dans votre fichier .env.local'
      );
      return;
    }
    setConnecting(true);
    try {
      console.log('Starting Spotify login redirect...');
      const result = await login();
      // On web this never reaches here (page redirects); on native it does
      if (result) {
        Alert.alert('Compte connecté', `${result.displayName} ajouté avec succès !`);
        await load();
      }
    } catch (e: any) {
      console.error('Login launch failed:', e);
      Alert.alert('Erreur', e.message || 'Connexion échouée');
    } finally {
      setConnecting(false);
    }
  };

  const handleReset = () => {
    if (typeof window !== 'undefined') {
      sessionStorage.clear();
      window.location.reload();
    }
  };

    const renderAccount = ({ item }: { item: SpotifyAccount }) => (
      <TouchableOpacity
        onPress={() => router.push({ pathname: '/schedules', params: { accountId: item.id, accountName: item.displayName } })}
        className="mb-3 flex-row items-center gap-3 rounded-2xl border border-border bg-card p-4 active:opacity-70">
        <View className="h-12 w-12 items-center justify-center rounded-full bg-[#1DB954]/20">
          <UserCircleIcon size={28} color="#1DB954" />
        </View>
        <View className="flex-1">
          <Text className="text-foreground font-semibold">{item.displayName}</Text>
          <Text className="text-sm text-muted-foreground">{item.email}</Text>
        </View>
        <ChevronRightIcon size={20} color="#6b7280" />
      </TouchableOpacity>
    );

  return (
    <>
      <Stack.Screen options={{
        title: 'Comptes Spotify',
        headerRight: () => (
          <TouchableOpacity
            onPress={() => {
              if (window.confirm('Se déconnecter de l\'application ?')) {
                localStorage.removeItem('auth');
                window.location.reload();
              }
            }}
            style={{ marginRight: 8, padding: 4 }}>
            <LogOutIcon size={22} color="#ef4444" />
          </TouchableOpacity>
        ),
      }} />
      <View className="flex-1 bg-background p-4">
          {loading || connecting ? (
            <View className="flex-1 items-center justify-center">
              <ActivityIndicator size="large" color="#1DB954" />
              {connecting && (
                <Text className="mt-4 text-muted-foreground">
                  {sessionStorage && sessionStorage.getItem('spotify_pkce_verifier')
                    ? 'Connexion à Spotify...'
                    : 'Finalisation de la connexion...'}
                </Text>
              )}
            </View>
            ) : error ? (
              <View className="flex-1 items-center justify-center p-4">
                <Text className="text-red-500 font-bold mb-2">Erreur de connexion au serveur</Text>
                <Text className="text-muted-foreground text-center mb-6">{error}</Text>
                <View className="flex-row gap-4">
                  <TouchableOpacity
                    onPress={load}
                    className="bg-card border border-border px-6 py-2 rounded-xl">
                    <Text className="text-foreground">Réessayer</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleReset}
                    className="bg-red-500/10 border border-red-500/20 px-6 py-2 rounded-xl">
                    <Text className="text-red-500">Réinitialiser</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (

          <FlatList
            data={accounts}
            keyExtractor={(i) => i.id}
            renderItem={renderAccount}
            ListEmptyComponent={
              <View className="mt-16 items-center">
                <UserCircleIcon size={56} color="#6b7280" />
                <Text className="mt-4 text-center text-lg font-semibold text-foreground">
                  Aucun compte connecté
                </Text>
                <Text className="mt-2 text-center text-muted-foreground">
                  Appuyez sur le bouton ci-dessous pour connecter votre premier compte Spotify
                </Text>
              </View>
            }
            ListHeaderComponent={
              accounts.length > 0 ? (
                <Text className="mb-3 text-sm text-muted-foreground">
                  {accounts.length} compte{accounts.length > 1 ? 's' : ''} connecté{accounts.length > 1 ? 's' : ''}
                </Text>
              ) : null
            }
            contentContainerStyle={{ paddingBottom: 100 }}
          />
        )}

          <TouchableOpacity
            onPress={handleConnect}
            disabled={!ready || connecting || loading}
            className="absolute bottom-8 left-4 right-4 flex-row items-center justify-center gap-3 rounded-2xl bg-[#1DB954] py-4 disabled:opacity-50">
            {connecting ? (
              <ActivityIndicator color="white" />
            ) : (
              <PlusCircleIcon size={22} color="white" />
            )}
            <Text className="text-base font-bold text-white">
              {connecting ? 'Connexion en cours...' : 'Connecter un compte Spotify'}
            </Text>
          </TouchableOpacity>

            {/* Debug info - only visible in dev or if specific env is set */}
            {(__DEV__ || true) && (
              <View className="absolute bottom-1 left-0 right-0 items-center bg-black/10 py-2 border-t border-black/10">
                <Text style={{ fontSize: 9, color: BACKEND_URL.includes('vercel.app') ? 'red' : '#666', fontWeight: 'bold' }}>
                  DEBUG - Backend: {BACKEND_URL || 'VIDE'}
                </Text>
                <Text style={{ fontSize: 8, color: '#999' }}>
                  Raw Env: {process.env.EXPO_PUBLIC_BACKEND_URL || 'ABSENTE'}
                </Text>
                {BACKEND_URL.includes('vercel.app') && (
                  <Text style={{ fontSize: 7, color: 'red', marginTop: 2 }}>
                    ⚠️ ERREUR: Votre variable pointe sur Vercel, pas sur Railway !
                  </Text>
                )}
              </View>
            )}

        </View>
    </>
  );
}
