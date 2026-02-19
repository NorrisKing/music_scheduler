import { Link, Stack } from 'expo-router';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { CalendarDaysIcon, UsersIcon, MusicIcon } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';

export default function HomeScreen() {
  const { colorScheme, toggleColorScheme } = useColorScheme();

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Spotify Scheduler',
          headerRight: () => (
            <TouchableOpacity onPress={toggleColorScheme} className="p-2">
              <Text className="text-foreground">{colorScheme === 'dark' ? '☀️' : '🌙'}</Text>
            </TouchableOpacity>
          ),
        }}
      />
      <View className="flex-1 bg-background p-6">
        {/* Header */}
        <View className="mb-8 items-center pt-6">
          <View className="mb-4 h-20 w-20 items-center justify-center rounded-full bg-[#1DB954]">
            <MusicIcon size={40} color="white" />
          </View>
          <Text className="text-foreground text-3xl font-bold">Spotify Scheduler</Text>
          <Text className="mt-2 text-center text-muted-foreground">
            Programmez vos playlists sur plusieurs comptes Spotify
          </Text>
        </View>

        {/* Nav cards */}
        <View className="gap-4">
          <Link href="/accounts" asChild>
            <TouchableOpacity className="flex-row items-center gap-4 rounded-2xl border border-border bg-card p-5">
              <View className="h-12 w-12 items-center justify-center rounded-xl bg-[#1DB954]/15">
                <UsersIcon size={24} color="#1DB954" />
              </View>
              <View className="flex-1">
                <Text className="text-foreground text-lg font-semibold">Comptes Spotify</Text>
                <Text className="text-muted-foreground text-sm">
                  Connecter et gérer vos comptes
                </Text>
              </View>
              <Text className="text-muted-foreground">›</Text>
            </TouchableOpacity>
          </Link>

          <Link href="/schedules" asChild>
            <TouchableOpacity className="flex-row items-center gap-4 rounded-2xl border border-border bg-card p-5">
              <View className="h-12 w-12 items-center justify-center rounded-xl bg-blue-500/15">
                <CalendarDaysIcon size={24} color="#3b82f6" />
              </View>
              <View className="flex-1">
                <Text className="text-foreground text-lg font-semibold">Planifications</Text>
                <Text className="text-muted-foreground text-sm">
                  Programmer vos playlists
                </Text>
              </View>
              <Text className="text-muted-foreground">›</Text>
            </TouchableOpacity>
          </Link>
        </View>

        {/* Info */}
        <View className="mt-8 rounded-2xl bg-muted p-4">
          <Text className="mb-1 font-semibold text-foreground">Comment ça marche ?</Text>
          <Text className="text-sm text-muted-foreground">
            1. Connectez vos comptes Spotify{'\n'}
            2. Créez une planification (playlist + jours + heure){'\n'}
            3. Le serveur déclenchera la lecture automatiquement
          </Text>
        </View>
      </View>
    </>
  );
}
