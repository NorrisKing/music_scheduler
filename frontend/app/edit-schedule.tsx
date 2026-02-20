import { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Switch,
  TextInput,
} from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { CheckCircleIcon, MusicIcon, SpeakerIcon, MonitorIcon, SmartphoneIcon, TabletIcon, ShuffleIcon } from 'lucide-react-native';
import { api, type SpotifyAccount, type SpotifyPlaylist, type SpotifyDevice } from '@/lib/api';

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
  const [selectedAccount, setSelectedAccount] = useState<SpotifyAccount | null>(null);
  const [playlists, setPlaylists] = useState<SpotifyPlaylist[]>([]);
  const [devices, setDevices] = useState<SpotifyDevice[]>([]);
  const [selectedPlaylist, setSelectedPlaylist] = useState<SpotifyPlaylist | null>(null);
  const [selectedDevice, setSelectedDevice] = useState<SpotifyDevice | null>(null);
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [hour, setHour] = useState(8);
  const [minute, setMinute] = useState(0);
  const [shuffle, setShuffle] = useState(true);
  const [playlistSearch, setPlaylistSearch] = useState('');
  const [loadingPlaylists, setLoadingPlaylists] = useState(false);
  const [loadingDevices, setLoadingDevices] = useState(false);
  const [conflictError, setConflictError] = useState<string | null>(null);

  useEffect(() => {
    async function init() {
      try {
        const [schedule, accts] = await Promise.all([
          api.getSchedule(id),
          api.getAccounts(),
        ]);
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
          setSelectedPlaylist(playlistItems.find((p) => p.id === schedule.playlistId) || {
            id: schedule.playlistId,
            name: schedule.playlistName,
            images: schedule.playlistImageUrl ? [{ url: schedule.playlistImageUrl }] : [],
            tracks: { total: 0 },
            owner: { display_name: '' },
          });
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

  const toggleDay = (day: number) => {
    setConflictError(null);
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort((a, b) => a - b)
    );
  };

    const handleSave = async () => {
      if (!selectedAccount) return window.alert('Sélectionnez un compte Spotify');
      if (!selectedPlaylist) return window.alert('Sélectionnez une playlist');
      if (selectedDays.length === 0) return window.alert('Sélectionnez au moins un jour');
      setConflictError(null);
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
        setConflictError(e.message || 'Impossible de sauvegarder');
      } finally {
        setSaving(false);
      }
    };

  const pageTitle = name.trim() || selectedPlaylist?.name || 'Modifier la planification';

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

  const filteredPlaylists = playlists.filter((p) =>
    p.name.toLowerCase().includes(playlistSearch.toLowerCase())
  );

  return (
    <>
      <Stack.Screen options={{ title: pageTitle }} />
      <ScrollView className="flex-1 bg-background" contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>

        {/* Titre affiché en haut */}
        {(name.trim() || selectedPlaylist?.name) && (
          <Text className="mb-4 text-xl font-bold text-foreground" numberOfLines={2}>
            {name.trim() || selectedPlaylist?.name}
          </Text>
        )}

        {/* Nom */}
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
          {selectedAccount && (
            <>
              <SectionTitle>1. Compte Spotify</SectionTitle>
              <View className="flex-row items-center gap-3 rounded-2xl border border-[#1DB954] bg-[#1DB954]/10 p-4">
                <View className="h-10 w-10 rounded-full bg-[#1DB954]/20 items-center justify-center">
                  <Text className="font-bold text-[#1DB954]">{selectedAccount.displayName[0]?.toUpperCase()}</Text>
                </View>
                <View className="flex-1">
                  <Text className="font-semibold text-foreground">{selectedAccount.displayName}</Text>
                  <Text className="text-xs text-muted-foreground">{selectedAccount.email}</Text>
                </View>
                <CheckCircleIcon size={20} color="#1DB954" />
              </View>
            </>
          )}

        {/* 2. Playlist */}
        {selectedAccount && (
          <>
            <SectionTitle>2. Playlist</SectionTitle>
            {loadingPlaylists ? (
              <ActivityIndicator color="#1DB954" />
            ) : playlists.length === 0 ? (
              <Text className="text-muted-foreground">Aucune playlist trouvée.</Text>
            ) : (
              <>
                <View className="mb-3 flex-row items-center gap-2 rounded-2xl border border-border bg-card px-4 py-2">
                  <MusicIcon size={16} color="#6b7280" />
                  <TextInput
                    value={playlistSearch}
                    onChangeText={setPlaylistSearch}
                    placeholder="Rechercher une playlist…"
                    placeholderTextColor="#6b7280"
                    className="flex-1 text-foreground text-sm"
                  />
                  {playlistSearch.length > 0 && (
                    <TouchableOpacity onPress={() => setPlaylistSearch('')}>
                      <Text className="text-muted-foreground text-base px-1">✕</Text>
                    </TouchableOpacity>
                  )}
                </View>
                <View style={{ maxHeight: 320 }}>
                  <ScrollView showsVerticalScrollIndicator={false} nestedScrollEnabled>
                    {filteredPlaylists.map((p) => (
                      <TouchableOpacity
                        key={p.id}
                        onPress={() => setSelectedPlaylist(p)}
                        className={`mb-2 flex-row items-center gap-3 rounded-2xl border p-3 ${selectedPlaylist?.id === p.id ? 'border-[#1DB954] bg-[#1DB954]/10' : 'border-border bg-card'}`}>
                        {p.images?.[0]?.url ? (
                          <img src={p.images[0].url} style={{ width: 48, height: 48, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
                        ) : (
                          <View className="h-12 w-12 rounded-lg bg-muted items-center justify-center flex-shrink-0">
                            <MusicIcon size={20} color="#6b7280" />
                          </View>
                        )}
                        <View className="flex-1">
                          <Text className="text-foreground font-semibold text-sm" numberOfLines={1}>{p.name}</Text>
                          <Text className="text-muted-foreground text-xs">{p.tracks.total} titres</Text>
                        </View>
                        {selectedPlaylist?.id === p.id && <CheckCircleIcon size={18} color="#1DB954" />}
                      </TouchableOpacity>
                    ))}
                    {filteredPlaylists.length === 0 && (
                      <Text className="text-center text-muted-foreground py-4">Aucune playlist trouvée pour "{playlistSearch}"</Text>
                    )}
                  </ScrollView>
                </View>
              </>
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

        {/* 5. Options de lecture */}
        {selectedAccount && (
          <>
            <SectionTitle>5. Options de lecture</SectionTitle>
            <View className="rounded-2xl border border-border bg-card p-4 gap-4">
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center gap-2 flex-1">
                  <ShuffleIcon size={18} color={shuffle ? '#1DB954' : '#6b7280'} />
                  <View>
                    <Text className="text-foreground font-semibold">Lecture aléatoire</Text>
                    <Text className="text-xs text-muted-foreground">Mélange les titres de la playlist</Text>
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

          {/* Résumé */}
          {selectedAccount && (
            <View className="mt-6 rounded-2xl border border-[#1DB954] bg-[#1DB954]/5 p-4">
              <Text className="mb-2 font-bold text-foreground">Résumé</Text>
              <Text className="text-sm text-muted-foreground">
                Compte : <Text className="text-foreground">{selectedAccount.displayName}</Text>{'\n'}
                Playlist : <Text className="text-foreground">{selectedPlaylist?.name || '–'}</Text>{'\n'}
                Jours : <Text className="text-foreground">{selectedDays.map((d) => DAYS[d]).join(', ') || '–'}</Text>{'\n'}
                Heure : <Text className="text-foreground font-mono">{pad(hour)}:{pad(minute)}</Text>{'\n'}
                Lecture : <Text className="text-foreground">{shuffle ? 'Aléatoire' : "Dans l'ordre"}</Text>
                {selectedDevice ? `\nAppareil : ${selectedDevice.name}` : ''}
              </Text>
            </View>
          )}

          {conflictError && (
            <View className="mt-4 rounded-2xl border border-red-500/50 bg-red-500/10 px-4 py-3">
              <Text className="text-sm font-semibold text-red-400">Conflit d'horaire</Text>
              <Text className="text-sm text-red-300 mt-1">{conflictError}</Text>
            </View>
          )}

        <TouchableOpacity
          onPress={handleSave}
          disabled={saving || !selectedAccount}
          className="mt-4 flex-row items-center justify-center gap-3 rounded-2xl bg-[#1DB954] py-4 disabled:opacity-40">
          {saving ? <ActivityIndicator color="white" /> : <CheckCircleIcon size={22} color="white" />}
          <Text className="text-base font-bold text-white">
            {saving ? 'Enregistrement...' : 'Sauvegarder'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </>
  );
}
