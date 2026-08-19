import { Disclaimer } from '@/components/disclaimer';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { Field } from '@/components/ui/field';
import { Screen } from '@/components/ui/screen';
import { consumeQuestion, useAuth } from '@/lib/auth-context';
import {
  canAskQuestion,
  effectiveQuestionsAsked,
  FREE_QUESTIONS,
  questionsLeft,
  writeLocalAsked,
} from '@/lib/access';
import { money } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import type { SavedScenario, WhatIfResult } from '@/lib/types';
import { askMoney } from '@/lib/ask-money';
import { QUICK_PROMPTS } from '@/lib/what-if';
import { router, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

const KIND_LABEL: Record<string, string> = {
  'job-change': 'Work / pay',
  raise: 'Raise',
  'pay-cut': 'Pay cut',
  scarcity: 'Scarcity',
  runway: 'Runway',
  purchase: 'Transaction',
  breakdown: 'Breakdown',
  invest: 'Hypothetical',
  'debt-pay': 'Debt',
  'cut-habit': 'Habit',
  'extra-income': 'Income',
  'extra-save': 'Saving',
  'time-to-goal': 'Goal clock',
  'rent-change': 'Housing',
  inflation: 'Prices',
  general: 'Your numbers',
};

export default function WhatIfScreen() {
  const { user, profile, refreshProfile } = useAuth();
  const [prompt, setPrompt] = useState('');
  const [result, setResult] = useState<WhatIfResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [asking, setAsking] = useState(false);
  const [askError, setAskError] = useState<string | null>(null);
  const [history, setHistory] = useState<SavedScenario[]>([]);
  const [sessionAsked, setSessionAsked] = useState(0);
  const q = profile?.questionnaire;
  const asked = effectiveQuestionsAsked(profile, user?.id, sessionAsked);
  const left = questionsLeft(profile, user?.id, sessionAsked);
  const allowed = canAskQuestion(profile, user?.id, sessionAsked);

  useEffect(() => {
    setSessionAsked((prev) => Math.max(prev, effectiveQuestionsAsked(profile, user?.id, prev)));
  }, [profile?.questions_asked, user?.id]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('scenarios')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(8)
      .then(({ data }) => {
        if (data) setHistory(data as SavedScenario[]);
      });
  }, [user]);

  async function run(nextPrompt = prompt) {
    if (!q) return;
    if (!allowed) {
      router.push('/paywall' as Href);
      return;
    }
    if (asking) return;
    setPrompt(nextPrompt);
    setAsking(true);
    setAskError(null);
    try {
      const parsed = await askMoney(nextPrompt, q);
      setResult(parsed);
      if (user && !profile?.has_lifetime_access) {
        const nextAsked = asked + 1;
        setSessionAsked(nextAsked);
        writeLocalAsked(user.id, nextAsked);
        try {
          await consumeQuestion(user.id, nextAsked);
          await refreshProfile();
        } catch {
          // Local cap still holds if the database column is missing.
        }
      }
    } catch {
      setAskError('Could not finish that question. Try it again.');
    } finally {
      setAsking(false);
    }
  }

  async function save() {
    if (!user || !result) return;
    setSaving(true);
    const { data, error } = await supabase
      .from('scenarios')
      .insert({
        user_id: user.id,
        title: result.title,
        prompt: result.prompt,
        result,
      })
      .select('*')
      .single();
    if (!error && data) {
      setHistory((prev) => [data as SavedScenario, ...prev].slice(0, 8));
      await supabase.from('profiles').update({ xp: (profile?.xp ?? 0) + 25 }).eq('id', user.id);
      await refreshProfile();
    }
    setSaving(false);
  }

  return (
    <Screen
      tabBar
      footer={
        <>
          <Button
            label={
              asking
                ? 'Understanding the question...'
                : allowed
                  ? 'Ask the playground'
                  : 'Unlock to keep asking'
            }
            onPress={() => (allowed ? run() : router.push('/paywall' as Href))}
            disabled={asking || (allowed && !prompt.trim())}
            loading={asking}
          />
          <Disclaimer />
        </>
      }>
      <Text style={styles.kicker}>What If?</Text>
      <Text style={styles.free}>
        {profile?.has_lifetime_access
          ? 'Unlimited questions. You already unlocked the pile.'
          : left === 0
            ? `No free questions left. ${FREE_QUESTIONS} of ${FREE_QUESTIONS} used.`
            : `${left} of ${FREE_QUESTIONS} free questions left`}
      </Text>
      <Text style={styles.title}>Ask anything money. The pile answers back.</Text>
      <Text style={styles.lede}>
        Job offers, scarcity, purchases, raises, rent, debt, habits, hypothetical returns. Math when there is math. A
        straight answer when there isn’t. Never “you should.”
      </Text>
      <Field
        label="Your question"
        value={prompt}
        onChangeText={setPrompt}
        placeholder="What if I switch jobs for $80k a year?"
        multiline
      />
      <View style={styles.chips}>
        {QUICK_PROMPTS.map((item) => (
          <Chip
            key={item}
            label={shortPrompt(item)}
            selected={prompt === item}
            onPress={() => (allowed ? run(item) : router.push('/paywall' as Href))}
          />
        ))}
      </View>
      {askError ? <Text style={styles.error}>{askError}</Text> : null}
      {result ? (
        <Card>
          <Text style={[styles.resultKicker, result.hypothetical && styles.hypo, result.needsClarification && styles.clarify]}>
            {result.needsClarification
              ? 'Understanding first'
              : result.hypothetical
                ? 'Hypothetical'
                : KIND_LABEL[result.kind] ?? result.kind}
          </Text>
          {result.understoodAs ? <Text style={styles.understood}>{result.understoodAs}</Text> : null}
          <Text style={styles.resultTitle}>{result.title}</Text>
          <Text style={styles.body}>{result.body ?? result.disclaimer}</Text>
          {(result.rows ?? []).map((row) => (
            <View key={row.label} style={styles.horizon}>
              <Text style={styles.horizonLabel}>{row.label}</Text>
              <Text style={styles.horizonValue}>{row.value}</Text>
            </View>
          ))}
          {result.horizons?.length ? (
            <>
              <Text style={styles.section}>If that monthly shift kept going</Text>
              {result.horizons.map((h) => (
                <View key={h.label} style={styles.horizon}>
                  <Text style={styles.horizonLabel}>{h.label}</Text>
                  <Text style={styles.horizonValue}>{money(h.total)}</Text>
                </View>
              ))}
            </>
          ) : null}
          <Text style={styles.disclaimer}>{result.disclaimer}</Text>
          <Button label={saving ? 'Saving...' : 'Save this scenario'} variant="ghost" onPress={save} loading={saving} />
        </Card>
      ) : null}
      {history.length > 0 ? (
        <View style={styles.history}>
          <Text style={styles.historyTitle}>Saved plays</Text>
          {history.map((item) => (
            <Text key={item.id} style={styles.historyItem} onPress={() => (allowed ? run(item.prompt) : router.push('/paywall' as Href))}>
              {item.title}
            </Text>
          ))}
        </View>
      ) : null}
    </Screen>
  );
}

