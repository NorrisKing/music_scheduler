import { THEME } from '@/lib/theme';
import { Link, Stack } from 'expo-router';
import { MoonStarIcon, StarIcon, SunIcon } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import * as React from 'react';
import { Image, type ImageStyle, View, Text, TouchableOpacity } from 'react-native';
import { BACKEND_URL, apiRequest } from '@/lib/api';

const LOGO = {
  light: require('@/assets/images/react-native-reusables-light.png'),
  dark: require('@/assets/images/react-native-reusables-dark.png'),
};

const SCREEN_OPTIONS = {
  light: {
    title: 'React Native Reusables',
    headerTransparent: true,
    headerShadowVisible: true,
    headerStyle: { backgroundColor: THEME.light.background },
    headerRight: () => <ThemeToggle />,
  },
  dark: {
    title: 'React Native Reusables',
    headerTransparent: true,
    headerShadowVisible: true,
    headerStyle: { backgroundColor: THEME.dark.background },
    headerRight: () => <ThemeToggle />,
  },
};

const IMAGE_STYLE: ImageStyle = {
  height: 76,
  width: 76,
};

export default function Screen() {
  const { colorScheme } = useColorScheme();
  const [apiResponse, setApiResponse] = React.useState<string>('');
  const [isLoading, setIsLoading] = React.useState(false);

  // Example: Test API connection
  const testApiConnection = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${BACKEND_URL}/`);
      const text = await response.text();
      setApiResponse(text);
    } catch (error) {
      setApiResponse(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Stack.Screen options={SCREEN_OPTIONS[colorScheme ?? 'light']} />
      <View className="flex-1 items-center justify-center gap-8 p-4">
        <Image source={LOGO[colorScheme ?? 'light']} style={IMAGE_STYLE} resizeMode="contain" />
        <View className="gap-2 p-4">
          <Text className="ios:text-foreground font-mono text-sm text-muted-foreground">
            1. Edit <Text className="font-mono">app/index.tsx</Text> to get started.
          </Text>
          <Text className="ios:text-foreground font-mono text-sm text-muted-foreground">
            2. Save to see your changes instantly.
          </Text>
          <Text className="ios:text-foreground mt-2 font-mono text-xs text-muted-foreground">
            API: {BACKEND_URL}
          </Text>
        </View>
        <View className="items-center gap-2 p-4">
          <TouchableOpacity
            onPress={testApiConnection}
            disabled={isLoading}
            className="rounded-md bg-secondary px-4 py-2">
            <Text className="text-secondary-foreground">
              {isLoading ? 'Testing...' : 'Test API Connection'}
            </Text>
          </TouchableOpacity>
          {apiResponse && (
            <Text className="ios:text-foreground font-mono text-xs text-muted-foreground">
              Response: {apiResponse}
            </Text>
          )}
        </View>
        <View className="flex-row gap-2">
          <Link href="https://reactnativereusables.com" asChild>
            <TouchableOpacity className="rounded-md bg-primary px-4 py-2">
              <Text className="text-primary-foreground">Browse the Docs</Text>
            </TouchableOpacity>
          </Link>
          <Link href="https://github.com/founded-labs/react-native-reusables" asChild>
            <TouchableOpacity className="flex-row items-center gap-2 rounded-md px-4 py-2">
              <Text>Star the Repo</Text>
              <StarIcon size={16} />
            </TouchableOpacity>
          </Link>
        </View>
      </View>
    </>
  );
}

const THEME_ICONS = {
  light: SunIcon,
  dark: MoonStarIcon,
};

function ThemeToggle() {
  const { colorScheme, toggleColorScheme } = useColorScheme();
  const IconComponent = THEME_ICONS[colorScheme ?? 'light'];

  return (
    <TouchableOpacity onPress={toggleColorScheme} className="rounded-full p-2 web:mx-4">
      <IconComponent size={20} />
    </TouchableOpacity>
  );
}
