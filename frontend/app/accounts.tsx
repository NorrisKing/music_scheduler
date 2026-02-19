import { useEffect, useState, useCallback } from 'react';
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
import { PlusCircleIcon, TrashIcon, UserCircleIcon, CalendarPlusIcon } from 'lucide-react-native';
import { api, type SpotifyAccount } from '@/lib/api';
import { useSpotifyAuth, finishWebLogin } from '@/lib/useSpotifyAuth';

const CLIENT_ID = process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_ID || '';

export default function AccountsScreen() {
  const [accounts, setAccounts] = useState<SpotifyAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const { login, ready } = useSpotifyAuth(CLIENT_ID);

  const load = useCallback(async () => {
    try {
      const data = await api.getAccounts();
      setAccounts(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  // On web: check if we're returning from a Spotify OAuth redirect
  useEffect(() => {
    if (Platform.OS !== 'web') {
      load();
      return;
    }

    const hasCode = typeof window !== 'undefined' &&
      (sessionStorage.getItem('spotify_oauth_code') || sessionStorage.getItem('spotify_oauth_error'));

    if (hasCode) {
      setConnecting(true);
      finishWebLogin()
        .then(async (result) => {
          if (result) {
            Alert.alert('Compte connecté', `${result.displayName} ajouté avec succès !`);
          }
        })
        .catch((e: any) => {
          Alert.alert('Erreur', e.message || 'Connexion échouée');
        })
        .finally(async () => {
          setConnecting(false);
          await load();
        });
    } else {
      load();
    }
  }, []);

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

  const handleDelete = (account: SpotifyAccount) => {
    Alert.alert(
      'Supprimer le compte',
      `Supprimer ${account.displayName} ? Toutes ses planifications seront supprimées.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            await api.deleteAccount(account.id);
            await load();
          },
        },
      ]
    );
  };

  const renderAccount = ({ item }: { item: SpotifyAccount }) => (
    <TouchableOpacity
      onPress={() => router.push({ pathname: '/new-schedule', params: { accountId: item.id } })}
      className="mb-3 flex-row items-center gap-3 rounded-2xl border border-border bg-card p-4 active:opacity-70">
      <View className="h-12 w-12 items-center justify-center rounded-full bg-[#1DB954]/20">
        <UserCircleIcon size={28} color="#1DB954" />
      </View>
      <View className="flex-1">
        <Text className="text-foreground font-semibold">{item.displayName}</Text>
        <Text className="text-sm text-muted-foreground">{item.email}</Text>
      </View>
      <TouchableOpacity
        onPress={(e) => { e.stopPropagation(); handleDelete(item); }}
        className="rounded-lg p-2">
        <TrashIcon size={20} color="#ef4444" />
      </TouchableOpacity>
      <View className="rounded-lg p-2">
        <CalendarPlusIcon size={20} color="#1DB954" />
      </View>
    </TouchableOpacity>
  );

  return (
    <>
      <Stack.Screen options={{ title: 'Comptes Spotify' }} />
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
      </View>
    </>
  );
}
