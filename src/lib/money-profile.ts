import { leftoverMonthly } from '@/lib/money-math';
import { clamp } from '@/lib/format';
import type { Insight, MoneyProfile, Questionnaire } from '@/lib/types';

const TITLES: Record<Questionnaire['moneyMood'], string[]> = {
  anxious: ['The Spreadsheet Ghost', 'High-Alert Budget Spirit'],
  avoidant: ['Head-in-the-Sand Treasurer', "Don't-Look-Now"],
  chaotic: ['Chief of Tiny Leaks', 'Impulse Astronaut'],
  curious: ['Leak Detective (Trainee)', 'Future-You Intern'],
  fine: ['Fine-Until-It-Isnt', 'Casual Cash Tourist'],
};

function pulseLabel(pulse: number) {
  if (pulse < 25) return 'Head in the sand';
  if (pulse < 45) return 'Getting warmer';
  if (pulse < 65) return 'Leak detective';
  if (pulse < 85) return "Future-you's intern";
  return 'Main character energy';
}

export function buildMoneyProfile(q: Questionnaire): MoneyProfile {
  const leftover = leftoverMonthly(q);
  const totalBills = q.housing + q.otherBills + (q.hasDebt ? q.debtMinPayment : 0);
  const leakAnnual = q.funMoney * 12;
  const income = Math.max(q.monthlyIncome, 1);
  const leftoverRatio = leftover / income;
  const savingsMonths = totalBills > 0 ? q.savings / totalBills : q.savings > 0 ? 99 : 0;

  let pulse = 50;
  if (leftoverRatio > 0.2) pulse += 16;
  else if (leftover > 0) pulse += 8;
  else if (leftover < 0) pulse -= 18;

  if (savingsMonths >= 3) pulse += 12;
  else if (savingsMonths >= 1) pulse += 6;
  else if (q.savings <= 0) pulse -= 8;

  if (q.checkAccounts === 'daily' || q.checkAccounts === 'weekly') pulse += 6;
  if (q.checkAccounts === 'never') pulse -= 10;
  if (q.impulse === 'rarely') pulse += 6;
  if (q.impulse === 'often') pulse -= 8;
  if (q.impulse === 'lifestyle') pulse -= 14;
  if (q.moneyMood === 'curious') pulse += 4;
  if (q.moneyMood === 'avoidant') pulse -= 6;
  if (q.hasDebt && q.debtAmount > income * 6) pulse -= 6;

  pulse = clamp(Math.round(pulse), 4, 99);

  const titles = TITLES[q.moneyMood];
  const title = leftover < 0 ? 'The Optimistic Overdraft' : leakAnnual > income * 2 ? 'Chief of Tiny Leaks' : titles[0];

  const insights: Insight[] = [];

  if (leftover < 0) {
    insights.push({
      tone: 'pattern',
      title: 'The month is overspent on paper',
      body: `After bills and fun money, the numbers land ${Math.abs(Math.round(leftover))} in the red each month. That is not a lecture. It is just gravity.`,
    });
  } else {
    insights.push({
      tone: 'strength',
      title: 'There is a little air in here',
      body: `${Math.round(leftover)} a month is still sitting after the usual stuff. That is the pile "what if" likes to play with.`,
    });
  }

  if (q.funMoney > 0) {
    insights.push({
      tone: 'roast',
      title: 'A loyal leak has been identified',
      body: `${Math.round(q.funMoney)} a month in treats and outings is ${Math.round(leakAnnual)} a year. Not good. Not bad. Very employed, those dollars.`,
    });
  }

  if (q.hasDebt && q.debtAmount > 0) {
    insights.push({
      tone: 'pattern',
      title: 'Debt is sitting in the room',
      body: `${Math.round(q.debtAmount)} on the books, with ${Math.round(q.debtMinPayment)} leaving each month as a minimum. The playground can show what extra payments do. It will not tell you to make them.`,
    });
  } else {
    insights.push({
      tone: 'strength',
      title: 'No debt plot twist',
      body: 'Nothing here is chasing you with interest. That is a quieter kind of power.',
    });
  }

  if (q.checkAccounts === 'never' || q.moneyMood === 'avoidant') {
    insights.push({
      tone: 'roast',
      title: 'The bank app has been left on read',
      body: 'Avoiding the numbers does not make them shy. It just lets them throw parties without you.',
    });
  }

  if (q.impulse === 'lifestyle' || q.impulse === 'often') {
    insights.push({
      tone: 'pattern',
      title: 'Checkout is a hobby',
      body: 'Impulse buying is showing up as a habit, not a one-off. The What If? room is where that habit can meet a calculator instead of a pep talk.',
    });
  }

  if (q.savings > 0) {
    insights.push({
      tone: 'strength',
      title: 'A stash exists',
      body: `${Math.round(q.savings)} is already parked. Future-you noticed and did a tiny nod.`,
    });
  }

  const tagline =
    leftover < 0
      ? `${q.name}, the month currently spends you.`
      : `${q.name}, your money has a personality. It is louder than it looks.`;

  return {
    title,
    tagline,
    pulse,
    pulseLabel: pulseLabel(pulse),
    leftover,
    totalBills,
    leakAnnual,
    insights: insights.slice(0, 5),
  };
}
