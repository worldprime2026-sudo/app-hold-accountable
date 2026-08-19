import { Chip } from '@/components/ui/chip';
import { Field } from '@/components/ui/field';
import { parseMoney } from '@/lib/format';
import type { CheckHabit, ImpulseHabit, MoneyGoal, MoneyMood, Questionnaire } from '@/lib/types';
import type { ReactElement } from 'react';
import { StyleSheet, Text, View } from 'react-native';

const emptyQuestionnaire: Questionnaire = {
  name: '',
  moneyMood: 'fine',
  monthlyIncome: 0,
  housing: 0,
  otherBills: 0,
  funMoney: 0,
  hasDebt: false,
  debtAmount: 0,
  debtMinPayment: 0,
  savings: 0,
  goal: 'dont-know',
  checkAccounts: 'monthly',
  impulse: 'sometimes',
};

const moods: { id: MoneyMood; label: string }[] = [
  { id: 'anxious', label: 'Anxious' },
  { id: 'avoidant', label: 'I look away' },
  { id: 'chaotic', label: 'Chaotic spender' },
  { id: 'curious', label: 'Curious' },
  { id: 'fine', label: 'Fine, I guess' },
];

const goals: { id: MoneyGoal; label: string }[] = [
  { id: 'emergency', label: 'A cushion' },
  { id: 'debt', label: 'Less debt' },
  { id: 'breathing-room', label: 'Breathing room' },
  { id: 'future-flex', label: 'Future flex' },
  { id: 'dont-know', label: "I don't know yet" },
];

const checks: { id: CheckHabit; label: string }[] = [
  { id: 'daily', label: 'Daily' },
  { id: 'weekly', label: 'Weekly' },
  { id: 'monthly', label: 'Monthly-ish' },
  { id: 'never', label: 'What accounts' },
];

const impulses: { id: ImpulseHabit; label: string }[] = [
  { id: 'rarely', label: 'Rarely' },
  { id: 'sometimes', label: 'Sometimes' },
  { id: 'often', label: 'Often' },
  { id: 'lifestyle', label: "It's a lifestyle" },
];

export const TOTAL_STEPS = 10;

export function createDraft(): Questionnaire {
  return { ...emptyQuestionnaire };
}

export function canContinue(step: number, q: Questionnaire) {
  if (step === 0) return q.name.trim().length > 1;
  if (step === 2) return q.monthlyIncome > 0;
  if (step === 6) return !q.hasDebt || q.debtAmount > 0;
  return true;
}

type StepProps = {
  q: Questionnaire;
  setQ: (next: Questionnaire) => void;
};

function Chips<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { id: T; label: string }[];
  value: T;
  onChange: (id: T) => void;
}) {
  return (
    <View style={styles.chips}>
      {options.map((option) => (
        <Chip key={option.id} label={option.label} selected={value === option.id} onPress={() => onChange(option.id)} />
      ))}
    </View>
  );
}

