import { Link, Stack } from 'expo-router';
import { View, Text, TouchableOpacity, Image, ActivityIndicator, ScrollView } from 'react-native';
import { CalendarDaysIcon, UsersIcon, RadioIcon, ChevronRightIcon } from 'lucide-react-native';
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
      <Stack.Screen options={{ title: 'Control Room' }} />
      <ScrollView className="flex-1 bg-background px-5" contentContainerStyle={{ paddingBottom: 40 }}>

        {/* Hero */}
        <View className="pt-10 pb-8 items-center">
          <Image
            source={require('../assets/images/control-room-logo.png')}
            style={{ width: '100%', aspectRatio: 3.1 }}
            resizeMode="contain"
          />
          <Text className="mt-3 text-center text-sm text-muted-foreground leading-relaxed px-4">
            The Music ? We take care of it.
          </Text>
        </View>

        {/* En direct */}
        {loading ? (
          <View className="mb-6 items-center py-2">
            <ActivityIndicator color="#1DB954" size="small" />
          </View>
        ) : activeAccounts.length > 0 && (
          <View className="mb-6 rounded-2xl bg-[#1DB954]/5 border border-[#1DB954]/20 p-4">
            <View className="flex-row items-center gap-2 mb-3">
              <View className="h-2 w-2 rounded-full bg-[#1DB954]" style={{ shadowColor: '#1DB954', shadowRadius: 4, shadowOpacity: 0.8 }} />
              <Text className="text-[10px] font-black uppercase tracking-widest text-[#1DB954]">
                En direct · {activeAccounts.length} compte{activeAccounts.length > 1 ? 's' : ''}
              </Text>
            </View>

            <View className="gap-3">
              {activeAccounts.map((acc) => (
                <View key={acc.accountId} className="flex-row items-center gap-3">
                  <View className="h-10 w-10 items-center justify-center rounded-lg bg-[#1DB954]/20 overflow-hidden flex-shrink-0">
                    {acc.currentlyPlaying?.albumImageUrl ? (
                      <Image source={{ uri: acc.currentlyPlaying.albumImageUrl }} style={{ width: '100%', height: '100%' }} />
                    ) : (
                      <RadioIcon size={18} color="#1DB954" />
                    )}
                  </View>
                  <View className="flex-1">
                    <Text className="text-xs font-black text-foreground" numberOfLines={1}>
                      {acc.displayName}
                      {acc.currentlyPlaying?.playlistName
                        ? <Text className="text-[#1DB954]"> · {acc.currentlyPlaying.playlistName}</Text>
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
              <View className="h-12 w-12 items-center justify-center rounded-2xl bg-[#1DB954]/15">
                <UsersIcon size={24} color="#1DB954" />
              </View>
              <View className="flex-1">
                <View className="flex-row items-center gap-2">
                  <Text className="text-foreground text-base font-bold">Comptes Spotify</Text>
                  {activeAccounts.length > 0 && (
                    <View className="bg-[#1DB954] rounded-full px-1.5 py-0.5">
                      <Text className="text-[8px] font-black text-white">{activeAccounts.length} LIVE</Text>
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
              <ChevronRightIcon size={18} color="#6b7280" />
            </TouchableOpacity>
          </Link>

          <Link href="/schedules" asChild>
            <TouchableOpacity className="flex-row items-center gap-4 rounded-2xl border border-border bg-card p-5 active:opacity-70">
              <View className="h-12 w-12 items-center justify-center rounded-2xl bg-blue-500/15">
                <CalendarDaysIcon size={24} color="#3b82f6" />
              </View>
              <View className="flex-1">
                <Text className="text-foreground text-base font-bold">Planifications</Text>
                <Text className="text-muted-foreground text-sm mt-0.5">Programmer vos playlists</Text>
              </View>
              <ChevronRightIcon size={18} color="#6b7280" />
            </TouchableOpacity>
          </Link>
        </View>

      </ScrollView>
    </>
  );
}
