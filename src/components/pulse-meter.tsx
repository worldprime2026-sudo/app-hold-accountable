import { Spacing } from '@/constants/theme';
import { StyleSheet, Text, View } from 'react-native';

export function PulseMeter({ pulse, label }: { pulse: number; label: string }) {
  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <Text style={styles.kicker}>Money Pulse</Text>
        <Text style={styles.score}>{pulse}</Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${pulse}%` }]} />
      </View>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  kicker: {
    color: '#9AA89F',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  score: {
    color: '#C6F54A',
    fontSize: 28,
    fontWeight: '800',
  },
  track: {
    height: 12,
    borderRadius: 999,
    backgroundColor: '#24302A',
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    backgroundColor: '#C6F54A',
    borderRadius: 999,
  },
  label: {
    color: '#F3ECDE',
    fontSize: 16,
    fontWeight: '700',
  },
});