export const STEPS: { kicker: string; title: string; hint: string; Body: (props: StepProps) => ReactElement }[] = [
  {
    kicker: 'Callsign',
    title: 'What should Future-you call you?',
    hint: 'First name is fine. Nicknames are funnier.',
    Body: ({ q, setQ }) => (
      <Field label="Name" value={q.name} onChangeText={(name) => setQ({ ...q, name })} placeholder="Maya, Jay, Chaos..." />
    ),
  },
  {
    kicker: 'Vibe check',
    title: 'When money texts you, do you leave it on read?',
    hint: 'No wrong answers. Avoidance is a personality, not a crime.',
    Body: ({ q, setQ }) => <Chips options={moods} value={q.moneyMood} onChange={(moneyMood) => setQ({ ...q, moneyMood })} />,
  },
  {
    kicker: 'Income',
    title: "What's the monthly take-home? The real number.",
    hint: 'After tax, if you know it. Ballpark is still a number.',
    Body: ({ q, setQ }) => (
      <Field
        label="Monthly take-home"
        keyboardType="decimal-pad"
        value={q.monthlyIncome ? String(q.monthlyIncome) : ''}
        onChangeText={(v) => setQ({ ...q, monthlyIncome: parseMoney(v) })}
        placeholder="3200"
      />
    ),
  },
  {
    kicker: 'Roof',
    title: 'What does the roof cost each month?',
    hint: 'Rent, mortgage, the cousin who "lets you stay."',
    Body: ({ q, setQ }) => (
      <Field
        label="Housing"
        keyboardType="decimal-pad"
        value={q.housing ? String(q.housing) : ''}
        onChangeText={(v) => setQ({ ...q, housing: parseMoney(v) })}
        placeholder="1400"
      />
    ),
  },
  {
    kicker: 'Bills',
    title: 'Everything else that bills you on autopilot.',
    hint: 'Utilities, phone, subscriptions you forgot were still alive.',
    Body: ({ q, setQ }) => (
      <Field
        label="Other recurring bills"
        keyboardType="decimal-pad"
        value={q.otherBills ? String(q.otherBills) : ''}
        onChangeText={(v) => setQ({ ...q, otherBills: parseMoney(v) })}
        placeholder="380"
      />
    ),
  },
  {
    kicker: 'Leaks',
    title: 'Coffee, delivery, little treats. Monthly ballpark.',
    hint: 'Honesty meter is on. Future-you already knows.',
    Body: ({ q, setQ }) => (
      <Field
        label="Fun / leaks each month"
        keyboardType="decimal-pad"
        value={q.funMoney ? String(q.funMoney) : ''}
        onChangeText={(v) => setQ({ ...q, funMoney: parseMoney(v) })}
        placeholder="250"
      />
    ),
  },
  {
    kicker: 'Debt',
    title: 'Is anything chasing you with interest?',
    hint: 'Cards, loans, the buy-now-cry-later pile.',
    Body: ({ q, setQ }) => (
      <View style={styles.stack}>
        <Chips
          options={[
            { id: 'no', label: 'No debt' },
            { id: 'yes', label: 'Yes, there is debt' },
          ]}
          value={q.hasDebt ? 'yes' : 'no'}
          onChange={(id) => setQ({ ...q, hasDebt: id === 'yes' })}
        />
        {q.hasDebt ? (
          <>
            <Field
              label="About how much"
              keyboardType="decimal-pad"
              value={q.debtAmount ? String(q.debtAmount) : ''}
              onChangeText={(v) => setQ({ ...q, debtAmount: parseMoney(v) })}
              placeholder="4500"
            />
            <Field
              label="Minimum payment / month"
              keyboardType="decimal-pad"
              value={q.debtMinPayment ? String(q.debtMinPayment) : ''}
              onChangeText={(v) => setQ({ ...q, debtMinPayment: parseMoney(v) })}
              placeholder="120"
            />
          </>
        ) : null}
      </View>
    ),
  },
  {
    kicker: 'Stash',
    title: "What's sitting in savings, even if it's shy?",
    hint: 'Zero is a number. We will not gasp.',
    Body: ({ q, setQ }) => (
      <Field
        label="Savings"
        keyboardType="decimal-pad"
        value={q.savings ? String(q.savings) : ''}
        onChangeText={(v) => setQ({ ...q, savings: parseMoney(v) })}
        placeholder="600"
      />
    ),
  },
  {
    kicker: 'Wish',
    title: 'If money could do you a favor this year...',
    hint: 'Pick the vibe, not a 40-year plan.',
    Body: ({ q, setQ }) => <Chips options={goals} value={q.goal} onChange={(goal) => setQ({ ...q, goal })} />,
  },
  {
    kicker: 'Habits',
    title: 'How often do you peek — and how often do you tap buy?',
    hint: 'Two tiny truths. Then we make your profile.',
    Body: ({ q, setQ }) => (
      <View style={styles.stack}>
        <Text style={styles.sub}>Checking accounts</Text>
        <Chips options={checks} value={q.checkAccounts} onChange={(checkAccounts) => setQ({ ...q, checkAccounts })} />
        <Text style={styles.sub}>Impulse buys</Text>
        <Chips options={impulses} value={q.impulse} onChange={(impulse) => setQ({ ...q, impulse })} />
      </View>
    ),
  },
];

const styles = StyleSheet.create({
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  stack: {
    gap: 14,
  },
  sub: {
    color: '#9AA89F',
    fontWeight: '700',
    textTransform: 'uppercase',
    fontSize: 12,
    letterSpacing: 0.8,
  },
});
