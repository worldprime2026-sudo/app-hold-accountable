import { Disclaimer } from '@/components/disclaimer';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Screen } from '@/components/ui/screen';
import { saveQuestionnaire, useAuth } from '@/lib/auth-context';
import { parseMoney } from '@/lib/format';
import type { Questionnaire } from '@/lib/types';
import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';

export default function MeScreen() {
  const { profile, user, refreshProfile, signOut } = useAuth();
  const [q, setQ] = useState<Questionnaire | null>(profile?.questionnaire ?? null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function save() {
    if (!user || !q) return;
    setSaving(true);
    try {
      await saveQuestionnaire(user.id, q, profile?.xp ?? 0);
      await refreshProfile();
      setMessage('Numbers updated. Pulse recalculated. No lecture attached.');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Could not save.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen
      tabBar
      footer={
        <>
          <Button label="Save my numbers" onPress={save} loading={saving} disabled={!q} />
          <Button label="Sign out" variant="ghost" onPress={signOut} />
          <Disclaimer />
        </>
      }>
      <Text style={styles.kicker}>You</Text>
      <Text style={styles.title}>The numbers can change. That’s the point.</Text>
      {q ? (
        <>
          <Field label="Name" value={q.name} onChangeText={(name) => setQ({ ...q, name })} />
          <Field
            label="Monthly take-home"
            keyboardType="decimal-pad"
            value={String(q.monthlyIncome || '')}
            onChangeText={(v) => setQ({ ...q, monthlyIncome: parseMoney(v) })}
          />
          <Field
            label="Housing"
            keyboardType="decimal-pad"
            value={String(q.housing || '')}
            onChangeText={(v) => setQ({ ...q, housing: parseMoney(v) })}
          />
          <Field
            label="Other bills"
            keyboardType="decimal-pad"
            value={String(q.otherBills || '')}
            onChangeText={(v) => setQ({ ...q, otherBills: parseMoney(v) })}
          />
          <Field
            label="Treats / leaks"
            keyboardType="decimal-pad"
            value={String(q.funMoney || '')}
            onChangeText={(v) => setQ({ ...q, funMoney: parseMoney(v) })}
          />
          <Field
            label="Savings"
            keyboardType="decimal-pad"
            value={String(q.savings || '')}
            onChangeText={(v) => setQ({ ...q, savings: parseMoney(v) })}
          />
          <Field
            label="Debt total"
            keyboardType="decimal-pad"
            value={String(q.debtAmount || '')}
            onChangeText={(v) => setQ({ ...q, debtAmount: parseMoney(v), hasDebt: parseMoney(v) > 0 })}
          />
          <Field
            label="Debt minimum / month"
            keyboardType="decimal-pad"
            value={String(q.debtMinPayment || '')}
            onChangeText={(v) => setQ({ ...q, debtMinPayment: parseMoney(v) })}
          />
        </>
      ) : (
        <Text style={styles.muted}>No questionnaire saved yet.</Text>
      )}
      {message ? <Text style={styles.message}>{message}</Text> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  kicker: {
    color: '#C6F54A',
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  title: {
    color: '#F3ECDE',
    fontSize: 30,
    lineHeight: 34,
    fontWeight: '800',
  },
  muted: {
    color: '#9AA89F',
  },
  message: {
    color: '#C6F54A',
  },
});
