import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Image,
} from 'react-native';
import { Stack, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { PlusCircleIcon, CalendarIcon, PlayCircleIcon, Trash2Icon, ToggleLeftIcon, ToggleRightIcon, ChevronRightIcon, ShuffleIcon, TrashIcon, MusicIcon, ClockIcon } from 'lucide-react-native';
import { api, type Schedule } from '@/lib/api';

const DAYS_SHORT = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
const DAYS_FULL = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

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
  const [triggeringId, setTriggeringId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchStatuses = useCallback(async () => {
    try {
      const data = await api.getAccountsStatus();
      if (accountId) {
        const found = data.find(s => s.accountId === accountId);
        setCurrentlyPlaying(found?.currentlyPlaying || null);
      }
    } catch (e) {
      console.error('Failed to fetch statuses', e);
    }
  }, [accountId]);

  useEffect(() => {
    fetchStatuses();
    const interval = setInterval(fetchStatuses, 15000);
    return () => clearInterval(interval);
  }, [fetchStatuses]);

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
      await fetchStatuses();
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [accountId, accountNameParam, fetchStatuses]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleDeleteAccount = async () => {
    if (!accountId) return;
    if (!window.confirm(`Supprimer le compte ${resolvedName} ?\nToutes ses planifications seront supprimées.`)) return;
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
    setDeletingId(s.id);
    try {
      await api.deleteSchedule(s.id);
      await load();
    } finally {
      setDeletingId(null);
    }
  };

  const handleTrigger = async (id: string, e: any) => {
    e?.stopPropagation?.();
    setTriggeringId(id);
    try {
      await api.triggerSchedule(id);
      // Wait for Spotify to start before refreshing status
      await new Promise(r => setTimeout(r, 2000));
      await fetchStatuses();
    } catch (err: any) {
      window.alert(err.message || 'Spotify est-il ouvert ?');
    } finally {
      setTriggeringId(null);
    }
  };

  const renderSchedule = ({ item }: { item: Schedule }) => (
    <div
      onClick={() => router.push({ pathname: '/edit-schedule', params: { id: item.id } })}
      style={{ cursor: 'pointer', marginBottom: 10 }}
    >
      <View className={`rounded-2xl border bg-card overflow-hidden ${item.active ? 'border-border' : 'border-border/30 opacity-50'}`}>
        {/* Header : heure + toggle */}
        <View className="flex-row items-center justify-between px-4 pt-4 pb-3">
          <View className="flex-row items-center gap-3">
            <View className={`rounded-xl px-3 py-2 ${item.active ? 'bg-[#1DB954]/10' : 'bg-muted'}`}>
              <Text className={`font-mono text-2xl font-black ${item.active ? 'text-[#1DB954]' : 'text-muted-foreground'}`}>
                {pad(item.hour)}:{pad(item.minute)}
              </Text>
            </View>
            <View>
              <Text className="text-foreground font-bold text-base" numberOfLines={1}>
                {item.name || item.playlistName}
              </Text>
              {item.name && (
                <Text className="text-xs text-muted-foreground mt-0.5" numberOfLines={1}>{item.playlistName}</Text>
              )}
            </View>
          </View>
          <div onClick={(e) => { e.stopPropagation(); handleToggle(item.id, item.active, e); }} style={{ padding: 4 }}>
            {item.active
              ? <ToggleRightIcon size={30} color="#1DB954" />
              : <ToggleLeftIcon size={30} color="#6b7280" />}
          </div>
        </View>

        {/* Jours */}
        <View className="flex-row items-center gap-1 px-4 pb-3">
          {DAYS_SHORT.map((d, i) => (
            <View
              key={i}
              className={`h-7 w-7 items-center justify-center rounded-full ${item.days.includes(i) ? 'bg-[#1DB954]' : 'bg-muted'}`}>
              <Text className={`text-[10px] font-black ${item.days.includes(i) ? 'text-white' : 'text-muted-foreground'}`}>
                {d}
              </Text>
            </View>
          ))}
          <View className="flex-1" />
          {item.shuffle && (
            <View className="flex-row items-center gap-1 rounded-lg bg-muted px-2 py-1">
              <ShuffleIcon size={11} color="#6b7280" />
              <Text className="text-[10px] text-muted-foreground font-semibold">Aléatoire</Text>
            </View>
          )}
        </View>

        {/* Footer */}
        <View className="flex-row items-center border-t border-border/40 px-4 py-2.5 gap-2">
          <ClockIcon size={11} color="#6b7280" />
          <Text className="flex-1 text-xs text-muted-foreground" numberOfLines={1}>
            {item.deviceName || 'Appareil actif'}
          </Text>
          <div onClick={(e) => { e.stopPropagation(); handleTrigger(item.id, e); }} style={{ padding: 2 }}>
            <View className={`flex-row items-center gap-1.5 rounded-xl px-3 py-1.5 ${triggeringId === item.id ? 'bg-[#1DB954]/10' : 'bg-[#1DB954]/15'}`}>
              {triggeringId === item.id
                ? <ActivityIndicator size="small" color="#1DB954" />
                : <PlayCircleIcon size={14} color="#1DB954" />
              }
              <Text className="text-xs font-bold text-[#1DB954]">Lancer</Text>
            </View>
          </div>
          <div onClick={(e) => { e.stopPropagation(); handleDelete(item, e); }} style={{ padding: 2 }}>
            <View className="rounded-xl bg-red-500/10 px-3 py-1.5">
              {deletingId === item.id
                ? <ActivityIndicator size="small" color="#ef4444" />
                : <Trash2Icon size={14} color="#ef4444" />
              }
            </View>
          </div>
          <ChevronRightIcon size={15} color="#6b7280" />
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
      <View className="flex-1 bg-background px-4 pt-4">

        {/* Lecture en cours */}
        {accountId && currentlyPlaying && (
          <View className="mb-4 flex-row items-center gap-3 rounded-2xl bg-[#1DB954]/8 p-4 border border-[#1DB954]/20">
            <View className="h-12 w-12 items-center justify-center rounded-xl bg-[#1DB954]/15 overflow-hidden flex-shrink-0">
              {currentlyPlaying.albumImageUrl ? (
                <Image
                  source={{ uri: currentlyPlaying.albumImageUrl }}
                  style={{ width: '100%', height: '100%' }}
                  resizeMode="cover"
                />
              ) : (
                <MusicIcon size={24} color="#1DB954" />
              )}
            </View>
            <View className="flex-1">
              <View className="flex-row items-center gap-2 mb-0.5">
                <View className={`h-1.5 w-1.5 rounded-full ${currentlyPlaying.isPlaying ? 'bg-[#1DB954]' : 'bg-muted-foreground'}`} />
                <Text className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">
                  {currentlyPlaying.isPlaying ? 'EN LECTURE' : 'EN PAUSE'}
                </Text>
              </View>
              {currentlyPlaying.playlistName && (
                <Text className="text-xs font-black text-[#1DB954]" numberOfLines={1}>{currentlyPlaying.playlistName}</Text>
              )}
              <Text className="text-xs text-muted-foreground" numberOfLines={1}>
                {currentlyPlaying.trackName} · {currentlyPlaying.artistName}
              </Text>
            </View>
          </View>
        )}

        {loading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color="#1DB954" />
          </View>
        ) : schedules.length === 0 ? (
          <View className="flex-1 items-center justify-center">
            <View className="h-20 w-20 items-center justify-center rounded-full bg-muted mb-4">
              <CalendarIcon size={40} color="#6b7280" />
            </View>
            <Text className="text-center text-lg font-bold text-foreground">
              Aucune planification
            </Text>
            <Text className="mt-2 text-center text-sm text-muted-foreground px-8">
              Créez une planification pour démarrer automatiquement une playlist Spotify
            </Text>
          </View>
        ) : (
          <FlatList
            data={schedules}
            keyExtractor={(s) => s.id}
            renderItem={renderSchedule}
            contentContainerStyle={{ paddingBottom: 100 }}
            showsVerticalScrollIndicator={false}
          />
        )}

        <TouchableOpacity
          onPress={() => router.push({ pathname: '/new-schedule', params: accountId ? { accountId } : {} })}
          className="absolute bottom-8 left-4 right-4 flex-row items-center justify-center gap-3 rounded-2xl bg-[#1DB954] py-4 shadow-lg">
          <PlusCircleIcon size={22} color="white" />
          <Text className="text-base font-bold text-white">Nouvelle planification</Text>
        </TouchableOpacity>
      </View>
    </>
  );
}
