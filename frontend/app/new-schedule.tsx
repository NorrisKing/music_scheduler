import { useEffect, useState } from 'react';
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
import { api, type SpotifyAccount, type SpotifyPlaylist, type SpotifyDevice } from '@/lib/api';

const DAYS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

function pad(n: number) {
  return String(n).padStart(2, '0');
}

function DeviceIcon({ type }: { type: string }) {
  const t = type?.toLowerCase();
  if (t?.includes('computer')) return <MonitorIcon size={16} color="#6b7280" />;
  if (t?.includes('smartphone')) return <SmartphoneIcon size={16} color="#6b7280" />;
  if (t?.includes('tablet')) return <TabletIcon size={16} color="#6b7280" />;
  return <SpeakerIcon size={16} color="#6b7280" />;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <Text className="mb-3 mt-6 text-sm font-bold uppercase tracking-widest text-muted-foreground">{children}</Text>
  );
}

export default function NewScheduleScreen() {
  const { accountId } = useLocalSearchParams<{ accountId?: string }>();
  const [name, setName] = useState('');
  const [accounts, setAccounts] = useState<SpotifyAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<SpotifyAccount | null>(null);
  const [playlists, setPlaylists] = useState<SpotifyPlaylist[]>([]);
  const [devices, setDevices] = useState<SpotifyDevice[]>([]);
  const [selectedPlaylist, setSelectedPlaylist] = useState<SpotifyPlaylist | null>(null);
  const [selectedDevice, setSelectedDevice] = useState<SpotifyDevice | null>(null);
  const [selectedDays, setSelectedDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [timeValue, setTimeValue] = useState('08:00');
  const [shuffle, setShuffle] = useState(true);
  const [playlistSearch, setPlaylistSearch] = useState('');
  const [loadingPlaylists, setLoadingPlaylists] = useState(false);
  const [loadingDevices, setLoadingDevices] = useState(false);
  const [playlistError, setPlaylistError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [conflictError, setConflictError] = useState<string | null>(null);

  const hour = parseInt(timeValue.split(':')[0] || '8', 10);
  const minute = parseInt(timeValue.split(':')[1] || '0', 10);

  useEffect(() => {
    api.getAccounts().then((data) => {
      setAccounts(data);
      if (accountId) {
        const preselected = data.find((a) => a.id === accountId);
        if (preselected) setSelectedAccount(preselected);
      }
    }).catch(console.error);
  }, [accountId]);

  useEffect(() => {
    if (!selectedAccount) return;
    setLoadingPlaylists(true);
    setPlaylistError(null);
    api
      .getPlaylists(selectedAccount.id)
      .then((d) => {
        setPlaylists(d.items || []);
        if ((d.items || []).length === 0) setPlaylistError('Aucune playlist trouvée. Réessayez dans quelques secondes.');
      })
      .catch((e: any) => setPlaylistError(`Erreur: ${e?.message || 'impossible de charger les playlists'}`))
      .finally(() => setLoadingPlaylists(false));

    setLoadingDevices(true);
    api
      .getDevices(selectedAccount.id)
      .then((d) => setDevices(d.devices || []))
      .catch(() => setDevices([]))
      .finally(() => setLoadingDevices(false));
  }, [selectedAccount]);

  const toggleDay = (day: number) => {
    setConflictError(null);
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort((a, b) => a - b)
    );
  };

  const handleSave = async () => {
    if (!selectedAccount) return Alert.alert('Erreur', 'Sélectionnez un compte Spotify');
    if (!selectedPlaylist) return Alert.alert('Erreur', 'Sélectionnez une playlist');
    if (selectedDays.length === 0) return Alert.alert('Erreur', 'Sélectionnez au moins un jour');
    setConflictError(null);
    setSaving(true);
    try {
      await api.createSchedule({
        name: name.trim() || undefined,
        accountId: selectedAccount.id,
        playlistId: selectedPlaylist.id,
        playlistName: selectedPlaylist.name,
        playlistImageUrl: selectedPlaylist.images?.[0]?.url,
        days: selectedDays,
        hour,
        minute,
        active: true,
        deviceId: selectedDevice?.id,
        deviceName: selectedDevice?.name,
        shuffle,
      });
      router.back();
    } catch (e: any) {
      setConflictError(e.message || 'Impossible de créer la planification');
    } finally {
      setSaving(false);
    }
  };

  const filteredPlaylists = playlists.filter((p) =>
    p.name.toLowerCase().includes(playlistSearch.toLowerCase())
  );

  return (
    <>
      <Stack.Screen options={{ title: 'Nouvelle planification' }} />
      <ScrollView className="flex-1 bg-background" contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>

        {/* Nom */}
        <SectionTitle>Nom (optionnel)</SectionTitle>
        <View className="rounded-2xl border border-border bg-card px-4 py-3">
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Ex : Matin café, Soirée détente…"
            placeholderTextColor="#6b7280"
            className="text-foreground text-base"
          />
        </View>

        {/* 1. Compte */}
        <SectionTitle>1 · Compte Spotify</SectionTitle>
        {accounts.length === 0 ? (
          <View className="rounded-2xl border border-border bg-card p-4">
            <Text className="text-muted-foreground text-center text-sm">
              Aucun compte connecté. Ajoutez-en un dans "Comptes".
            </Text>
          </View>
        ) : (
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
        )}

        {selectedAccount && (
          <>
            {/* 2. Playlist */}
            <SectionTitle>2 · Playlist</SectionTitle>
            {loadingPlaylists ? (
              <View className="py-6 items-center">
                <ActivityIndicator color="#1DB954" />
                <Text className="mt-2 text-xs text-muted-foreground">Chargement des playlists…</Text>
              </View>
            ) : playlistError ? (
              <View className="rounded-2xl border border-yellow-500/40 bg-yellow-500/10 p-4 gap-3">
                <Text className="text-yellow-300 text-sm">{playlistError}</Text>
                <TouchableOpacity
                  onPress={() => {
                    setPlaylistError(null);
                    setLoadingPlaylists(true);
                    api.getPlaylists(selectedAccount!.id)
                      .then((d) => {
                        setPlaylists(d.items || []);
                        if ((d.items || []).length === 0) setPlaylistError('Toujours vide. Réessayez dans quelques secondes.');
                      })
                      .catch(() => setPlaylistError('Erreur. Réessayez.'))
                      .finally(() => setLoadingPlaylists(false));
                  }}
                  className="rounded-xl bg-yellow-500/20 border border-yellow-500/40 py-2 items-center">
                  <Text className="text-yellow-300 font-semibold text-sm">Réessayer</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <View className="mb-3 flex-row items-center gap-2 rounded-2xl border border-border bg-card px-4 py-2.5">
                  <MusicIcon size={15} color="#6b7280" />
                  <TextInput
                    value={playlistSearch}
                    onChangeText={setPlaylistSearch}
                    placeholder="Rechercher une playlist…"
                    placeholderTextColor="#6b7280"
                    className="flex-1 text-foreground text-sm"
                  />
                  {playlistSearch.length > 0 && (
                    <TouchableOpacity onPress={() => setPlaylistSearch('')}>
                      <Text className="text-muted-foreground text-sm px-1">✕</Text>
                    </TouchableOpacity>
                  )}
                </View>
                <View style={{ maxHeight: 300 }}>
                  <ScrollView showsVerticalScrollIndicator={false} nestedScrollEnabled>
                    {filteredPlaylists.map((p) => (
                      <TouchableOpacity
                        key={p.id}
                        onPress={() => setSelectedPlaylist(p)}
                        className={`mb-2 flex-row items-center gap-3 rounded-2xl border p-3 ${selectedPlaylist?.id === p.id ? 'border-[#1DB954] bg-[#1DB954]/10' : 'border-border bg-card'}`}>
                        {p.images?.[0]?.url ? (
                          <img src={p.images[0].url} style={{ width: 44, height: 44, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
                        ) : (
                          <View className="h-11 w-11 rounded-lg bg-muted items-center justify-center flex-shrink-0">
                            <MusicIcon size={18} color="#6b7280" />
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
                      <Text className="text-center text-muted-foreground py-4 text-sm">Aucun résultat pour "{playlistSearch}"</Text>
                    )}
                  </ScrollView>
                </View>
              </>
            )}

            {/* 3. Jours */}
            <SectionTitle>3 · Jours</SectionTitle>
            <View className="rounded-2xl border border-border bg-card p-4">
              <View className="flex-row gap-2 justify-between">
                {DAYS.map((d, i) => (
                  <TouchableOpacity
                    key={i}
                    onPress={() => toggleDay(i)}
                    className={`flex-1 items-center justify-center py-2.5 rounded-xl ${selectedDays.includes(i) ? 'bg-[#1DB954]' : 'bg-muted'}`}>
                    <Text className={`text-xs font-bold ${selectedDays.includes(i) ? 'text-white' : 'text-muted-foreground'}`}>
                      {d.charAt(0)}
                    </Text>
                    <Text className={`text-[9px] mt-0.5 ${selectedDays.includes(i) ? 'text-white/80' : 'text-muted-foreground/60'}`}>
                      {d.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              {selectedDays.length > 0 && (
                <Text className="mt-2 text-xs text-muted-foreground text-center">
                  {selectedDays.map((d) => DAYS[d]).join(' · ')}
                </Text>
              )}
            </View>

            {/* 4. Heure */}
            <SectionTitle>4 · Heure</SectionTitle>
            <View className="rounded-2xl border border-border bg-card p-4">
              <View className="flex-row items-center gap-4">
                <View className="flex-1">
                  <Text className="text-xs text-muted-foreground mb-2">Heure de déclenchement</Text>
                  <input
                    type="time"
                    step="60"
                    value={timeValue}
                    onChange={(e) => setTimeValue(e.target.value)}
                    style={{
                      background: 'transparent',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: 12,
                      padding: '10px 14px',
                      color: '#f9fafb',
                      fontSize: 28,
                      fontWeight: 'bold',
                      fontFamily: 'monospace',
                      width: '100%',
                      outline: 'none',
                      cursor: 'pointer',
                    }}
                  />
                </View>
                <View className="rounded-2xl bg-[#1DB954]/10 border border-[#1DB954]/30 px-5 py-4 items-center">
                  <Text className="font-mono text-3xl font-bold text-[#1DB954]">
                    {pad(hour)}:{pad(minute)}
                  </Text>
                  <Text className="text-[10px] text-[#1DB954]/60 mt-1 uppercase tracking-wider">heure locale</Text>
                </View>
              </View>
            </View>

            {/* 5. Options */}
            <SectionTitle>5 · Options de lecture</SectionTitle>
            <View className="rounded-2xl border border-border bg-card p-4 gap-0">
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center gap-3 flex-1">
                  <View className={`h-9 w-9 rounded-xl items-center justify-center ${shuffle ? 'bg-[#1DB954]/20' : 'bg-muted'}`}>
                    <ShuffleIcon size={17} color={shuffle ? '#1DB954' : '#6b7280'} />
                  </View>
                  <View>
                    <Text className="text-foreground font-semibold text-sm">Lecture aléatoire</Text>
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

            {/* 6. Appareil */}
            <SectionTitle>6 · Appareil <Text className="text-xs font-normal normal-case tracking-normal text-muted-foreground">(optionnel)</Text></SectionTitle>
            {loadingDevices ? (
              <View className="py-4 items-center">
                <ActivityIndicator color="#1DB954" size="small" />
              </View>
            ) : (
              <View className="gap-2">
                <TouchableOpacity
                  onPress={() => setSelectedDevice(null)}
                  className={`flex-row items-center gap-3 rounded-2xl border p-3.5 ${!selectedDevice ? 'border-[#1DB954] bg-[#1DB954]/10' : 'border-border bg-card'}`}>
                  <View className={`h-9 w-9 rounded-xl items-center justify-center ${!selectedDevice ? 'bg-[#1DB954]/20' : 'bg-muted'}`}>
                    <SpeakerIcon size={16} color={!selectedDevice ? '#1DB954' : '#6b7280'} />
                  </View>
                  <Text className={`flex-1 font-semibold text-sm ${!selectedDevice ? 'text-[#1DB954]' : 'text-foreground'}`}>
                    Appareil actif au déclenchement
                  </Text>
                  {!selectedDevice && <CheckCircleIcon size={18} color="#1DB954" />}
                </TouchableOpacity>
                {devices.length === 0 ? (
                  <Text className="text-xs text-muted-foreground px-1">
                    Aucun appareil Spotify actif. Ouvrez Spotify sur un appareil pour le voir ici.
                  </Text>
                ) : (
                  devices.map((d) => (
                    <TouchableOpacity
                      key={d.id}
                      onPress={() => setSelectedDevice(d)}
                      className={`flex-row items-center gap-3 rounded-2xl border p-3.5 ${selectedDevice?.id === d.id ? 'border-[#1DB954] bg-[#1DB954]/10' : 'border-border bg-card'}`}>
                      <View className={`h-9 w-9 rounded-xl items-center justify-center ${selectedDevice?.id === d.id ? 'bg-[#1DB954]/20' : 'bg-muted'}`}>
                        <DeviceIcon type={d.type} />
                      </View>
                      <View className="flex-1">
                        <Text className="text-foreground font-semibold text-sm">{d.name}</Text>
                        <Text className="text-xs text-muted-foreground capitalize">{d.type}{d.is_active ? ' · Actif' : ''}</Text>
                      </View>
                      {selectedDevice?.id === d.id && <CheckCircleIcon size={18} color="#1DB954" />}
                    </TouchableOpacity>
                  ))
                )}
              </View>
            )}

            {/* Résumé */}
            {selectedPlaylist && (
              <View className="mt-6 rounded-2xl border border-[#1DB954]/40 bg-[#1DB954]/5 p-4 gap-1">
                <Text className="mb-1 font-bold text-foreground text-sm">Résumé</Text>
                <Text className="text-sm text-muted-foreground">
                  <Text className="text-foreground font-semibold">{selectedAccount.displayName}</Text> · <Text className="text-[#1DB954] font-semibold">{selectedPlaylist.name}</Text>
                </Text>
                <Text className="text-sm text-muted-foreground">
                  {selectedDays.map((d) => DAYS[d]).join(', ') || '–'} à <Text className="font-mono text-foreground font-semibold">{pad(hour)}:{pad(minute)}</Text>
                </Text>
                <Text className="text-sm text-muted-foreground">
                  {shuffle ? 'Aléatoire' : 'Dans l\'ordre'} · {selectedDevice ? selectedDevice.name : 'Appareil actif'}
                </Text>
              </View>
            )}

            {conflictError && (
              <View className="mt-4 rounded-2xl border border-red-500/50 bg-red-500/10 px-4 py-3">
                <Text className="text-sm font-semibold text-red-400">Conflit</Text>
                <Text className="text-sm text-red-300 mt-1">{conflictError}</Text>
              </View>
            )}

            <TouchableOpacity
              onPress={handleSave}
              disabled={saving || !selectedPlaylist || selectedDays.length === 0}
              className="mt-4 flex-row items-center justify-center gap-3 rounded-2xl bg-[#1DB954] py-4 disabled:opacity-40">
              {saving ? (
                <ActivityIndicator color="white" />
              ) : (
                <CheckCircleIcon size={22} color="white" />
              )}
              <Text className="text-base font-bold text-white">
                {saving ? 'Enregistrement…' : 'Créer la planification'}
              </Text>
            </TouchableOpacity>
          </>
        )}

      </ScrollView>
    </>
  );
}
