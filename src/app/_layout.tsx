import { SessionProvider, useAuth } from '@/lib/auth-context';
import { PlaygroundBg } from '@/constants/theme';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  return (
    <SessionProvider>
      <StatusBar style="light" />
      <RootNavigator />
    </SessionProvider>
  );
}

function RootNavigator() {
  const { session, profile, isLoading, schemaError } = useAuth();

  if (!isLoading) {
    SplashScreen.hideAsync();
  }

  if (isLoading) {
    return (
      <View style={styles.boot}>
        <ActivityIndicator color="#C6F54A" />
      </View>
    );
  }

  if (schemaError) {
    return (
      <View style={styles.boot}>
        <Text style={styles.errorTitle}>Supabase needs one more SQL run</Text>
        <Text style={styles.errorBody}>
          Open the SQL Editor, paste supabase/schema.sql, and run it. Then refresh this page.
        </Text>
        <Text style={styles.errorMeta}>{schemaError}</Text>
      </View>
    );
  }

  const authed = !!session;
  const onboarded = !!profile?.onboarding_completed;
  const unlocked = !!profile?.has_lifetime_access;

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: PlaygroundBg },
        animation: 'fade',
      }}>
      <Stack.Protected guard={!authed}>
        <Stack.Screen name="sign-in" />
        <Stack.Screen name="sign-up" />
      </Stack.Protected>
      <Stack.Protected guard={authed && !onboarded}>
        <Stack.Screen name="onboarding" />
      </Stack.Protected>
      <Stack.Protected guard={authed && onboarded}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
      <Stack.Protected guard={authed && onboarded && !unlocked}>
        <Stack.Screen name="paywall" />
      </Stack.Protected>
    </Stack>
  );
}

const styles = StyleSheet.create({
  boot: {
    flex: 1,
    backgroundColor: PlaygroundBg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 12,
  },
  errorTitle: {
    color: '#C6F54A',
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
  },
  errorBody: {
    color: '#F3ECDE',
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
  },
  errorMeta: {
    color: '#9AA89F',
    fontSize: 12,
    textAlign: 'center',
  },
});
