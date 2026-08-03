import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  ScrollView,
  ActivityIndicator,
  Image,
} from 'react-native';
import { Stack, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { PlusCircleIcon, CalendarIcon, PlayCircleIcon, Trash2Icon, ToggleLeftIcon, ToggleRightIcon, ChevronRightIcon, ShuffleIcon, TrashIcon, MusicIcon, ClockIcon } from 'lucide-react-native';
import { api, type Schedule } from '@/lib/api';

const DAYS_LABELS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

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
  const [triggeringId, setTriggeringId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('calendar');

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
    if (triggeringId) return; // ignore taps while a trigger is already in flight
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

  const CalendarView = () => {
    // Group schedules by hour
    const hourMap = new Map<number, Schedule[][]>();
    for (const s of schedules) {
      if (!hourMap.has(s.hour)) {
        hourMap.set(s.hour, Array.from({ length: 7 }, () => []));
      }
      for (const day of s.days) {
        hourMap.get(s.hour)![day].push(s);
      }
    }
    const populatedHours = Array.from(hourMap.entries())
      .filter(([_, days]) => days.some(arr => arr.length > 0))
      .sort(([a], [b]) => a - b);

    const today = new Date().getDay();
    const isCurrentlyPlaying = (s: Schedule, dayIdx: number) =>
      currentlyPlaying?.playlistName != null &&
      s.playlistName === currentlyPlaying.playlistName &&
      dayIdx === today;

    return (
      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
        <ScrollView horizontal nestedScrollEnabled showsHorizontalScrollIndicator={false}>
          <View className="min-w-full">
            {/* Header row */}
            <View className="flex-row border-b border-border/20">
              <View className="w-14 h-10 justify-center items-center bg-background" style={{ position: 'sticky', left: 0, zIndex: 20 }} />
              {DAYS_LABELS.map((d, i) => (
                <View key={i} className="w-24 items-center justify-center h-10">
                  <Text className={`text-xs font-bold uppercase ${i === today ? 'text-[##1DB954]' : 'text-muted-foreground'}`}>{d}</Text>
                </View>
              ))}
            </View>
            {/* Hour rows */}
            {populatedHours.map(([hour, daySchedules]) => (
              <View key={hour} className="flex-row border-b border-border/10">
                <View className="w-14 justify-start items-center pt-2.5 bg-background" style={{ position: 'sticky', left: 0, zIndex: 10 }}>
                  <Text className="font-mono text-xs text-muted-foreground">{pad(hour)}:00</Text>
                </View>
                {daySchedules.map((schedulesAtDay, dayIdx) => (
                  <View key={dayIdx} className="w-24 p-1 min-h-[56px] justify-center">
                    {schedulesAtDay.map(s => {
                      const active = isCurrentlyPlaying(s, dayIdx);
                      return (
                        <TouchableOpacity
                          key={s.id}
                          onPress={() => router.push({ pathname: '/edit-schedule', params: { id: s.id } })}
                          className={`rounded-lg px-2 py-1.5 mb-1 border ${
                            active
                              ? 'border-[#c9a227] bg-[#c9a227]/10'
                              : s.active
                                ? 'border-border/40 bg-card'
                                : 'border-border/20 bg-card/50 opacity-50'
                          }`}
                        >
                          <View className="flex-row items-center gap-1">
                            {active && <View className="h-1.5 w-1.5 rounded-full bg-[#c9a227]" />}
                            <Text
                              className={`text-[10px] leading-tight ${active ? 'font-bold text-[#c9a227]' : 'text-foreground'}`}
                              numberOfLines={2}
                            >
                              {s.name || s.playlistName}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ))}
              </View>
            ))}
          </View>
        </ScrollView>
        {populatedHours.length === 0 && (
          <View className="flex-1 items-center justify-center py-20">
            <Text className="text-sm text-muted-foreground">Aucune planification cette semaine</Text>
          </View>
        )}
      </ScrollView>
    );
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
            <View className={`rounded-xl px-3 py-2 ${item.active ? 'bg-[#c9a227]/10' : 'bg-muted'}`}>
              <Text className={`font-mono text-2xl font-black ${item.active ? 'text-[#c9a227]' : 'text-muted-foreground'}`}>
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
              ? <ToggleRightIcon size={30} color="#c9a227" />
              : <ToggleLeftIcon size={30} color="#8a7c5f" />}
          </div>
        </View>

        {/* Jours */}
        <View className="flex-row items-center gap-1 px-4 pb-3">
          {DAYS_SHORT.map((d, i) => (
            <View
              key={i}
              className={`h-7 w-7 items-center justify-center rounded-full ${item.days.includes(i) ? 'bg-[#c9a227]' : 'bg-muted'}`}>
              <Text className={`text-[10px] font-black ${item.days.includes(i) ? 'text-white' : 'text-muted-foreground'}`}>
                {d}
              </Text>
            </View>
          ))}
          <View className="flex-1" />
          {item.shuffle && (
            <View className="flex-row items-center gap-1 rounded-lg bg-muted px-2 py-1">
              <ShuffleIcon size={11} color="#8a7c5f" />
              <Text className="text-[10px] text-muted-foreground font-semibold">Aléatoire</Text>
            </View>
          )}
        </View>

        {/* Footer */}
        <View className="flex-row items-center border-t border-border/40 px-4 py-2.5 gap-2">
          <ClockIcon size={11} color="#8a7c5f" />
          <Text className="flex-1 text-xs text-muted-foreground" numberOfLines={1}>
            {item.deviceName || 'Appareil actif'}
          </Text>
          <div onClick={(e) => { e.stopPropagation(); handleTrigger(item.id, e); }} style={{ padding: 2 }}>
            <View className={`flex-row items-center gap-1.5 rounded-xl px-3 py-1.5 ${triggeringId === item.id ? 'bg-[#c9a227]/10' : 'bg-[#c9a227]/15'}`}>
              {triggeringId === item.id
                ? <ActivityIndicator size="small" color="#c9a227" />
                : <PlayCircleIcon size={14} color="#c9a227" />
              }
              <Text className="text-xs font-bold text-[#c9a227]">Lancer</Text>
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
          <ChevronRightIcon size={15} color="#8a7c5f" />
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

        <View className="flex-row items-center rounded-xl bg-[#c9a227]/15 border border-[#c9a227]/30 p-0.5 mb-3">
          <TouchableOpacity
            onPress={() => setViewMode('calendar')}
            className={`flex-1 flex-row items-center justify-center gap-1.5 rounded-lg py-2.5 ${viewMode === 'calendar' ? 'bg-[#c9a227] shadow-sm' : 'bg-transparent'}`}
          >
            <Text className={`text-sm font-bold ${viewMode === 'calendar' ? 'text-white' : 'text-[#c9a227]'}`}>Calendrier</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setViewMode('list')}
            className={`flex-1 flex-row items-center justify-center gap-1.5 rounded-lg py-2.5 ${viewMode === 'list' ? 'bg-[#c9a227] shadow-sm' : 'bg-transparent'}`}
          >
            <Text className={`text-sm font-bold ${viewMode === 'list' ? 'text-white' : 'text-[#c9a227]'}`}>Liste</Text>
          </TouchableOpacity>
        </View>

        {/* Lecture en cours */}
        {accountId && currentlyPlaying && (
          <View className="mb-4 flex-row items-center gap-3 rounded-2xl bg-[#c9a227]/8 p-4 border border-[#c9a227]/20">
            <View className="h-12 w-12 items-center justify-center rounded-xl bg-[#c9a227]/15 overflow-hidden flex-shrink-0">
              {currentlyPlaying.albumImageUrl ? (
                <Image
                  source={{ uri: currentlyPlaying.albumImageUrl }}
                  style={{ width: '100%', height: '100%' }}
                  resizeMode="cover"
                />
              ) : (
                <MusicIcon size={24} color="#c9a227" />
              )}
            </View>
            <View className="flex-1">
              <View className="flex-row items-center gap-2 mb-0.5">
                <View className={`h-1.5 w-1.5 rounded-full ${currentlyPlaying.isPlaying ? 'bg-[#c9a227]' : 'bg-muted-foreground'}`} />
                <Text className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">
                  {currentlyPlaying.isPlaying ? 'EN LECTURE' : 'EN PAUSE'}
                </Text>
              </View>
              {currentlyPlaying.playlistName && (
                <Text className="text-xs font-black text-[#c9a227]" numberOfLines={1}>{currentlyPlaying.playlistName}</Text>
              )}
              <Text className="text-xs text-muted-foreground" numberOfLines={1}>
                {currentlyPlaying.trackName} · {currentlyPlaying.artistName}
              </Text>
            </View>
          </View>
        )}

        {loading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color="#c9a227" />
          </View>
        ) : schedules.length === 0 ? (
          <View className="flex-1 items-center justify-center">
            <View className="h-20 w-20 items-center justify-center rounded-full bg-muted mb-4">
              <CalendarIcon size={40} color="#8a7c5f" />
            </View>
            <Text className="text-center text-lg font-bold text-foreground">
              Aucune planification
            </Text>
            <Text className="mt-2 text-center text-sm text-muted-foreground px-8">
              Créez une planification pour démarrer automatiquement une playlist Spotify
            </Text>
          </View>
        ) : viewMode === 'calendar' ? (
          <CalendarView />
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
          className="absolute bottom-8 left-4 right-4 flex-row items-center justify-center gap-3 rounded-2xl bg-[#c9a227] py-4 shadow-lg">
          <PlusCircleIcon size={22} color="white" />
          <Text className="text-base font-bold text-white">Nouvelle planification</Text>
        </TouchableOpacity>
      </View>
    </>
  );
}
