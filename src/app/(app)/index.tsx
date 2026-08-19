import { Disclaimer } from '@/components/disclaimer';
import { ProfileCard } from '@/components/profile-card';
import { Card } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { money } from '@/lib/format';
import { leftoverMonthly } from '@/lib/money-math';
import { useAuth } from '@/lib/auth-context';
import { Link, type Href } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

export default function DashboardScreen() {
  const { profile } = useAuth();
  const q = profile?.questionnaire;
  const moneyProfile = profile?.money_profile;
  const leftover = q ? leftoverMonthly(q) : 0;
  const fiveYear = leftover * 12 * 5;

  return (
    <Screen tabBar>
      <Text style={styles.kicker}>XP {profile?.xp ?? 0}</Text>
      <Text style={styles.hello}>Hey {q?.name ?? 'player'}.</Text>
      <Text style={styles.lede}>This is your playground, not a report card.</Text>
      {moneyProfile ? <ProfileCard profile={moneyProfile} /> : null}
      {q ? (
        <View style={styles.grid}>
          <Mini label="Take-home" value={money(q.monthlyIncome)} />
          <Mini label="Housing" value={money(q.housing)} />
          <Mini label="Bills" value={money(q.otherBills)} />
          <Mini label="Treats" value={money(q.funMoney)} />
          <Mini label="Savings" value={money(q.savings)} />
          <Mini label="Debt" value={q.hasDebt ? money(q.debtAmount) : 'None'} />
        </View>
      ) : null}
      <Card>
        <Text style={styles.cardKicker}>Future-you, 5 years</Text>
        <Text style={styles.big}>{money(fiveYear)}</Text>
        <Text style={styles.muted}>
          If this month’s leftover kept stacking with zero interest and zero plot twists. Hypothetical. Very hypothetical.
        </Text>
        <Link href={'/what-if' as Href} style={styles.link}>
          Mess with that in What If? — 3 questions free →
        </Link>
      </Card>
      <Disclaimer />
    </Screen>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.mini}>
      <Text style={styles.miniLabel}>{label}</Text>
      <Text style={styles.miniValue}>{value}</Text>
    </View>
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
  hello: {
    color: '#F3ECDE',
    fontSize: 34,
    fontWeight: '800',
  },
  lede: {
    color: '#9AA89F',
    fontSize: 16,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  mini: {
    width: '47%',
    flexGrow: 1,
    backgroundColor: '#171E1B',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: '#24302A',
  },
  miniLabel: {
    color: '#9AA89F',
    fontSize: 12,
  },
  miniValue: {
    color: '#F3ECDE',
    fontSize: 18,
    fontWeight: '800',
  },
  cardKicker: {
    color: '#C6F54A',
    fontWeight: '800',
    textTransform: 'uppercase',
    fontSize: 12,
    letterSpacing: 1,
  },
  big: {
    color: '#F3ECDE',
    fontSize: 32,
    fontWeight: '800',
  },
  muted: {
    color: '#9AA89F',
    lineHeight: 20,
  },
  link: {
    color: '#C6F54A',
    fontWeight: '800',
    marginTop: 8,
  },
});
