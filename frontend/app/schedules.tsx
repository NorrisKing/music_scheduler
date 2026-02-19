import { useCallback } from 'react';
import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Stack, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { PlusCircleIcon, CalendarIcon, PlayCircleIcon, Trash2Icon, ToggleLeftIcon, ToggleRightIcon, ChevronRightIcon, ShuffleIcon, TrashIcon } from 'lucide-react-native';
import { api, type Schedule } from '@/lib/api';

const DAYS_SHORT = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];

function pad(n: number) {
  return String(n).padStart(2, '0');
}

export default function SchedulesScreen() {
  const { accountId, accountName } = useLocalSearchParams<{ accountId?: string; accountName?: string }>();
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const all = await api.getSchedules();
      const filtered = accountId
        ? all.filter((s) => s.accountId === accountId)
        : all;
      setSchedules(filtered.sort((a, b) => a.hour * 60 + a.minute - (b.hour * 60 + b.minute)));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleDeleteAccount = () => {
    if (!accountId) return;
    Alert.alert(
      'Supprimer le compte',
      `Supprimer ${accountName} ? Toutes ses planifications seront supprimées.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            await api.deleteAccount(accountId);
            router.replace('/');
          },
        },
      ]
    );
  };

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
      Alert.alert('Erreur', e.message || 'Spotify est-il ouvert ?');
    }
  };

  const renderSchedule = ({ item }: { item: Schedule }) => (
    <TouchableOpacity
      onPress={() => router.push({ pathname: '/edit-schedule', params: { id: item.id } })}
      className={`mb-3 rounded-2xl border bg-card ${item.active ? 'border-border' : 'border-border/40 opacity-60'}`}
      activeOpacity={0.75}
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
          <TouchableOpacity onPress={(e) => { e.stopPropagation(); handleToggle(item); }} hitSlop={8}>
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

      {/* Footer */}
      <View className="flex-row items-center border-t border-border/50 px-4 py-2 gap-2">
        <Text className="flex-1 text-xs text-muted-foreground" numberOfLines={1}>
          {item.deviceName || 'Appareil actif'}
        </Text>
        <TouchableOpacity
          onPress={(e) => { e.stopPropagation(); handleTrigger(item); }}
          className="flex-row items-center gap-1 rounded-lg bg-[#1DB954]/15 px-3 py-1.5"
          hitSlop={6}
        >
          <PlayCircleIcon size={14} color="#1DB954" />
          <Text className="text-xs font-semibold text-[#1DB954]">Lancer</Text>
        </TouchableOpacity>
      <TouchableOpacity
          onPress={(e) => { e.stopPropagation(); handleDelete(item); }}
          className="rounded-lg bg-red-500/10 px-3 py-1.5"
          hitSlop={6}
        >
          <Trash2Icon size={14} color="#ef4444" />
        </TouchableOpacity>
        <ChevronRightIcon size={16} color="#6b7280" />
      </View>
    </TouchableOpacity>
  );

  const title = accountName ? `${accountName}` : 'Planifications';

  return (
    <>
      <Stack.Screen options={{ title }} />
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
