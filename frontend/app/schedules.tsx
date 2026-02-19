import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Stack, router } from 'expo-router';
import { PlusCircleIcon, CalendarIcon, ClockIcon, PlayCircleIcon, Trash2Icon, ToggleLeftIcon, ToggleRightIcon } from 'lucide-react-native';
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
      setSchedules(scheds);
      const map: Record<string, SpotifyAccount> = {};
      for (const a of accts) map[a.id] = a;
      setAccounts(map);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleToggle = async (s: Schedule) => {
    await api.updateSchedule(s.id, { active: !s.active });
    await load();
  };

  const handleDelete = (s: Schedule) => {
    Alert.alert('Supprimer la planification', `Supprimer "${s.playlistName}" ?`, [
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
      <View className={`mb-3 rounded-2xl border bg-card p-4 ${item.active ? 'border-border' : 'border-border/40 opacity-60'}`}>
        {/* Header row */}
        <View className="mb-3 flex-row items-start justify-between">
          <View className="flex-1 mr-2">
            <Text className="text-foreground font-semibold text-base" numberOfLines={1}>
              {item.playlistName}
            </Text>
            {account && (
              <Text className="text-xs text-muted-foreground mt-0.5">
                {account.displayName}
              </Text>
            )}
          </View>
          {/* Toggle active */}
          <TouchableOpacity onPress={() => handleToggle(item)} className="p-1">
            {item.active ? (
              <ToggleRightIcon size={28} color="#1DB954" />
            ) : (
              <ToggleLeftIcon size={28} color="#6b7280" />
            )}
          </TouchableOpacity>
        </View>

        {/* Days */}
        <View className="mb-3 flex-row gap-1">
          {DAYS_SHORT.map((d, i) => (
            <View
              key={i}
              className={`h-7 w-7 items-center justify-center rounded-full ${
                item.days.includes(i) ? 'bg-[#1DB954]' : 'bg-muted'
              }`}>
              <Text className={`text-xs font-bold ${item.days.includes(i) ? 'text-white' : 'text-muted-foreground'}`}>
                {d}
              </Text>
            </View>
          ))}
        </View>

        {/* Time + Device row */}
        <View className="mb-3 flex-row items-center gap-4">
          <View className="flex-row items-center gap-1.5">
            <ClockIcon size={14} color="#6b7280" />
            <Text className="text-foreground font-mono text-base font-semibold">
              {pad(item.hour)}:{pad(item.minute)}
            </Text>
          </View>
          {item.deviceName && (
            <Text className="text-xs text-muted-foreground">sur {item.deviceName}</Text>
          )}
          {item.lastTriggeredAt && (
            <Text className="text-xs text-muted-foreground ml-auto">
              Dernier: {new Date(item.lastTriggeredAt).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
            </Text>
          )}
        </View>

        {/* Actions */}
        <View className="flex-row gap-2">
          <TouchableOpacity
            onPress={() => handleTrigger(item)}
            className="flex-1 flex-row items-center justify-center gap-2 rounded-xl bg-[#1DB954]/15 py-2">
            <PlayCircleIcon size={16} color="#1DB954" />
            <Text className="text-sm font-semibold text-[#1DB954]">Lancer</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => handleDelete(item)}
            className="flex-row items-center justify-center rounded-xl bg-red-500/10 px-4 py-2">
            <Trash2Icon size={16} color="#ef4444" />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Planifications' }} />
      <View className="flex-1 bg-background p-4">
        {loading ? (
          <ActivityIndicator className="mt-8" color="#1DB954" />
        ) : (
          <FlatList
            data={schedules}
            keyExtractor={(i) => i.id}
            renderItem={renderSchedule}
            ListEmptyComponent={
              <View className="mt-16 items-center">
                <CalendarIcon size={56} color="#6b7280" />
                <Text className="mt-4 text-center text-lg font-semibold text-foreground">
                  Aucune planification
                </Text>
                <Text className="mt-2 text-center text-muted-foreground">
                  Créez votre première planification pour automatiser la lecture de vos playlists
                </Text>
              </View>
            }
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
