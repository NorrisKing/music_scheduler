import { useCallback } from 'react';
import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { Stack, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { PlusCircleIcon, CalendarIcon, PlayCircleIcon, Trash2Icon, ToggleLeftIcon, ToggleRightIcon, ChevronRightIcon, ShuffleIcon, TrashIcon, MusicIcon } from 'lucide-react-native';
import { api, type Schedule } from '@/lib/api';

const DAYS_SHORT = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];

function pad(n: number) {
  return String(n).padStart(2, '0');
}

export default function SchedulesScreen() {
  const { accountId, accountName: accountNameParam } = useLocalSearchParams<{ accountId?: string; accountName?: string }>();
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolvedName, setResolvedName] = useState<string>(accountNameParam || '');
  const [currentlyPlaying, setCurrentlyPlaying] = useState<{
    isPlaying: boolean;
    trackName: string;
    artistName: string;
    playlistName: string | null;
    albumImageUrl?: string;
  } | null>(null);

  const load = useCallback(async () => {
    try {
      const [all, accounts] = await Promise.all([
        api.getSchedules(),
        api.getAccounts(),
      ]);
      const filtered = accountId
        ? all.filter((s) => s.accountId === accountId)
        : all;
      setSchedules(filtered.sort((a, b) => a.hour * 60 + a.minute - (b.hour * 60 + b.minute)));
      if (accountId && !accountNameParam) {
        const found = accounts.find((a) => a.id === accountId);
        if (found) setResolvedName(found.displayName);
      }

      if (accountId) {
        try {
          const cp = await api.getCurrentlyPlaying(accountId);
          setCurrentlyPlaying(cp);
        } catch (e) {
          console.error('Failed to fetch currently playing', e);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [accountId, accountNameParam]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleDeleteAccount = async () => {
    if (!accountId) return;
    if (!window.confirm(`Supprimer ${resolvedName} ? Toutes ses planifications seront supprimées.`)) return;
    await api.deleteAccount(accountId);
    router.replace('/');
  };

  const handleToggle = async (id: string, active: boolean, e: any) => {
    e?.stopPropagation?.();
    await api.updateSchedule(id, { active: !active });
    await load();
  };

  const handleDelete = async (s: Schedule, e: any) => {
    e?.stopPropagation?.();
    if (!window.confirm(`Supprimer "${s.name || s.playlistName}" ?`)) return;
    await api.deleteSchedule(s.id);
    await load();
  };

  const handleTrigger = async (id: string, e: any) => {
    e?.stopPropagation?.();
    try {
      await api.triggerSchedule(id);
      window.alert('Lecture démarrée !');
    } catch (err: any) {
      window.alert(err.message || 'Spotify est-il ouvert ?');
    }
  };

  const renderSchedule = ({ item }: { item: Schedule }) => (
    <div
      onClick={() => router.push({ pathname: '/edit-schedule', params: { id: item.id } })}
      style={{ cursor: 'pointer', marginBottom: 12 }}
    >
      <View
        className={`rounded-2xl border bg-card ${item.active ? 'border-border' : 'border-border/40 opacity-60'}`}
      >
        {/* Nom + toggle */}
        <View className="flex-row items-center justify-between px-4 pt-4 pb-2">
          <View className="flex-1 mr-2">
            <Text className="text-foreground font-bold text-base" numberOfLines={1}>
              {item.name || item.playlistName}
            </Text>
            {item.name && (
              <Text className="text-xs text-muted-foreground mt-0.5">{item.playlistName}</Text>
            )}
          </View>
          <div onClick={(e) => { e.stopPropagation(); handleToggle(item.id, item.active, e); }}>
            {item.active
              ? <ToggleRightIcon size={28} color="#1DB954" />
              : <ToggleLeftIcon size={28} color="#6b7280" />}
          </div>
        </View>

        {/* Heure + jours */}
        <View className="flex-row items-center gap-4 px-4 pb-3">
          <Text className="font-mono text-2xl font-bold text-[#1DB954]">
            {pad(item.hour)}:{pad(item.minute)}
          </Text>
          <View className="flex-row gap-1">
            {DAYS_SHORT.map((d, i) => (
              <View
                key={i}
                className={`h-6 w-6 items-center justify-center rounded-full ${
                  item.days.includes(i) ? 'bg-[#1DB954]' : 'bg-muted'
                }`}>
                <Text className={`text-[10px] font-bold ${item.days.includes(i) ? 'text-white' : 'text-muted-foreground'}`}>
                  {d}
                </Text>
              </View>
            ))}
          </View>
          {item.shuffle && <ShuffleIcon size={14} color="#6b7280" />}
        </View>

        {/* Footer */}
        <View className="flex-row items-center border-t border-border/50 px-4 py-2 gap-2">
          <Text className="flex-1 text-xs text-muted-foreground" numberOfLines={1}>
            {item.deviceName || 'Appareil actif'}
          </Text>
          <div onClick={(e) => { e.stopPropagation(); handleTrigger(item.id, e); }}>
            <View className="flex-row items-center gap-1 rounded-lg bg-[#1DB954]/15 px-3 py-1.5">
              <PlayCircleIcon size={14} color="#1DB954" />
              <Text className="text-xs font-semibold text-[#1DB954]">Lancer</Text>
            </View>
          </div>
          <div onClick={(e) => { e.stopPropagation(); handleDelete(item, e); }}>
            <View className="rounded-lg bg-red-500/10 px-3 py-1.5">
              <Trash2Icon size={14} color="#ef4444" />
            </View>
          </div>
          <ChevronRightIcon size={16} color="#6b7280" />
        </View>
      </View>
    </div>
  );

  const title = resolvedName || 'Planifications';

  return (
    <>
      <Stack.Screen options={{
          title,
          headerRight: accountId ? () => (
            <TouchableOpacity onPress={handleDeleteAccount} className="pr-2">
              <TrashIcon size={20} color="#ef4444" />
            </TouchableOpacity>
          ) : undefined,
        }} />
      <View className="flex-1 bg-background p-4">
        {accountId && currentlyPlaying && (
          <View className="mb-6 flex-row items-center gap-3 rounded-2xl bg-[#1DB954]/10 p-3 border border-[#1DB954]/20">
            <View className="h-12 w-12 items-center justify-center rounded-xl bg-[#1DB954]/20">
              {currentlyPlaying.albumImageUrl ? (
                <img 
                  src={currentlyPlaying.albumImageUrl} 
                  style={{ width: '100%', height: '100%', borderRadius: 8, objectFit: 'cover' }} 
                />
              ) : (
                <MusicIcon size={24} color="#1DB954" />
              )}
            </View>
            <View className="flex-1">
              <Text className="text-[10px] font-bold uppercase tracking-wider text-[#1DB954]">
                {currentlyPlaying.isPlaying ? 'En cours de lecture' : 'En pause'}
              </Text>
              <Text className="text-sm font-bold text-foreground" numberOfLines={1}>
                {currentlyPlaying.trackName}
              </Text>
              <Text className="text-xs text-muted-foreground" numberOfLines={1}>
                {currentlyPlaying.playlistName ? `Playlist : ${currentlyPlaying.playlistName}` : currentlyPlaying.artistName}
              </Text>
            </View>
          </View>
        )}

        {loading ? (
          <ActivityIndicator className="mt-8" color="#1DB954" />
        ) : schedules.length === 0 ? (
          <View className="mt-16 items-center">
            <CalendarIcon size={56} color="#6b7280" />
            <Text className="mt-4 text-center text-lg font-semibold text-foreground">
              Aucune planification
            </Text>
            <Text className="mt-2 text-center text-muted-foreground">
              Créez votre première planification pour ce compte
            </Text>
          </View>
        ) : (
          <FlatList
            data={schedules}
            keyExtractor={(s) => s.id}
            renderItem={renderSchedule}
            contentContainerStyle={{ paddingBottom: 100 }}
          />
        )}

        <TouchableOpacity
          onPress={() => router.push({ pathname: '/new-schedule', params: accountId ? { accountId } : {} })}
          className="absolute bottom-8 left-4 right-4 flex-row items-center justify-center gap-3 rounded-2xl bg-[#1DB954] py-4">
          <PlusCircleIcon size={22} color="white" />
          <Text className="text-base font-bold text-white">Nouvelle planification</Text>
        </TouchableOpacity>
      </View>
    </>
  );
}
