import { money } from '@/lib/format';
import { looksLikePayChange, resolvePayChange } from '@/lib/money-parse';
import {
  HORIZON_MONTHS,
  compoundMonthly,
  essentialBills,
  leftoverMonthly,
  monthsToGoal,
  monthsToHorizon,
  purchasingPower,
  runwayMonths,
  simplePayoffMonths,
} from '@/lib/money-math';
import type { AnswerRow, Horizon, Questionnaire, WhatIfKind, WhatIfResult } from '@/lib/types';

type Snapshot = {
  income: number;
  fun: number;
  leftover: number;
  savings: number;
  debt: number;
  bills: number;
  totalOut: number;
};

function snapshot(q: Questionnaire): Snapshot {
  const leftover = leftoverMonthly(q);
  const bills = essentialBills(q);
  return {
    income: q.monthlyIncome,
    fun: q.funMoney,
    leftover,
    savings: q.savings,
    debt: q.hasDebt ? q.debtAmount : 0,
    bills,
    totalOut: bills + q.funMoney,
  };
}

function dollars(text: string): number[] {
  const found: number[] = [];
  const re = /\$?\s*([0-9][0-9,]*(?:\.[0-9]+)?)\s*(k)?(?![0-9]|%)/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    const after = text.slice(match.index + match[0].length, match.index + match[0].length + 1);
    if (after === '%') continue;
    let n = Number(match[1].replace(/,/g, ''));
    if (!Number.isFinite(n)) continue;
    if (match[2]) n *= 1000;
    found.push(n);
  }
  return found;
}

function firstAmount(text: string) {
  return dollars(text)[0] ?? null;
}

function rate(text: string) {
  const match = text.match(/([0-9]+(?:\.[0-9]+)?)\s*%/);
  return match ? Number(match[1]) / 100 : null;
}

function has(text: string, pattern: RegExp) {
  return pattern.test(text);
}

function cadenceToMonthly(amount: number, text: string) {
  if (/(every day|per day|a day|daily|\/day)/.test(text)) return amount * 30.44;
  if (/(every week|per week|a week|weekly|\/week)/.test(text)) return amount * 4.345;
  if (/(per year|a year|annual|\/year|\/yr)/.test(text)) return amount / 12;
  if (/(hour|hourly|\/hr)/.test(text)) return amount * 173.2;
  return amount;
}

function toMonthlyPay(amount: number, text: string, q: Questionnaire) {
  if (/(hour|hourly|\/hr)/.test(text)) {
    return { monthly: amount * 173.2, note: 'Assumes about 40 hours/week. That is a sketch, not a paycheck.' };
  }
  if (/(every week|per week|a week|weekly)/.test(text)) {
    return { monthly: amount * 4.345, note: 'Weekly pay converted with 4.345 weeks per month.' };
  }
  if (/(per year|a year|annual|salary|\/year|\/yr)/.test(text) || amount >= Math.max(20000, q.monthlyIncome * 3)) {
    return {
      monthly: amount / 12,
      note: 'Treated as yearly pay, then divided by 12. If this is gross salary, take-home is usually less after tax. Not a tax calculation.',
    };
  }
  return { monthly: amount, note: 'Treated as a monthly number.' };
}

function stacked(monthly: number, compoundRate?: number): Horizon[] {
  return HORIZON_MONTHS.map((h) => ({
    label: h.label,
    months: h.months,
    total: compoundRate
      ? compoundMonthly(monthly, compoundRate, h.months / 12)
      : monthsToHorizon(h.months, monthly),
  }));
}

function fmtMonths(n: number) {
  if (!Number.isFinite(n)) return 'never, at $0/month';
  if (n < 1) return `${Math.max(1, Math.round(n * 30))} days`;
  if (n < 18) return `${n.toFixed(1)} months`;
  return `${(n / 12).toFixed(1)} years`;
}

function leftoverAfter(q: Questionnaire, nextIncome = q.monthlyIncome, nextHousing = q.housing, nextFun = q.funMoney) {
  return leftoverMonthly({
    ...q,
    monthlyIncome: nextIncome,
    housing: nextHousing,
    funMoney: nextFun,
  });
}

