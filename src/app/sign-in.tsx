import { Disclaimer } from '@/components/disclaimer';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Screen } from '@/components/ui/screen';
import { supabase } from '@/lib/supabase';
import { Link, type Href } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

export default function SignInScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit() {
    setError(null);
    setLoading(true);
    const { error: nextError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if (nextError) setError(nextError.message);
  }

  return (
    <Screen
      footer={
        <>
          <Button label="Enter the playground" onPress={onSubmit} loading={loading} disabled={!email || !password} />
          <Disclaimer />
        </>
      }>
      <Text style={styles.kicker}>Money Playground</Text>
      <Text style={styles.title}>Your money has a personality. Let’s meet it.</Text>
      <Text style={styles.lede}>
        We don’t tell you what to do with your money. We make the numbers too honest to ignore — with jokes, sliders, and
        a very patient calculator.
      </Text>
      <Field
        label="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
        placeholder="you@email.com"
      />
      <Field label="Password" secureTextEntry value={password} onChangeText={setPassword} placeholder="••••••••" />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={styles.row}>
        <Text style={styles.muted}>New here?</Text>
        <Link href={'/sign-up' as Href} style={styles.link}>
          Create an account
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
    fontSize: 36,
    lineHeight: 40,
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
  row: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  muted: {
    color: '#9AA89F',
  },
  link: {
    color: '#C6F54A',
    fontWeight: '700',
  },
});
