import { Link, Stack } from 'expo-router';
import { View, Text, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { CalendarDaysIcon, UsersIcon, MusicIcon, RadioIcon } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';

interface AccountStatus {
  accountId: string;
  displayName: string;
    currentlyPlaying: {
      isPlaying: boolean;
      trackName: string;
      artistName: string;
      playlistName: string | null;
      albumImageUrl?: string;
      isFallback?: boolean;
    } | null;
  }


export default function HomeScreen() {
  const { colorScheme, toggleColorScheme } = useColorScheme();
  const [statuses, setStatuses] = useState<AccountStatus[]>([]);
  const [loading, setLoading] = useState(true);

  const loadStatuses = useCallback(async () => {
    try {
      const data = await api.getAccountsStatus();
      setStatuses(data);
    } catch (e) {
      console.error('Failed to fetch statuses', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStatuses();
    const interval = setInterval(loadStatuses, 20000);
    return () => clearInterval(interval);
  }, [loadStatuses]);

  const activeAccounts = statuses.filter(s => s.currentlyPlaying?.isPlaying);

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Spotify Scheduler',
          headerRight: () => (
            <TouchableOpacity onPress={toggleColorScheme} className="p-2">
              <Text className="text-foreground">{colorScheme === 'dark' ? '☀️' : '🌙'}</Text>
            </TouchableOpacity>
          ),
        }}
      />
      <View className="flex-1 bg-background p-6">
        {/* Header */}
        <View className="mb-8 items-center pt-6">
          <View className="mb-4 h-20 w-20 items-center justify-center rounded-full bg-[#1DB954]">
            <MusicIcon size={40} color="white" />
          </View>
          <Text className="text-foreground text-3xl font-bold">Spotify Scheduler</Text>
          <Text className="mt-2 text-center text-muted-foreground">
            Programmez vos playlists sur plusieurs comptes Spotify
          </Text>
        </View>

        {/* Live Status Section */}
        {activeAccounts.length > 0 && (
          <View className="mb-8 rounded-2xl bg-[#1DB954]/5 border border-[#1DB954]/20 p-4">
            <View className="flex-row items-center gap-2 mb-4">
              <View className="h-2 w-2 rounded-full bg-[#1DB954]" />
              <Text className="text-[10px] font-black uppercase tracking-widest text-[#1DB954]">
                EN DIRECT
              </Text>
            </View>
            
            <View className="gap-3">
              {activeAccounts.map((acc) => (
                <View key={acc.accountId} className="flex-row items-center gap-3">
                  <View className="h-10 w-10 items-center justify-center rounded-lg bg-[#1DB954]/20 overflow-hidden">
                    {acc.currentlyPlaying?.albumImageUrl ? (
                      <Image source={{ uri: acc.currentlyPlaying.albumImageUrl }} style={{ width: '100%', height: '100%' }} />
                    ) : (
                      <RadioIcon size={20} color="#1DB954" />
                    )}
                  </View>
                    <View className="flex-1">
                      <Text className="text-xs font-black text-foreground" numberOfLines={1}>
                        {acc.displayName} • <Text className="text-[#1DB954]">{acc.currentlyPlaying?.playlistName || 'Direct'}</Text>
                        {acc.currentlyPlaying?.isFallback && (
                          <Text className="text-[8px] font-bold text-muted-foreground italic"> (Planifié)</Text>
                        )}
                      </Text>
                      <Text className="text-[10px] text-muted-foreground" numberOfLines={1}>
                        {acc.currentlyPlaying?.trackName} - {acc.currentlyPlaying?.artistName}
                      </Text>
                    </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Nav cards */}
        <View className="gap-4">
          <Link href="/accounts" asChild>
            <TouchableOpacity className="flex-row items-center gap-4 rounded-2xl border border-border bg-card p-5">
              <View className="h-12 w-12 items-center justify-center rounded-xl bg-[#1DB954]/15">
                <UsersIcon size={24} color="#1DB954" />
              </View>
              <View className="flex-1">
                <View className="flex-row items-center gap-2">
                  <Text className="text-foreground text-lg font-semibold">Comptes Spotify</Text>
                  {activeAccounts.length > 0 && (
                    <View className="bg-[#1DB954] rounded-full px-1.5 py-0.5">
                      <Text className="text-[8px] font-black text-white">{activeAccounts.length} LIVE</Text>
                    </View>
                  )}
                </View>
                <Text className="text-muted-foreground text-sm">
                  Connecter et gérer vos comptes
                </Text>
              </View>
              <Text className="text-muted-foreground">›</Text>
            </TouchableOpacity>
          </Link>

          <Link href="/schedules" asChild>
            <TouchableOpacity className="flex-row items-center gap-4 rounded-2xl border border-border bg-card p-5">
              <View className="h-12 w-12 items-center justify-center rounded-xl bg-blue-500/15">
                <CalendarDaysIcon size={24} color="#3b82f6" />
              </View>
              <View className="flex-1">
                <Text className="text-foreground text-lg font-semibold">Planifications</Text>
                <Text className="text-muted-foreground text-sm">
                  Programmer vos playlists
                </Text>
              </View>
              <Text className="text-muted-foreground">›</Text>
            </TouchableOpacity>
          </Link>
        </View>

        {/* Info */}
        <View className="mt-8 rounded-2xl bg-muted p-4">
          <Text className="mb-1 font-semibold text-foreground">Comment ça marche ?</Text>
          <Text className="text-sm text-muted-foreground">
            1. Connectez vos comptes Spotify{'\n'}
            2. Créez une planification (playlist + jours + heure){'\n'}
            3. Le serveur déclenchera la lecture automatiquement
          </Text>
        </View>
      </View>
    </>
  );
}
