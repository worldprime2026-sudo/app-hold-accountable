import { Card } from '@/components/ui/card';
import { PulseMeter } from '@/components/pulse-meter';
import { money } from '@/lib/format';
import type { MoneyProfile } from '@/lib/types';
import { StyleSheet, Text, View } from 'react-native';

const toneColor = {
  roast: '#FF7A59',
  strength: '#C6F54A',
  pattern: '#F3ECDE',
};

export function ProfileCard({ profile, compact = false }: { profile: MoneyProfile; compact?: boolean }) {
  return (
    <Card>
      <Text style={styles.kicker}>Money Profile</Text>
      <Text style={styles.title}>{profile.title}</Text>
      <Text style={styles.tagline}>{profile.tagline}</Text>
      <PulseMeter pulse={profile.pulse} label={profile.pulseLabel} />
      <View style={styles.stats}>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>Left this month</Text>
          <Text style={[styles.statValue, profile.leftover < 0 && styles.negative]}>{money(profile.leftover)}</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>Treats / year</Text>
          <Text style={styles.statValue}>{money(profile.leakAnnual)}</Text>
        </View>
      </View>
      {!compact
        ? profile.insights.map((insight) => (
            <View key={insight.title} style={styles.insight}>
              <Text style={[styles.insightTone, { color: toneColor[insight.tone] }]}>{insight.tone}</Text>
              <Text style={styles.insightTitle}>{insight.title}</Text>
              <Text style={styles.insightBody}>{insight.body}</Text>
            </View>
          ))
        : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  kicker: {
    color: '#C6F54A',
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    fontSize: 12,
  },
  title: {
    color: '#F3ECDE',
    fontSize: 28,
    fontWeight: '800',
    lineHeight: 32,
  },
  tagline: {
    color: '#9AA89F',
    fontSize: 16,
    lineHeight: 22,
  },
  stats: {
    flexDirection: 'row',
    gap: 12,
  },
  stat: {
    flex: 1,
    backgroundColor: '#101714',
    borderRadius: 16,
    padding: 12,
    gap: 4,
  },
  statLabel: {
    color: '#9AA89F',
    fontSize: 12,
  },
  statValue: {
    color: '#F3ECDE',
    fontSize: 18,
    fontWeight: '800',
  },
  negative: {
    color: '#FF7A59',
  },
  insight: {
    gap: 4,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#24302A',
  },
  insightTone: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  insightTitle: {
    color: '#F3ECDE',
    fontSize: 16,
    fontWeight: '700',
  },
  insightBody: {
    color: '#9AA89F',
    fontSize: 14,
    lineHeight: 20,
  },
});
