import { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Alert,
  ActivityIndicator,
  Platform,
  Image,
} from 'react-native';
import { Stack, router } from 'expo-router';
import { PlusCircleIcon, UserCircleIcon, ChevronRightIcon, LogOutIcon, MusicIcon } from 'lucide-react-native';
import { api, type SpotifyAccount } from '@/lib/api';
import { useSpotifyAuth, finishWebLogin } from '@/lib/useSpotifyAuth';

const CLIENT_ID = process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_ID || '';

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
    const interval = setInterval(loadStatus, 60000);
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

    const renderAccount = ({ item }: { item: SpotifyAccount }) => {
      const status = statuses[item.id];
      return (
        <TouchableOpacity
          onPress={() => router.push({ pathname: '/schedules', params: { accountId: item.id, accountName: item.displayName } })}
          className="mb-3 rounded-2xl border border-border bg-card active:opacity-70 overflow-hidden">
          <View className="flex-row items-center gap-3 p-4">
            <View className="h-12 w-12 items-center justify-center rounded-full bg-[#c9a227]/20">
              <UserCircleIcon size={28} color="#c9a227" />
            </View>
            <View className="flex-1">
              <Text className="text-foreground font-semibold">{item.displayName}</Text>
              <Text className="text-sm text-muted-foreground">{item.email}</Text>
            </View>
            <ChevronRightIcon size={20} color="#8a7c5f" />
          </View>

          {status && (
            <View className="bg-[#c9a227]/5 border-t border-[#c9a227]/10 p-3 flex-row items-center gap-3">
              {status.albumImageUrl ? (
                <Image 
                  source={{ uri: status.albumImageUrl }} 
                  style={{ width: 32, height: 32, borderRadius: 4 }} 
                />
              ) : (
                <View className="h-8 w-8 items-center justify-center rounded-md bg-[#c9a227]/20">
                  <MusicIcon size={16} color="#c9a227" />
                </View>
              )}
              <View className="flex-1">
                <View className="flex-row items-center gap-1.5 mb-0.5">
                  <View className={`h-1.5 w-1.5 rounded-full ${status.isPlaying ? 'bg-[#c9a227]' : 'bg-muted-foreground'}`} />
                  <Text className="text-[9px] font-black uppercase tracking-widest text-[#c9a227]">
                    {status.isPlaying ? 'LECTURE' : 'PAUSE'}
                  </Text>
                </View>
                <Text className="text-xs font-bold text-foreground" numberOfLines={1}>
                  {status.trackName} • <Text className="text-muted-foreground font-medium">{status.artistName}</Text>
                </Text>
                  {status.playlistName && (
                    <Text className="text-[10px] text-[#c9a227] font-medium" numberOfLines={1}>
                      {status.playlistName}
                    </Text>
                  )}
              </View>
            </View>
          )}
        </TouchableOpacity>
      );
    };

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
              <ActivityIndicator size="large" color="#c9a227" />
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
                <UserCircleIcon size={56} color="#8a7c5f" />
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
            className="absolute bottom-8 left-4 right-4 flex-row items-center justify-center gap-3 rounded-2xl bg-[#c9a227] py-4 disabled:opacity-50">
            {connecting ? (
              <ActivityIndicator color="white" />
            ) : (
              <PlusCircleIcon size={22} color="white" />
            )}
            <Text className="text-base font-bold text-white">
              {connecting ? 'Connexion en cours...' : 'Connecter un compte Spotify'}
            </Text>
          </TouchableOpacity>


        </View>
    </>
  );
}