function answer(partial: Omit<WhatIfResult, 'prompt'> & { prompt?: string }, prompt: string): WhatIfResult {
  return { source: 'rules', ...partial, prompt };
}

function currentPicture(s: Snapshot): AnswerRow[] {
  return [
    { label: 'Take-home now', value: money(s.income) + '/mo' },
    { label: 'Essentials (home + bills + debt min)', value: money(s.bills) + '/mo' },
    { label: 'Treats / leaks', value: money(s.fun) + '/mo' },
    { label: 'Left after the usual', value: money(s.leftover) + '/mo' },
    { label: 'Savings stash', value: money(s.savings) },
  ];
}

function fallbackAmount(s: Snapshot) {
  if (s.leftover > 0) return s.leftover;
  if (s.fun > 0) return s.fun;
  return 100;
}

export function parseWhatIf(prompt: string, q: Questionnaire): WhatIfResult {
  const text = prompt.trim().toLowerCase();
  const s = snapshot(q);

  if (text.length < 3) {
    return answer(
      {
        kind: 'general',
        title: 'Ask anything money',
        body: 'Try a real question: a raise, a new job, a purchase, running out of cash, cutting a habit, paying debt, or a hypothetical return.',
        monthlyDelta: 0,
        hypothetical: false,
        disclaimer: 'Not financial advice. Just your numbers with the lights on.',
        rows: currentPicture(s),
        horizons: [],
      },
      prompt
    );
  }

  if (has(text, /(broke|scarce|scarcity|survive|ran out|run out|no money|can't afford|cant afford|lose my job|laid off|unemployed|fired|only have savings|if i had nothing|emergency fund|how long could i last|runway)/)) {
    return scarcityAnswer(prompt, q, s);
  }

  if (has(text, /(where does my money|breakdown|budget|how am i spending|where is it going)/)) {
    return breakdownAnswer(prompt, s);
  }

  if (has(text, /(inflation|prices go up|cost of living|everything gets more expensive)/)) {
    return inflationAnswer(prompt, q, s, text);
  }

  if (looksLikePayChange(text) || has(text, /(new job|change jobs|switch jobs|workplace|work place|quit this job|job offer|employer|higher pay|better pay|salary)/)) {
    return jobAnswer(prompt, q, s, text);
  }

  if (has(text, /(raise|promotion|percent more|% more)/) && !has(text, /invest|return|compound/)) {
    return raiseAnswer(prompt, q, s, text);
  }

  if (has(text, /(afford|buy|purchase|spend \$|one-time|car|phone|laptop|trip|vacation|wedding|deposit)/)) {
    return purchaseAnswer(prompt, q, s, text);
  }

  if (has(text, /(until i have|how long until|how long to save|reach \$|save up)/)) {
    return timeToGoalAnswer(prompt, s, text);
  }

  if (has(text, /(rent|landlord|move|housing cost|mortgage goes)/)) {
    return rentAnswer(prompt, q, s, text);
  }

  if (has(text, /(invest|return|compound|stock|market|interest)/)) {
    return investAnswer(prompt, s, text);
  }

  if (has(text, /(debt|owe|toward|towards|loan|credit card|pay off|payoff)/)) {
    return debtAnswer(prompt, q, s, text);
  }

  if (has(text, /(coffee|latte|starbucks|drink|snack|stop buying|cut|skip|quit spending|subscription)/)) {
    return cutAnswer(prompt, s, text);
  }

  if (has(text, /(extra|side hustle|overtime|second job|make more|earn more|bonus)/)) {
    return extraIncomeAnswer(prompt, q, s, text);
  }

  if (has(text, /(save|stash|put away|emergency)/)) {
    return saveAnswer(prompt, s, text);
  }

  if (has(text, /(income|paycheck|hours|hourly|shift)/)) {
    return extraIncomeAnswer(prompt, q, s, text);
  }

  return generalAnswer(prompt, q, s, text);
}

function scarcityAnswer(prompt: string, q: Questionnaire, s: Snapshot): WhatIfResult {
  const ifIncomeStops = runwayMonths(s.savings, s.bills);
  const ifEverything = runwayMonths(s.savings, s.totalOut);
  const ifTight = runwayMonths(s.savings, q.housing + (q.hasDebt ? q.debtMinPayment : 0));
  const body = [
    `If paychecks stopped tomorrow, the stash covers essentials for about ${fmtMonths(ifIncomeStops)}.`,
    `If treats kept happening too, that shrinks to about ${fmtMonths(ifEverything)}.`,
    s.leftover < 0
      ? `Right now the month is already ${money(Math.abs(s.leftover))} short before any plot twist. Scarcity is not a vibe here. It is already in the arithmetic.`
      : `There is ${money(s.leftover)} of air in a normal month. That air disappears if income does.`,
    q.moneyMood === 'anxious'
      ? 'Your questionnaire said money already feels loud. The numbers are loud too. They still do not tell you what to do.'
      : 'This is a flashlight, not a verdict.',
  ].join(' ');

  return answer(
    {
      kind: 'scarcity',
      title: 'If the paycheck ghosted you',
      body,
      monthlyDelta: -s.income,
      hypothetical: false,
      disclaimer: 'Runway is savings ÷ monthly costs. It ignores extras, help from people, unemployment, and surprise bills.',
      rows: [
        ...currentPicture(s),
        { label: 'Runway, essentials only', value: fmtMonths(ifIncomeStops) },
        { label: 'Runway, including treats', value: fmtMonths(ifEverything) },
        { label: 'Runway, rent + debt min only', value: fmtMonths(ifTight) },
      ],
      horizons: [],
    },
    prompt
  );
}

function breakdownAnswer(prompt: string, s: Snapshot): WhatIfResult {
  const income = Math.max(s.income, 1);
  const body = `Out of ${money(s.income)} take-home: essentials take ${money(s.bills)} (${Math.round((s.bills / income) * 100)}%), treats take ${money(s.fun)} (${Math.round((s.fun / income) * 100)}%), and ${money(s.leftover)} (${Math.round((s.leftover / income) * 100)}%) is what is left to argue about.`;
  return answer(
    {
      kind: 'breakdown',
      title: 'Where the month actually goes',
      body,
      monthlyDelta: 0,
      hypothetical: false,
      disclaimer: 'Percents are of take-home, not of some perfect budget.',
      rows: currentPicture(s),
      horizons: [],
    },
    prompt
  );
}

function inflationAnswer(prompt: string, q: Questionnaire, s: Snapshot, text: string): WhatIfResult {
  const pct = rate(text) ?? 0.1;
  const newBills = s.bills * (1 + pct);
  const newFun = s.fun * (1 + pct);
  const newLeftover = leftoverAfter(q) - (newBills - s.bills) - (newFun - s.fun);
  const years = has(text, /5 year/) ? 5 : has(text, /10 year/) ? 10 : 1;
  const power = purchasingPower(s.leftover, pct, years);
  return answer(
    {
      kind: 'inflation',
      title: `If costs jumped ${Math.round(pct * 100)}%`,
      body: `If the stuff you already pay rose ${Math.round(pct * 100)}%, leftover would move from ${money(s.leftover)} to ${money(newLeftover)} a month. ${years} year(s) later, today's leftover of ${money(s.leftover)} would buy about ${money(power)} of today's stuff. Sketch, not a forecast.`,
      monthlyDelta: newLeftover - s.leftover,
      hypothetical: true,
      disclaimer: 'Inflation is not even. Rent, food, and fun do not rise in lockstep. This applies one rate to your current pile.',
      rows: [
        { label: 'Leftover now', value: money(s.leftover) },
        { label: `Leftover if costs +${Math.round(pct * 100)}%`, value: money(newLeftover) },
        { label: `Buying power of leftover after ${years} yr`, value: money(power) },
      ],
      horizons: [],
    },
    prompt
  );
}

function jobAnswer(prompt: string, q: Questionnaire, s: Snapshot, text: string): WhatIfResult {
  const pct = rate(text);
  const splitPay = resolvePayChange(text, s.income);
  let currentIncome = splitPay.current;
  let nextIncome = splitPay.next;
  const notes = [...splitPay.notes];

  if (pct != null && findMentionsSafe(text).length === 0) {
    currentIncome = s.income;
    nextIncome = s.income * (1 + pct);
    notes.length = 0;
    notes.push(`Applied ${Math.round(pct * 100)}% to your current take-home of ${money(s.income)}.`);
  }

  const nowLeftover = leftoverAfter(q, currentIncome);
  const nextLeftover = leftoverAfter(q, nextIncome);
  const delta = nextIncome - currentIncome;
  const body = [
    `You asked to go from ${money(currentIncome)}/mo (${money(currentIncome * 12)}/year) to ${money(nextIncome)}/mo (${money(nextIncome * 12)}/year).`,
    `That is ${delta >= 0 ? '+' : ''}${money(delta)} a month, ${delta >= 0 ? '+' : ''}${money(delta * 12)} a year.`,
    `Using your saved housing/bills/treats, leftover would move from ${money(nowLeftover)} to ${money(nextLeftover)}.`,
    'This does not say take the job. It does not know commute, health, tax, or your sanity.',
  ].join(' ');

  return answer(
    {
      kind: 'job-change',
      title: delta >= 0 ? 'A bigger paycheck' : 'A smaller paycheck',
      body,
      monthlyDelta: delta,
      hypothetical: false,
      disclaimer: notes.join(' '),
      rows: [
        { label: 'Pay in your question (now)', value: `${money(currentIncome)}/mo · ${money(currentIncome * 12)}/yr` },
        { label: 'Pay in this scenario', value: `${money(nextIncome)}/mo · ${money(nextIncome * 12)}/yr` },
        { label: 'Leftover now (same bills)', value: money(nowLeftover) },
        { label: 'Leftover in this scenario', value: money(nextLeftover) },
        { label: 'Yearly difference', value: `${delta >= 0 ? '+' : ''}${money(delta * 12)}` },
      ],
      horizons: stacked(delta),
    },
    prompt
  );
}

function findMentionsSafe(text: string) {
  return text.match(/\$?\s*[0-9][0-9,]*(?:\.[0-9]+)?\s*k?(?![0-9%])/gi) ?? [];
}

function raiseAnswer(prompt: string, q: Questionnaire, s: Snapshot, text: string): WhatIfResult {
  const pct = rate(text);
  const amount = firstAmount(text);
  let nextIncome = s.income;
  if (pct != null) nextIncome = s.income * (1 + pct);
  else if (amount != null) nextIncome = s.income + cadenceToMonthly(amount, text);
  else nextIncome = s.income * 1.1;

  const nextLeftover = leftoverAfter(q, nextIncome);
  const delta = nextIncome - s.income;
  return answer(
    {
      kind: 'raise',
      title: 'Same job, fatter paycheck',
      body: `If take-home moved from ${money(s.income)} to ${money(nextIncome)}, leftover would go from ${money(s.leftover)} to ${money(nextLeftover)}. That is ${money(delta)} more air per month — if lifestyle creep does not eat it.`,
      monthlyDelta: delta,
      hypothetical: false,
      disclaimer: 'Raises are often quoted as gross. This math uses take-home unless you said otherwise.',
      rows: [
        { label: 'New leftover', value: money(nextLeftover) },
        { label: 'Monthly bump', value: money(delta) },
      ],
      horizons: stacked(delta),
    },
    prompt
  );
}

function purchaseAnswer(prompt: string, q: Questionnaire, s: Snapshot, text: string): WhatIfResult {
  const cost = firstAmount(text) ?? 500;
  const fromSavings = s.savings - cost;
  const monthsIfSaved = monthsToGoal(cost, Math.max(0, s.leftover));
  const leftoverThisMonth = s.leftover - cost;
  const body = [
    `${money(cost)} against this month's leftover of ${money(s.leftover)} leaves ${money(leftoverThisMonth)} for everything else this month.`,
    s.savings >= cost
      ? `The stash can cover it today and still have ${money(fromSavings)} parked.`
      : `The stash is ${money(s.savings)}, which is ${money(cost - s.savings)} short of paying cash.`,
    s.leftover > 0
      ? `Saving only the leftover, it would take about ${fmtMonths(monthsIfSaved)} to cash-flow ${money(cost)}.`
      : 'There is no leftover to save toward it without changing something else.',
    'That is capacity math. It is not permission, and it is not a warning label.',
  ].join(' ');

  return answer(
    {
      kind: 'purchase',
      title: `A ${money(cost)} transaction`,
      body,
      monthlyDelta: 0,
      hypothetical: false,
      disclaimer: 'One-time purchase vs current leftover and savings. No interest, no credit-card APR.',
      rows: [
        { label: 'Price', value: money(cost) },
        { label: 'Leftover if paid this month', value: money(leftoverThisMonth) },
        { label: 'Savings after paying cash', value: money(fromSavings) },
        { label: 'Time to save it from leftover', value: fmtMonths(monthsIfSaved) },
      ],
      horizons: [],
    },
    prompt
  );
}

function timeToGoalAnswer(prompt: string, s: Snapshot, text: string): WhatIfResult {
  const goal = firstAmount(text) ?? 10000;
  const fromLeftover = monthsToGoal(Math.max(0, goal - s.savings), s.leftover);
  const body =
    s.leftover > 0
      ? `To get from ${money(s.savings)} to ${money(goal)} using ${money(s.leftover)} leftover each month takes about ${fmtMonths(fromLeftover)}. If leftover got redirected to treats instead, the clock does not move.`
      : `The goal is ${money(goal)}. Current leftover is ${money(s.leftover)}, so the calendar cannot count down until the month stops going negative.`;
  return answer(
    {
      kind: 'time-to-goal',
      title: `Getting to ${money(goal)}`,
      body,
      monthlyDelta: s.leftover,
      hypothetical: false,
      disclaimer: 'Simple division. No interest earned, no interruptions.',
      rows: [
        { label: 'Goal', value: money(goal) },
        { label: 'Already saved', value: money(s.savings) },
        { label: 'Still needed', value: money(Math.max(0, goal - s.savings)) },
        { label: 'At current leftover', value: fmtMonths(fromLeftover) },
      ],
      horizons: stacked(Math.max(0, s.leftover)),
    },
    prompt
  );
}

function rentAnswer(prompt: string, q: Questionnaire, s: Snapshot, text: string): WhatIfResult {
  const amount = firstAmount(text);
  const more = has(text, /(up|more|increase|raise|higher)/) || !has(text, /(down|less|cheaper|lower)/);
  let nextHousing = q.housing;
  if (amount != null) {
    const monthly = cadenceToMonthly(amount, text);
    nextHousing = more && has(text, /(up|more|increase|raise|higher|extra)/) ? q.housing + monthly : monthly;
    if (has(text, /(up|increase|raise|extra|more)/)) nextHousing = q.housing + monthly;
    if (has(text, /(down|less|cheaper|lower|drop)/)) nextHousing = Math.max(0, q.housing - monthly);
  } else {
    nextHousing = q.housing * (more ? 1.1 : 0.9);
  }
  const nextLeftover = leftoverAfter(q, q.monthlyIncome, nextHousing);
  const delta = nextLeftover - s.leftover;
  return answer(
    {
      kind: 'rent-change',
      title: 'The roof changes price',
      body: `Housing would move from ${money(q.housing)} to ${money(nextHousing)}. Leftover would move from ${money(s.leftover)} to ${money(nextLeftover)} (${delta >= 0 ? '+' : ''}${money(delta)}/mo).`,
      monthlyDelta: delta,
      hypothetical: false,
      disclaimer: 'Only housing changed. Utilities and vibes stayed put.',
      rows: [
        { label: 'Housing now', value: money(q.housing) },
        { label: 'Housing in this scenario', value: money(nextHousing) },
        { label: 'New leftover', value: money(nextLeftover) },
      ],
      horizons: stacked(delta),
    },
    prompt
  );
}

function investAnswer(prompt: string, s: Snapshot, text: string): WhatIfResult {
  const amount = firstAmount(text) ?? fallbackAmount(s);
  const monthly = cadenceToMonthly(amount, text);
  const annual = rate(text) ?? 0.07;
  const horizons = stacked(monthly, annual);
  const ten = horizons.find((h) => h.months === 120)?.total ?? 0;
  return answer(
    {
      kind: 'invest',
      title: `Hypothetical ${Math.round(annual * 100)}% playground`,
      body: `If ${money(monthly)}/mo were contributed and compounded monthly at ${Math.round(annual * 100)}% a year, the pile would be about ${money(ten)} in 10 years. That is a math toy. It is not a stock, a fund, a promise, or a suggestion.`,
      monthlyDelta: monthly,
      hypothetical: true,
      disclaimer:
        'Hypothetical only. Markets fall. This ignores taxes, fees, and sequence of returns. Not an investment recommendation.',
      rows: [
        { label: 'Monthly contribution', value: money(monthly) },
        { label: 'Rate used', value: `${Math.round(annual * 100)}% hypothetical` },
      ],
      horizons,
    },
    prompt
  );
}

function debtAnswer(prompt: string, q: Questionnaire, s: Snapshot, text: string): WhatIfResult {
  if (!q.hasDebt || q.debtAmount <= 0) {
    return answer(
      {
        kind: 'debt-pay',
        title: 'No debt on the profile',
        body: 'There is no debt amount saved yet, so there is nothing to pay toward. Add it under You, then ask again.',
        monthlyDelta: 0,
        hypothetical: false,
        disclaimer: 'Edit your numbers if this is wrong.',
        rows: currentPicture(s),
        horizons: [],
      },
      prompt
    );
  }
  const extra = firstAmount(text) ?? Math.max(50, Math.round(fallbackAmount(s)));
  const current = simplePayoffMonths(q.debtAmount, q.debtMinPayment);
  const faster = simplePayoffMonths(q.debtAmount, q.debtMinPayment + extra);
  return answer(
    {
      kind: 'debt-pay',
      title: `Extra ${money(extra)} toward the balance`,
      body: `Balance ${money(q.debtAmount)}. Minimum ${money(q.debtMinPayment)}/mo is about ${fmtMonths(current)} if we pretend there is no interest. Add ${money(extra)} and the simple split becomes about ${fmtMonths(faster)}. Real interest makes both clocks longer.`,
      monthlyDelta: extra,
      hypothetical: false,
      disclaimer: 'This is balance ÷ payment. It is not amortization and not a payoff quote from a lender.',
      rows: [
        { label: 'Balance', value: money(q.debtAmount) },
        { label: 'Minimum only', value: fmtMonths(current) },
        { label: `Minimum + ${money(extra)}`, value: fmtMonths(faster) },
      ],
      horizons: stacked(extra),
    },
    prompt
  );
}

function cutAnswer(prompt: string, s: Snapshot, text: string): WhatIfResult {
  const amount = firstAmount(text) ?? 4;
  const monthly = cadenceToMonthly(amount, text);
  return answer(
    {
      kind: 'cut-habit',
      title: `Not spending ${money(amount)} on repeat`,
      body: `If that habit stopped, ${money(monthly)}/mo would stay in the pile. That is ${money(monthly * 12)} a year, ${money(monthly * 60)} over 5 years. The calculator is not telling you to become a monk.`,
      monthlyDelta: monthly,
      hypothetical: false,
      disclaimer: 'Habit math only. Life quality is not in the spreadsheet.',
      rows: [{ label: 'Monthly kept', value: money(monthly) }],
      horizons: stacked(monthly),
    },
    prompt
  );
}

function extraIncomeAnswer(prompt: string, q: Questionnaire, s: Snapshot, text: string): WhatIfResult {
  const amount = firstAmount(text) ?? 300;
  const monthly = cadenceToMonthly(amount, text);
  const next = leftoverAfter(q, s.income + monthly);
  return answer(
    {
      kind: 'extra-income',
      title: `Another ${money(monthly)} landing`,
      body: `If ${money(monthly)} extra actually arrived each month, leftover would move from ${money(s.leftover)} to ${money(next)}. Over a year that is ${money(monthly * 12)} before lifestyle creep RSVPs.`,
      monthlyDelta: monthly,
      hypothetical: false,
      disclaimer: 'Assumes the extra is take-home, not gross.',
      rows: [
        { label: 'New leftover', value: money(next) },
        { label: 'Yearly extra', value: money(monthly * 12) },
      ],
      horizons: stacked(monthly),
    },
    prompt
  );
}

function saveAnswer(prompt: string, s: Snapshot, text: string): WhatIfResult {
  const amount = firstAmount(text) ?? 200;
  const monthly = cadenceToMonthly(amount, text);
  return answer(
    {
      kind: 'extra-save',
      title: `Parking ${money(monthly)} more`,
      body: `Redirecting ${money(monthly)}/mo into the stash is ${money(monthly * 12)} a year, stacked with no interest. Current leftover is ${money(s.leftover)}, so this only fits if that leftover (or a cut somewhere) actually exists.`,
      monthlyDelta: monthly,
      hypothetical: false,
      disclaimer: 'Simple stacking. No yield assumed.',
      rows: [
        { label: 'Current leftover', value: money(s.leftover) },
        { label: 'This save', value: money(monthly) },
      ],
      horizons: stacked(monthly),
    },
    prompt
  );
}

function generalAnswer(prompt: string, q: Questionnaire, s: Snapshot, text: string): WhatIfResult {
  const amount = firstAmount(text);
  const pct = rate(text);
  if (amount != null && has(text, /(pay|send|transfer|give|transaction|spend)/)) {
    return purchaseAnswer(prompt, q, s, text);
  }
  if (pct != null) {
    return raiseAnswer(prompt, q, s, text);
  }
  if (amount != null) {
    const monthly = cadenceToMonthly(amount, text);
    const shareOfIncome = s.income > 0 ? Math.round((monthly / s.income) * 100) : 0;
    const daysOfLeftover = s.leftover > 0 ? monthly / (s.leftover / 30.44) : Infinity;
    return answer(
      {
        kind: 'general',
        title: `${money(monthly)} next to your month`,
        body: `${money(monthly)} is about ${shareOfIncome}% of your take-home. Against leftover of ${money(s.leftover)}, that is roughly ${fmtMonths(daysOfLeftover / 30.44)} of leftover. If you meant a job, a purchase, a cut, or a hypothetical return, add those words and the math gets sharper.`,
        monthlyDelta: monthly,
        hypothetical: false,
        disclaimer: 'Best-effort reading of a money question using your profile. Not advice.',
        rows: [
          ...currentPicture(s),
          { label: 'This amount vs take-home', value: `${shareOfIncome}%` },
        ],
        horizons: stacked(monthly),
      },
      prompt
    );
  }

  const moodLine =
    q.moneyMood === 'avoidant'
      ? 'You said you look away from money. Looking at the pile anyway: '
      : q.moneyMood === 'anxious'
        ? 'You said money already feels loud. The volume of the numbers: '
        : 'Your current pile: ';

  return answer(
    {
      kind: 'general',
      title: 'Your numbers, answering back',
      body: `${moodLine}take-home ${money(s.income)}, essentials ${money(s.bills)}, leftover ${money(s.leftover)}, savings ${money(s.savings)}. If paychecks stopped, essentials last about ${fmtMonths(runwayMonths(s.savings, s.bills))}. Ask a sharper question — new job, raise, purchase, debt, a cut, inflation, or a hypothetical return — and the calculator will do that specific math.`,
      monthlyDelta: 0,
      hypothetical: false,
      disclaimer: 'Not financial advice. Not a plan. A mirror.',
      rows: [
        ...currentPicture(s),
        { label: 'Runway if income stops', value: fmtMonths(runwayMonths(s.savings, s.bills)) },
      ],
      horizons: [],
    },
    prompt
  );
}

export const QUICK_PROMPTS = [
  'What if I change jobs for $1,000 more per month?',
  'What if I get a 15% raise?',
  'What if I lose my job tomorrow?',
  'Can I afford a $1,200 purchase?',
  'What if rent goes up $200?',
  'What happens if I stop buying a $4 coffee every day?',
  'What if I hypothetically invest $200 a month at a 7% annual return?',
];
