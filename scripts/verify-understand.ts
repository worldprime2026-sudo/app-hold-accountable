import { understandQuestion } from '../src/lib/understand-question';
import type { Questionnaire } from '../src/lib/types';

const q: Questionnaire = {
  name: 'Test',
  moneyMood: 'curious',
  monthlyIncome: 5000,
  housing: 1800,
  otherBills: 700,
  funMoney: 300,
  hasDebt: true,
  debtAmount: 8000,
  debtMinPayment: 200,
  savings: 4000,
  goal: 'breathing-room',
  checkAccounts: 'weekly',
  impulse: 'sometimes',
};

const cases: { ask: string; expect: (u: ReturnType<typeof understandQuestion>) => string | null }[] = [
  {
    ask: 'what if I get a raise from 60k to 80k',
    expect: (u) => {
      if (!u.readyToCompute) return 'should compute';
      if (Math.round(u.extracted.currentIncomeMonthly ?? 0) !== 5000) return `current ${u.extracted.currentIncomeMonthly}`;
      if (Math.round(u.extracted.newIncomeMonthly ?? 0) !== 6667) return `next ${u.extracted.newIncomeMonthly}`;
      return null;
    },
  },
  {
    ask: 'I earn 40k, what if I earn 80k',
    expect: (u) => {
      if (Math.round(u.extracted.currentIncomeMonthly ?? 0) !== 3333) return `current ${u.extracted.currentIncomeMonthly}`;
      if (Math.round(u.extracted.newIncomeMonthly ?? 0) !== 6667) return `next ${u.extracted.newIncomeMonthly}`;
      return null;
    },
  },
  {
    ask: 'what if I cannot work because of an accident and have no payroll for 3 months',
    expect: (u) => {
      if (u.extracted.kind !== 'scarcity') return `kind ${u.extracted.kind}`;
      if (u.extracted.pauseMonths !== 3) return `pause ${u.extracted.pauseMonths}`;
      if (u.extracted.newIncomeMonthly != null) return 'invented new pay';
      if (!u.understoodAs.includes('duration')) return 'did not name duration';
      return null;
    },
  },
  {
    ask: 'I have 3 dogs',
    expect: (u) => (u.readyToCompute ? 'should not invent a calculation' : null),
  },
  {
    ask: 'what if I have to pay 700 dollars of unexpected expense',
    expect: (u) => {
      if (u.extracted.kind !== 'purchase') return `kind ${u.extracted.kind}`;
      if (u.extracted.oneTimePurchase !== 700) return `cost ${u.extracted.oneTimePurchase}`;
      if (u.extracted.newIncomeMonthly != null) return 'treated as a paycheck';
      return null;
    },
  },
  {
    ask: 'What happens if a recession hits and I my salary decreases by 15%',
    expect: (u) => {
      if (u.extracted.kind !== 'pay-cut') return `kind ${u.extracted.kind}`;
      if (u.extracted.percentChange == null || u.extracted.percentChange >= 0) {
        return `percent ${u.extracted.percentChange}`;
      }
      if (Math.round(Math.abs(u.extracted.percentChange) * 100) !== 15) return `pct ${u.extracted.percentChange}`;
      if (u.understoodAs.toLowerCase().includes('rises')) return 'said rises';
      return null;
    },
  },
  {
    ask: 'what if I get a 15% raise',
    expect: (u) => {
      if (u.extracted.kind !== 'raise') return `kind ${u.extracted.kind}`;
      if ((u.extracted.percentChange ?? 0) <= 0) return `percent ${u.extracted.percentChange}`;
      return null;
    },
  },
  {
    ask: 'what if rent is 2200',
    expect: (u) => (u.extracted.kind === 'rent-change' && Math.round(u.extracted.rentMonthly ?? 0) === 2200 ? null : 'rent'),
  },
];

let failed = 0;
for (const item of cases) {
  const got = understandQuestion(item.ask, q);
  const err = item.expect(got);
  if (err) {
    failed += 1;
    console.error(`FAIL: ${item.ask}\n  ${err}\n  ${got.understoodAs}\n  ${JSON.stringify(got.extracted)}`);
  } else {
    console.log(`ok: ${item.ask}`);
  }
}

if (failed) {
  console.error(`${failed} failed`);
  process.exit(1);
}

console.log('all understand cases passed');
