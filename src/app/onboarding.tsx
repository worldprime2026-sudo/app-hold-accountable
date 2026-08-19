import { Disclaimer } from '@/components/disclaimer';
import { canContinue, createDraft, STEPS, TOTAL_STEPS } from '@/components/onboarding/steps';
import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { saveOnboarding, useAuth } from '@/lib/auth-context';
import type { Questionnaire } from '@/lib/types';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

export default function OnboardingScreen() {
  const { user, refreshProfile } = useAuth();
  const [step, setStep] = useState(0);
  const [q, setQ] = useState<Questionnaire>(createDraft);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const current = STEPS[step];
  const Body = current.Body;
  const last = step === TOTAL_STEPS - 1;

  async function next() {
    if (!canContinue(step, q)) return;
    if (!last) {
      setStep((n) => n + 1);
      return;
    }
    if (!user) return;
    setSaving(true);
    setError(null);
    try {
      await saveOnboarding(user.id, q);
      await refreshProfile();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save your profile.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen
      footer={
        <>
          <Button
            label={last ? 'Build my Money Profile' : 'Keep going'}
            onPress={next}
            loading={saving}
            disabled={!canContinue(step, q)}
          />
          {step > 0 ? <Button label="Back" variant="ghost" onPress={() => setStep((n) => n - 1)} /> : null}
          <Disclaimer />
        </>
      }>
      <Text style={styles.progress}>
        Honesty meter {step + 1} / {TOTAL_STEPS}
      </Text>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${((step + 1) / TOTAL_STEPS) * 100}%` }]} />
      </View>
      <Text style={styles.kicker}>{current.kicker}</Text>
      <Text style={styles.title}>{current.title}</Text>
      <Text style={styles.hint}>{current.hint}</Text>
      <Body q={q} setQ={setQ} />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  progress: {
    color: '#C6F54A',
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
    fontSize: 12,
  },
  track: {
    height: 8,
    backgroundColor: '#24302A',
    borderRadius: 99,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    backgroundColor: '#C6F54A',
  },
  kicker: {
    color: '#9AA89F',
    fontWeight: '700',
  },
  title: {
    color: '#F3ECDE',
    fontSize: 30,
    lineHeight: 34,
    fontWeight: '800',
  },
  hint: {
    color: '#9AA89F',
    fontSize: 16,
    lineHeight: 22,
  },
  error: {
    color: '#FF7A59',
  },
});