function shortPrompt(value: string) {
  if (value.includes('change jobs')) return 'New job';
  if (value.includes('raise')) return 'Raise';
  if (value.includes('lose my job')) return 'No paycheck';
  if (value.includes('afford')) return 'Can I buy';
  if (value.includes('rent')) return 'Rent up';
  if (value.includes('coffee')) return 'Coffee';
  if (value.includes('invest')) return 'Invest 7%';
  return 'Try this';
}

const styles = StyleSheet.create({
  kicker: {
    color: '#C6F54A',
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  free: {
    color: '#C6F54A',
    fontWeight: '700',
    fontSize: 14,
  },
  title: {
    color: '#F3ECDE',
    fontSize: 30,
    lineHeight: 34,
    fontWeight: '800',
  },
  lede: {
    color: '#9AA89F',
    fontSize: 16,
    lineHeight: 22,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  error: {
    color: '#FF7A59',
  },
  resultKicker: {
    color: '#C6F54A',
    fontWeight: '800',
    textTransform: 'uppercase',
    fontSize: 12,
    letterSpacing: 1,
  },
  hypo: {
    color: '#FF7A59',
  },
  clarify: {
    color: '#F3ECDE',
  },
  understood: {
    color: '#C6F54A',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
  },
  resultTitle: {
    color: '#F3ECDE',
    fontSize: 22,
    fontWeight: '800',
  },
  body: {
    color: '#F3ECDE',
    fontSize: 16,
    lineHeight: 24,
  },
  section: {
    color: '#9AA89F',
    fontWeight: '800',
    marginTop: 8,
    textTransform: 'uppercase',
    fontSize: 12,
    letterSpacing: 0.8,
  },
  horizon: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#24302A',
  },
  horizonLabel: {
    color: '#9AA89F',
    flex: 1,
  },
  horizonValue: {
    color: '#C6F54A',
    fontWeight: '800',
    fontSize: 15,
    textAlign: 'right',
  },
  disclaimer: {
    color: '#9AA89F',
    lineHeight: 20,
    fontSize: 13,
  },
  history: {
    gap: 8,
  },
  historyTitle: {
    color: '#F3ECDE',
    fontWeight: '800',
  },
  historyItem: {
    color: '#C6F54A',
    paddingVertical: 6,
  },
});
