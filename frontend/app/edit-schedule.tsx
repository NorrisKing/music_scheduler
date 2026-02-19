import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Switch,
  TextInput,
} from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { CheckCircleIcon, MusicIcon, SpeakerIcon, MonitorIcon, SmartphoneIcon, TabletIcon, ShuffleIcon } from 'lucide-react-native';
import { api, type SpotifyAccount, type SpotifyPlaylist, type SpotifyDevice, type Schedule } from '@/lib/api';

const DAYS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

function pad(n: number) { return String(n).padStart(2, '0'); }

function DeviceIcon({ type }: { type: string }) {
  const t = type?.toLowerCase();
  if (t?.includes('computer')) return <MonitorIcon size={16} color="#6b7280" />;
  if (t?.includes('smartphone')) return <SmartphoneIcon size={16} color="#6b7280" />;
  if (t?.includes('tablet')) return <TabletIcon size={16} color="#6b7280" />;
  return <SpeakerIcon size={16} color="#6b7280" />;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <Text className="mb-3 mt-6 text-base font-bold text-foreground">{children}</Text>;
}

export default function EditScheduleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState('');
  const [accounts, setAccounts] = useState<SpotifyAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<SpotifyAccount | null>(null);
  const [playlists, setPlaylists] = useState<SpotifyPlaylist[]>([]);
  const [devices, setDevices] = useState<SpotifyDevice[]>([]);
  const [selectedPlaylist, setSelectedPlaylist] = useState<SpotifyPlaylist | null>(null);
  const [selectedDevice, setSelectedDevice] = useState<SpotifyDevice | null>(null);
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [hour, setHour] = useState(8);
  const [minute, setMinute] = useState(0);
  const [shuffle, setShuffle] = useState(true);
  const [loadingPlaylists, setLoadingPlaylists] = useState(false);
  const [loadingDevices, setLoadingDevices] = useState(false);

  useEffect(() => {
    async function init() {
      try {
        const [schedule, accts] = await Promise.all([
          api.getSchedule(id),
          api.getAccounts(),
        ]);
        setAccounts(accts);
        setName(schedule.name || '');
        setSelectedDays(schedule.days);
        setHour(schedule.hour);
        setMinute(schedule.minute);
        setShuffle(schedule.shuffle ?? true);

        const account = accts.find((a) => a.id === schedule.accountId) || null;
        setSelectedAccount(account);

        if (account) {
          setLoadingPlaylists(true);
          setLoadingDevices(true);
          const [pl, dv] = await Promise.all([
            api.getPlaylists(account.id),
            api.getDevices(account.id),
          ]);
          const playlistItems = pl.items || [];
          const deviceItems = dv.devices || [];
          setPlaylists(playlistItems);
          setDevices(deviceItems);
          setSelectedPlaylist(playlistItems.find((p) => p.id === schedule.playlistId) || null);
          setSelectedDevice(deviceItems.find((d) => d.id === schedule.deviceId) || null);
          setLoadingPlaylists(false);
          setLoadingDevices(false);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [id]);

  useEffect(() => {
    if (!selectedAccount) return;
    setLoadingPlaylists(true);
    setLoadingDevices(true);
    Promise.all([
      api.getPlaylists(selectedAccount.id),
      api.getDevices(selectedAccount.id),
    ]).then(([pl, dv]) => {
      setPlaylists(pl.items || []);
      setDevices(dv.devices || []);
    }).finally(() => {
      setLoadingPlaylists(false);
      setLoadingDevices(false);
    });
  }, [selectedAccount?.id]);

  const toggleDay = (day: number) => {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort((a, b) => a - b)
    );
  };

  const handleSave = async () => {
    if (!selectedAccount) return Alert.alert('Erreur', 'Sélectionnez un compte Spotify');
    if (!selectedPlaylist) return Alert.alert('Erreur', 'Sélectionnez une playlist');
    if (selectedDays.length === 0) return Alert.alert('Erreur', 'Sélectionnez au moins un jour');

    setSaving(true);
    try {
      await api.updateSchedule(id, {
        name: name.trim() || undefined,
        accountId: selectedAccount.id,
        playlistId: selectedPlaylist.id,
        playlistName: selectedPlaylist.name,
        playlistImageUrl: selectedPlaylist.images?.[0]?.url,
        days: selectedDays,
        hour,
        minute,
        deviceId: selectedDevice?.id,
        deviceName: selectedDevice?.name,
        shuffle,
      });
      router.back();
    } catch (e: any) {
      Alert.alert('Erreur', e.message || 'Impossible de sauvegarder');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <>
        <Stack.Screen options={{ title: 'Modifier la planification' }} />
        <View className="flex-1 items-center justify-center bg-background">
          <ActivityIndicator color="#1DB954" />
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Modifier la planification' }} />
      <ScrollView className="flex-1 bg-background" contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>

        {/* 0. Nom */}
        <SectionTitle>Nom de la planification</SectionTitle>
        <View className="rounded-2xl border border-border bg-card px-4 py-3">
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Ex : Matin ambiance, Soirée rock…"
            placeholderTextColor="#6b7280"
            className="text-foreground text-base"
          />
        </View>

        {/* 1. Compte */}
        <SectionTitle>1. Compte Spotify</SectionTitle>
        <View className="gap-2">
          {accounts.map((a) => (
            <TouchableOpacity
              key={a.id}
              onPress={() => { setSelectedAccount(a); setSelectedPlaylist(null); setSelectedDevice(null); }}
              className={`flex-row items-center gap-3 rounded-2xl border p-4 ${selectedAccount?.id === a.id ? 'border-[#1DB954] bg-[#1DB954]/10' : 'border-border bg-card'}`}>
              <View className="h-10 w-10 rounded-full bg-[#1DB954]/20 items-center justify-center">
                <Text className="font-bold text-[#1DB954]">{a.displayName[0]?.toUpperCase()}</Text>
              </View>
              <View className="flex-1">
                <Text className="font-semibold text-foreground">{a.displayName}</Text>
                <Text className="text-xs text-muted-foreground">{a.email}</Text>
              </View>
              {selectedAccount?.id === a.id && <CheckCircleIcon size={20} color="#1DB954" />}
            </TouchableOpacity>
          ))}
        </View>

        {/* 2. Playlist */}
        {selectedAccount && (
          <>
            <SectionTitle>2. Playlist</SectionTitle>
            {loadingPlaylists ? (
              <ActivityIndicator color="#1DB954" />
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-1">
                <View className="flex-row gap-2 px-1">
                  {playlists.map((p) => (
                    <TouchableOpacity
                      key={p.id}
                      onPress={() => setSelectedPlaylist(p)}
                      className={`w-32 rounded-2xl border p-3 ${selectedPlaylist?.id === p.id ? 'border-[#1DB954] bg-[#1DB954]/10' : 'border-border bg-card'}`}>
                      {p.images?.[0]?.url ? (
                        <View className="h-24 w-24 rounded-xl mb-2 overflow-hidden">
                          <img src={p.images[0].url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        </View>
                      ) : (
                        <View className="h-24 w-24 rounded-xl mb-2 bg-muted items-center justify-center">
                          <MusicIcon size={32} color="#6b7280" />
                        </View>
                      )}
                      <Text className="text-foreground text-xs font-semibold" numberOfLines={2}>{p.name}</Text>
                      <Text className="text-muted-foreground text-xs">{p.tracks.total} titres</Text>
                      {selectedPlaylist?.id === p.id && (
                        <View className="absolute top-2 right-2">
                          <CheckCircleIcon size={18} color="#1DB954" />
                        </View>
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            )}
          </>
        )}

        {/* 3. Jours */}
        {selectedAccount && (
          <>
            <SectionTitle>3. Jours</SectionTitle>
            <View className="flex-row gap-2 flex-wrap">
              {DAYS.map((d, i) => (
                <TouchableOpacity
                  key={i}
                  onPress={() => toggleDay(i)}
                  className={`h-10 w-10 rounded-full items-center justify-center ${selectedDays.includes(i) ? 'bg-[#1DB954]' : 'bg-muted'}`}>
                  <Text className={`text-sm font-bold ${selectedDays.includes(i) ? 'text-white' : 'text-muted-foreground'}`}>
                    {d.charAt(0)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text className="mt-1 text-xs text-muted-foreground">
              {selectedDays.length > 0 ? selectedDays.map((d) => DAYS[d]).join(', ') : 'Aucun jour sélectionné'}
            </Text>
          </>
        )}

        {/* 4. Heure */}
        {selectedAccount && (
          <>
            <SectionTitle>4. Heure</SectionTitle>
            <View className="flex-row items-center gap-4">
              <View>
                <Text className="mb-1 text-xs text-muted-foreground">Heure</Text>
                <ScrollView style={{ height: 120 }} showsVerticalScrollIndicator={false}>
                  {HOURS.map((h) => (
                    <TouchableOpacity
                      key={h}
                      onPress={() => setHour(h)}
                      className={`mb-1 rounded-xl px-4 py-2 ${hour === h ? 'bg-[#1DB954]' : 'bg-muted'}`}>
                      <Text className={`font-mono font-semibold ${hour === h ? 'text-white' : 'text-foreground'}`}>{pad(h)}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
              <Text className="text-2xl font-bold text-foreground">:</Text>
              <View>
                <Text className="mb-1 text-xs text-muted-foreground">Minute</Text>
                <ScrollView style={{ height: 120 }} showsVerticalScrollIndicator={false}>
                  {MINUTES.map((m) => (
                    <TouchableOpacity
                      key={m}
                      onPress={() => setMinute(m)}
                      className={`mb-1 rounded-xl px-4 py-2 ${minute === m ? 'bg-[#1DB954]' : 'bg-muted'}`}>
                      <Text className={`font-mono font-semibold ${minute === m ? 'text-white' : 'text-foreground'}`}>{pad(m)}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
              <View className="ml-4 rounded-2xl bg-[#1DB954]/10 px-5 py-4 border border-[#1DB954]">
                <Text className="font-mono text-3xl font-bold text-[#1DB954]">{pad(hour)}:{pad(minute)}</Text>
              </View>
            </View>
          </>
        )}

        {/* 5. Options */}
        {selectedAccount && (
          <>
            <SectionTitle>5. Options de lecture</SectionTitle>
            <View className="rounded-2xl border border-border bg-card p-4">
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center gap-2 flex-1">
                  <ShuffleIcon size={18} color={shuffle ? '#1DB954' : '#6b7280'} />
                  <View>
                    <Text className="text-foreground font-semibold">Lecture aléatoire</Text>
                    <Text className="text-xs text-muted-foreground">Mélange les titres</Text>
                  </View>
                </View>
                <Switch
                  value={shuffle}
                  onValueChange={setShuffle}
                  trackColor={{ false: '#374151', true: '#1DB954' }}
                  thumbColor="white"
                />
              </View>
            </View>
          </>
        )}

        {/* 6. Appareil */}
        {selectedAccount && (
          <>
            <SectionTitle>6. Appareil <Text className="text-xs text-muted-foreground font-normal">(optionnel)</Text></SectionTitle>
            {loadingDevices ? (
              <ActivityIndicator color="#1DB954" />
            ) : (
              <View className="gap-2">
                <TouchableOpacity
                  onPress={() => setSelectedDevice(null)}
                  className={`flex-row items-center gap-3 rounded-2xl border p-3 ${!selectedDevice ? 'border-[#1DB954] bg-[#1DB954]/10' : 'border-border bg-card'}`}>
                  <Text className="text-foreground font-semibold flex-1">Appareil actif au moment du déclenchement</Text>
                  {!selectedDevice && <CheckCircleIcon size={18} color="#1DB954" />}
                </TouchableOpacity>
                {devices.map((d) => (
                  <TouchableOpacity
                    key={d.id}
                    onPress={() => setSelectedDevice(d)}
                    className={`flex-row items-center gap-3 rounded-2xl border p-3 ${selectedDevice?.id === d.id ? 'border-[#1DB954] bg-[#1DB954]/10' : 'border-border bg-card'}`}>
                    <DeviceIcon type={d.type} />
                    <View className="flex-1">
                      <Text className="text-foreground font-semibold">{d.name}</Text>
                      <Text className="text-xs text-muted-foreground">{d.type}{d.is_active ? ' · Actif' : ''}</Text>
                    </View>
                    {selectedDevice?.id === d.id && <CheckCircleIcon size={18} color="#1DB954" />}
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </>
        )}

        <TouchableOpacity
          onPress={handleSave}
          disabled={saving || !selectedAccount}
          className="mt-6 flex-row items-center justify-center gap-3 rounded-2xl bg-[#1DB954] py-4 disabled:opacity-40">
          {saving ? <ActivityIndicator color="white" /> : <CheckCircleIcon size={22} color="white" />}
          <Text className="text-base font-bold text-white">
            {saving ? 'Enregistrement...' : 'Sauvegarder'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </>
  );
}
