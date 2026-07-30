import { Link, Stack } from 'expo-router';
import { View, Text, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { CalendarDaysIcon, UsersIcon, MusicIcon, RadioIcon, ChevronRightIcon } from 'lucide-react-native';
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
          title: 'Sonora',
          headerRight: () => (
            <TouchableOpacity onPress={toggleColorScheme} className="p-2">
              <Text className="text-lg">{colorScheme === 'dark' ? '☀️' : '🌙'}</Text>
            </TouchableOpacity>
          ),
        }}
      />
      <View className="flex-1 bg-background px-5">

        {/* Hero */}
        <View className="pt-10 pb-8 items-center">
          <View className="mb-5 h-20 w-20 items-center justify-center rounded-3xl bg-[#c9a227]">
            <MusicIcon size={40} color="white" />
          </View>
          <Text style={{ fontFamily: 'PlayfairDisplay' }} className="text-foreground text-3xl font-semibold tracking-tight">Sonora</Text>
          <Text className="mt-2 text-center text-sm text-muted-foreground leading-relaxed px-4">
            L'ambiance, à l'heure près
          </Text>
        </View>

        {/* En direct */}
        {loading ? (
          <View className="mb-6 items-center py-2">
            <ActivityIndicator color="#c9a227" size="small" />
          </View>
        ) : activeAccounts.length > 0 && (
          <View className="mb-6 rounded-2xl bg-[#c9a227]/5 border border-[#c9a227]/20 p-4">
            <View className="flex-row items-center gap-2 mb-3">
              <View className="h-2 w-2 rounded-full bg-[#c9a227]" style={{ shadowColor: '#c9a227', shadowRadius: 4, shadowOpacity: 0.8 }} />
              <Text className="text-[10px] font-black uppercase tracking-widest text-[#c9a227]">
                En direct · {activeAccounts.length} compte{activeAccounts.length > 1 ? 's' : ''}
              </Text>
            </View>

            <View className="gap-3">
              {activeAccounts.map((acc) => (
                <View key={acc.accountId} className="flex-row items-center gap-3">
                  <View className="h-10 w-10 items-center justify-center rounded-lg bg-[#c9a227]/20 overflow-hidden flex-shrink-0">
                    {acc.currentlyPlaying?.albumImageUrl ? (
                      <Image source={{ uri: acc.currentlyPlaying.albumImageUrl }} style={{ width: '100%', height: '100%' }} />
                    ) : (
                      <RadioIcon size={18} color="#c9a227" />
                    )}
                  </View>
                  <View className="flex-1">
                    <Text className="text-xs font-black text-foreground" numberOfLines={1}>
                      {acc.displayName}
                      {acc.currentlyPlaying?.playlistName
                        ? <Text className="text-[#c9a227]"> · {acc.currentlyPlaying.playlistName}</Text>
                        : <Text className="text-muted-foreground"> · Lecture directe</Text>
                      }
                    </Text>
                    <Text className="text-[10px] text-muted-foreground" numberOfLines={1}>
                      {acc.currentlyPlaying?.trackName} — {acc.currentlyPlaying?.artistName}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Navigation */}
        <View className="gap-3">
          <Link href="/accounts" asChild>
            <TouchableOpacity className="flex-row items-center gap-4 rounded-2xl border border-border bg-card p-5 active:opacity-70">
              <View className="h-12 w-12 items-center justify-center rounded-2xl bg-[#c9a227]/15">
                <UsersIcon size={24} color="#c9a227" />
              </View>
              <View className="flex-1">
                <View className="flex-row items-center gap-2">
                  <Text className="text-foreground text-base font-bold">Comptes Spotify</Text>
                  {activeAccounts.length > 0 && (
                    <View className="bg-[#c9a227] rounded-full px-1.5 py-0.5">
                      <Text className="text-[8px] font-black text-[#0b0b0a]">{activeAccounts.length} LIVE</Text>
                    </View>
                  )}
                </View>
                <Text className="text-muted-foreground text-sm mt-0.5">
                  {statuses.length > 0
                    ? `${statuses.length} compte${statuses.length > 1 ? 's' : ''} connecté${statuses.length > 1 ? 's' : ''}`
                    : 'Connecter et gérer vos comptes'
                  }
                </Text>
              </View>
              <ChevronRightIcon size={18} color="#8a7c5f" />
            </TouchableOpacity>
          </Link>

          <Link href="/schedules" asChild>
            <TouchableOpacity className="flex-row items-center gap-4 rounded-2xl border border-border bg-card p-5 active:opacity-70">
              <View className="h-12 w-12 items-center justify-center rounded-2xl bg-[#b5651d]/15">
                <CalendarDaysIcon size={24} color="#b5651d" />
              </View>
              <View className="flex-1">
                <Text className="text-foreground text-base font-bold">Planifications</Text>
                <Text className="text-muted-foreground text-sm mt-0.5">Programmer vos playlists</Text>
              </View>
              <ChevronRightIcon size={18} color="#8a7c5f" />
            </TouchableOpacity>
          </Link>
        </View>

        {/* Comment ça marche */}
        <View className="mt-6 rounded-2xl bg-muted p-4">
          <Text className="mb-2 font-bold text-foreground text-sm">Comment ça marche</Text>
          <View className="gap-1.5">
            {[
              '1.  Connectez vos comptes Spotify',
              '2.  Créez une planification (playlist + jours + heure)',
              '3.  Le serveur démarre la lecture automatiquement',
            ].map((step, i) => (
              <Text key={i} className="text-sm text-muted-foreground">{step}</Text>
            ))}
          </View>
        </View>

      </View>
    </>
  );
}
