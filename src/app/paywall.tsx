import { Disclaimer } from '@/components/disclaimer';
import { ProfileCard } from '@/components/profile-card';
import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { FREE_QUESTIONS } from '@/lib/access';
import { grantLifetimeAccess, useAuth } from '@/lib/auth-context';
import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';

export default function PaywallScreen() {
  const { user, profile, refreshProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const moneyProfile = profile?.money_profile;

  async function unlock() {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      await grantLifetimeAccess(user.id, profile?.xp ?? 0);
      await refreshProfile();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unlock failed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen
      footer={
        <>
          <Button label="Unlock unlimited questions — $19" onPress={unlock} loading={loading} />
          <Text style={styles.fine}>
            You already used your {FREE_QUESTIONS} free questions. One-time unlock. Stripe checkout comes next; this
            button opens the rest of the playground today.
          </Text>
          <Disclaimer />
        </>
      }>
      <Text style={styles.kicker}>The hook is set</Text>
      <Text style={styles.title}>Three questions in. The pile got interesting. That’s the point.</Text>
      <Text style={styles.lede}>
        Free taste is over. Lifetime access is unlimited What Ifs, saved scenarios, and a dashboard that keeps your
        numbers. No subscription.
      </Text>
      {moneyProfile ? <ProfileCard profile={moneyProfile} compact /> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  kicker: {
    color: '#C6F54A',
    fontWeight: '800',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  title: {
    color: '#F3ECDE',
    fontSize: 32,
    lineHeight: 36,
    fontWeight: '800',
  },
  lede: {
    color: '#9AA89F',
    fontSize: 16,
    lineHeight: 22,
  },
  fine: {
    color: '#6F7C74',
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
  error: {
    color: '#FF7A59',
  },
});
