import { Disclaimer } from '@/components/disclaimer';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Screen } from '@/components/ui/screen';
import { supabase } from '@/lib/supabase';
import { Link, type Href } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

export default function SignUpScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit() {
    setError(null);
    setInfo(null);
    setLoading(true);
    const { data, error: nextError } = await supabase.auth.signUp({ email: email.trim(), password });
    setLoading(false);
    if (nextError) {
      setError(nextError.message);
      return;
    }
    if (!data.session) {
      setInfo('Account created, but email confirmation is still on. Turn Confirm email off in Auth settings, or check your inbox.');
    }
  }

  return (
    <Screen
      footer={
        <>
          <Button label="Create my account" onPress={onSubmit} loading={loading} disabled={!email || password.length < 6} />
          <Disclaimer />
        </>
      }>
      <Text style={styles.kicker}>Join the playground</Text>
      <Text style={styles.title}>One account. Lifetime of honest math.</Text>
      <Text style={styles.lede}>
        After this, a short questionnaire. Then a roast. Then the gate. No subscription energy.
      </Text>
      <Field
        label="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
        placeholder="you@email.com"
      />
      <Field
        label="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        placeholder="at least 6 characters"
        hint="Supabase wants 6+. Make it something you will actually remember."
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {info ? <Text style={styles.info}>{info}</Text> : null}
      <View style={styles.row}>
        <Text style={styles.muted}>Already in?</Text>
        <Link href={'/sign-in' as Href} style={styles.link}>
          Sign in
        </Link>
      </View>
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
    fontSize: 34,
    lineHeight: 38,
    fontWeight: '800',
  },
  lede: {
    color: '#9AA89F',
    fontSize: 16,
    lineHeight: 24,
  },
  error: {
    color: '#FF7A59',
  },
  info: {
    color: '#C6F54A',
    lineHeight: 20,
  },
  row: {
    flexDirection: 'row',
    gap: 6,
  },
  muted: {
    color: '#9AA89F',
  },
  link: {
    color: '#C6F54A',
    fontWeight: '700',
  },
});
