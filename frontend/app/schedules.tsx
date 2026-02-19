import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Stack, router, useFocusEffect } from 'expo-router';
import { PlusCircleIcon, CalendarIcon, ClockIcon, PlayCircleIcon, Trash2Icon, ToggleLeftIcon, ToggleRightIcon, ChevronRightIcon, ShuffleIcon } from 'lucide-react-native';
import { api, type Schedule, type SpotifyAccount } from '@/lib/api';

const DAYS_SHORT = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
const DAYS_FR = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

function pad(n: number) {
  return String(n).padStart(2, '0');
}

export default function SchedulesScreen() {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [accounts, setAccounts] = useState<Record<string, SpotifyAccount>>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [scheds, accts] = await Promise.all([api.getSchedules(), api.getAccounts()]);
      setSchedules(scheds.sort((a, b) => a.hour * 60 + a.minute - (b.hour * 60 + b.minute)));
      const map: Record<string, SpotifyAccount> = {};
      for (const a of accts) map[a.id] = a;
      setAccounts(map);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleToggle = async (s: Schedule) => {
    await api.updateSchedule(s.id, { active: !s.active });
    await load();
  };

  const handleDelete = (s: Schedule) => {
    Alert.alert('Supprimer', `Supprimer "${s.name || s.playlistName}" ?`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          await api.deleteSchedule(s.id);
          await load();
        },
      },
    ]);
  };

  const handleTrigger = async (s: Schedule) => {
    try {
      await api.triggerSchedule(s.id);
      Alert.alert('OK', 'Lecture démarrée !');
    } catch (e: any) {
      Alert.alert('Erreur', e.message || 'Impossible de lancer la lecture. Spotify est-il ouvert ?');
    }
  };

  const renderSchedule = ({ item }: { item: Schedule }) => {
    const account = accounts[item.accountId];
    return (
      <TouchableOpacity
        onPress={() => router.push({ pathname: '/edit-schedule', params: { id: item.id } })}
        className={`mb-3 rounded-2xl border bg-card ${item.active ? 'border-border' : 'border-border/40 opacity-60'}`}
        activeOpacity={0.75}
      >
        {/* Top bar : nom + toggle */}
        <View className="flex-row items-center justify-between px-4 pt-4 pb-2">
          <View className="flex-1 mr-2">
            <Text className="text-foreground font-bold text-base" numberOfLines={1}>
              {item.name || item.playlistName}
            </Text>
            <View className="flex-row items-center gap-2 mt-0.5">
              {account && (
                <Text className="text-xs text-muted-foreground">{account.displayName}</Text>
              )}
              {item.name && (
                <Text className="text-xs text-muted-foreground">· {item.playlistName}</Text>
              )}
            </View>
          </View>
          <TouchableOpacity onPress={() => handleToggle(item)} hitSlop={8}>
            {item.active
              ? <ToggleRightIcon size={28} color="#1DB954" />
              : <ToggleLeftIcon size={28} color="#6b7280" />}
          </TouchableOpacity>
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

        {/* Footer : appareil + actions */}
        <View className="flex-row items-center border-t border-border/50 px-4 py-2 gap-2">
          {item.deviceName ? (
            <Text className="flex-1 text-xs text-muted-foreground" numberOfLines={1}>
              {item.deviceName}
            </Text>
          ) : (
            <Text className="flex-1 text-xs text-muted-foreground">Appareil actif</Text>
          )}
          <TouchableOpacity
            onPress={() => handleTrigger(item)}
            className="flex-row items-center gap-1 rounded-lg bg-[#1DB954]/15 px-3 py-1.5"
            hitSlop={6}
          >
            <PlayCircleIcon size={14} color="#1DB954" />
            <Text className="text-xs font-semibold text-[#1DB954]">Lancer</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => handleDelete(item)}
            className="rounded-lg bg-red-500/10 px-3 py-1.5"
            hitSlop={6}
          >
            <Trash2Icon size={14} color="#ef4444" />
          </TouchableOpacity>
          <ChevronRightIcon size={16} color="#6b7280" />
        </View>
      </TouchableOpacity>
    );
  };

  // Group by account
  const byAccount = schedules.reduce<Record<string, Schedule[]>>((acc, s) => {
    (acc[s.accountId] = acc[s.accountId] || []).push(s);
    return acc;
  }, {});

  return (
    <>
      <Stack.Screen options={{ title: 'Planifications' }} />
      <View className="flex-1 bg-background p-4">
        {loading ? (
          <ActivityIndicator className="mt-8" color="#1DB954" />
        ) : schedules.length === 0 ? (
          <View className="mt-16 items-center">
            <CalendarIcon size={56} color="#6b7280" />
            <Text className="mt-4 text-center text-lg font-semibold text-foreground">
              Aucune planification
            </Text>
            <Text className="mt-2 text-center text-muted-foreground">
              Créez votre première planification pour automatiser la lecture de vos playlists
            </Text>
          </View>
        ) : (
          <FlatList
            data={Object.entries(byAccount)}
            keyExtractor={([accountId]) => accountId}
            renderItem={({ item: [accountId, items] }) => (
              <View className="mb-2">
                {Object.keys(byAccount).length > 1 && (
                  <Text className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    {accounts[accountId]?.displayName || accountId}
                  </Text>
                )}
                {items.map((s) => renderSchedule({ item: s }))}
              </View>
            )}
            contentContainerStyle={{ paddingBottom: 100 }}
          />
        )}

        <TouchableOpacity
          onPress={() => router.push('/new-schedule')}
          className="absolute bottom-8 left-4 right-4 flex-row items-center justify-center gap-3 rounded-2xl bg-[#1DB954] py-4">
          <PlusCircleIcon size={22} color="white" />
          <Text className="text-base font-bold text-white">Nouvelle planification</Text>
        </TouchableOpacity>
      </View>
    </>
  );
}
