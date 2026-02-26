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
import { PlusCircleIcon, UserCircleIcon, ChevronRightIcon, LogOutIcon } from 'lucide-react-native';
import { api, BACKEND_URL, type SpotifyAccount } from '@/lib/api';
import { useSpotifyAuth, finishWebLogin } from '@/lib/useSpotifyAuth';

const CLIENT_ID = process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_ID || '';

export default function AccountsScreen() {
  const [accounts, setAccounts] = useState<SpotifyAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const { login, ready } = useSpotifyAuth(CLIENT_ID);

    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
      try {
        setError(null);
        const data = await api.getAccounts();
        setAccounts(data);
      } catch (e: any) {
        console.error(e);
        setError(e.message || 'Impossible de charger les comptes');
      } finally {
        setLoading(false);
      }
    }, []);

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
      connectingRef.current = true;
      setConnecting(true);
      finishWebLogin()
        .then(async (result) => {
          if (result) {
            console.log('Successfully connected:', result);
          }
        })
        .catch((e: any) => {
          console.error('Connection failed:', e);
          Alert.alert('Erreur', e.message || 'Connexion échouée');
        })
        .finally(async () => {
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
      const result = await login();
      // On web this never reaches here (page redirects); on native it does
      if (result) {
        Alert.alert('Compte connecté', `${result.displayName} ajouté avec succès !`);
        await load();
      }
    } catch (e: any) {
      Alert.alert('Erreur', e.message || 'Connexion échouée');
    } finally {
      setConnecting(false);
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
            <View className="absolute bottom-2 left-0 right-0 items-center">
              <Text style={{ fontSize: 8, color: '#333' }}>
                Backend: {BACKEND_URL}
              </Text>
            </View>
          )}
        </View>
    </>
  );
}
