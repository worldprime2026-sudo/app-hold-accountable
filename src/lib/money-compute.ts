import { money } from '@/lib/format';
import {
  HORIZON_MONTHS,
  compoundMonthly,
  leftoverMonthly,
  monthsToGoal,
  monthsToHorizon,
  purchasingPower,
  runwayMonths,
  simplePayoffMonths,
} from '@/lib/money-math';
import type { ExtractedScenario } from '@/lib/money-extract';
import type { Horizon, Questionnaire, WhatIfResult } from '@/lib/types';

function leftoverOf(q: Questionnaire, income = q.monthlyIncome, housing = q.housing, fun = q.funMoney) {
  return leftoverMonthly({ ...q, monthlyIncome: income, housing, funMoney: fun });
}

function stacked(monthly: number, rate?: number): Horizon[] {
  return HORIZON_MONTHS.map((h) => ({
    label: h.label,
    months: h.months,
    total: rate ? compoundMonthly(monthly, rate, h.months / 12) : monthsToHorizon(h.months, monthly),
  }));
}

function fmtMonths(n: number) {
  if (!Number.isFinite(n)) return 'never at $0/mo';
  if (n < 1) return `${Math.max(1, Math.round(n * 30))} days`;
  if (n < 18) return `${n.toFixed(1)} months`;
  return `${(n / 12).toFixed(1)} years`;
}

export function computeFromExtract(prompt: string, q: Questionnaire, extracted: ExtractedScenario): WhatIfResult {
  const bills = q.housing + q.otherBills + (q.hasDebt ? q.debtMinPayment : 0);
  const profileLeftover = leftoverOf(q);
  const kind = extracted.kind;
  const disclaimer = 'Numbers are calculated from your question plus your saved bills. Not financial advice.';

  if (
    extracted.pauseMonths != null &&
    extracted.pauseMonths > 0 &&
    (kind === 'scarcity' || kind === 'runway' || extracted.newIncomeMonthly === 0)
  ) {
    const months = extracted.pauseMonths;
    const lostPay = q.monthlyIncome * months;
    const livingCost = bills * months;
    const leftoverWithNoPay = leftoverOf(q, 0);
    const savingsAfter = q.savings - livingCost;
    const covers = q.savings >= livingCost;
    return {
      kind: 'scarcity',
      title: `No paycheck for ${months === 1 ? '1 month' : `${months} months`}`,
      prompt,
      body: [
        `If work stops for ${months} month${months === 1 ? '' : 's'}, take-home is $0 for that stretch.`,
        `You would miss about ${money(lostPay)} of pay.`,
        `Your usual essentials still cost ${money(bills)}/mo, or ${money(livingCost)} over that time.`,
        `Each of those months leftover is ${money(leftoverWithNoPay)} (bills with no income).`,
        covers
          ? `The stash of ${money(q.savings)} can cover those essentials and leave about ${money(savingsAfter)}.`
          : `The stash of ${money(q.savings)} is ${money(livingCost - q.savings)} short of covering essentials for that stretch.`,
        'This is a flashlight on the gap. It is not medical, legal, or insurance advice.',
      ].join(' '),
      monthlyDelta: -q.monthlyIncome,
      hypothetical: false,
      disclaimer,
      source: 'rules',
      rows: [
        { label: 'Time without pay', value: `${months} month${months === 1 ? '' : 's'}` },
        { label: 'Pay missed', value: money(lostPay) },
        { label: 'Essentials over that time', value: money(livingCost) },
        { label: 'Leftover each of those months', value: money(leftoverWithNoPay) },
        { label: 'Savings now', value: money(q.savings) },
        { label: 'Savings after essentials', value: money(savingsAfter) },
      ],
      horizons: [],
    };
  }

  if (kind === 'job-change' || kind === 'raise' || kind === 'pay-cut' || extracted.percentChange != null) {
    const current = extracted.currentIncomeMonthly ?? q.monthlyIncome;
    let next = extracted.newIncomeMonthly;
    if (next == null && extracted.percentChange != null) next = current * (1 + extracted.percentChange);
    if (next == null && extracted.extraIncomeMonthly != null) next = current + extracted.extraIncomeMonthly;
    if (next == null) next = current;
    const nowLeft = leftoverOf(q, current);
    const nextLeft = leftoverOf(q, next);
    const delta = next - current;
    const payKind = delta < 0 || kind === 'pay-cut' || (extracted.percentChange ?? 0) < 0 ? 'pay-cut' : kind === 'raise' ? 'raise' : 'job-change';
    return {
      kind: payKind,
      title: delta >= 0 ? 'A bigger paycheck' : 'A smaller paycheck',
      prompt,
      body: `${extracted.summary} From ${money(current)}/mo (${money(current * 12)}/yr) to ${money(next)}/mo (${money(next * 12)}/yr) is ${delta >= 0 ? '+' : ''}${money(delta)} a month, ${delta >= 0 ? '+' : ''}${money(delta * 12)} a year. With your saved bills, leftover moves from ${money(nowLeft)} to ${money(nextLeft)}. This is not a recommendation to take or leave a job.`,
      monthlyDelta: delta,
      hypothetical: false,
      disclaimer,
      source: 'ai',
      rows: [
        { label: 'Pay now (from your question)', value: `${money(current)}/mo · ${money(current * 12)}/yr` },
        { label: 'Pay in this scenario', value: `${money(next)}/mo · ${money(next * 12)}/yr` },
        { label: 'Leftover now', value: money(nowLeft) },
        { label: 'Leftover in this scenario', value: money(nextLeft) },
        { label: 'Yearly difference', value: `${delta >= 0 ? '+' : ''}${money(delta * 12)}` },
      ],
      horizons: stacked(delta),
    };
  }

  if (kind === 'scarcity' || kind === 'runway') {
    const income = extracted.currentIncomeMonthly ?? q.monthlyIncome;
    const runway = runwayMonths(q.savings, bills);
    const tight = runwayMonths(q.savings, q.housing + (q.hasDebt ? q.debtMinPayment : 0));
    return {
      kind: 'scarcity',
      title: 'If the paycheck stopped',
      prompt,
      body: `${extracted.summary} Savings of ${money(q.savings)} cover essentials (${money(bills)}/mo) for about ${fmtMonths(runway)}. Rent + debt min only: ${fmtMonths(tight)}. Leftover on a normal month at ${money(income)} take-home is ${money(leftoverOf(q, income))}.`,
      monthlyDelta: -income,
      hypothetical: false,
      disclaimer,
      source: 'ai',
      rows: [
        { label: 'Essentials / month', value: money(bills) },
        { label: 'Runway, essentials', value: fmtMonths(runway) },
        { label: 'Runway, rent + debt min', value: fmtMonths(tight) },
      ],
      horizons: [],
    };
  }

  if (kind === 'purchase' && extracted.oneTimePurchase != null) {
    const cost = extracted.oneTimePurchase;
    const leftover = leftoverOf(q);
    return {
      kind: 'purchase',
      title: `A ${money(cost)} transaction`,
      prompt,
      body: `${extracted.summary} ${money(cost)} vs leftover ${money(leftover)} leaves ${money(leftover - cost)} this month. Savings after cash: ${money(q.savings - cost)}. Time to save it from leftover: ${fmtMonths(monthsToGoal(cost, Math.max(0, leftover)))}. Capacity math, not permission.`,
      monthlyDelta: 0,
      hypothetical: false,
      disclaimer,
      source: 'ai',
      rows: [
        { label: 'Price', value: money(cost) },
        { label: 'Leftover if paid this month', value: money(leftover - cost) },
        { label: 'Savings after cash', value: money(q.savings - cost) },
      ],
      horizons: [],
    };
  }

  if (kind === 'invest' && extracted.investMonthly != null) {
    const monthly = extracted.investMonthly;
    const rate = extracted.investAnnualRate ?? 0.07;
    const horizons = stacked(monthly, rate);
    const ten = horizons.find((h) => h.months === 120)?.total ?? 0;
    return {
      kind: 'invest',
      title: `Hypothetical ${Math.round(rate * 100)}% playground`,
      prompt,
      body: `${extracted.summary} If ${money(monthly)}/mo compounded monthly at ${Math.round(rate * 100)}% a year, about ${money(ten)} in 10 years. Math toy only. Not a product, not a promise, not a recommendation.`,
      monthlyDelta: monthly,
      hypothetical: true,
      disclaimer: 'Hypothetical. Ignores taxes, fees, and losses.',
      source: 'ai',
      rows: [
        { label: 'Monthly contribution', value: money(monthly) },
        { label: 'Rate used', value: `${Math.round(rate * 100)}% hypothetical` },
      ],
      horizons,
    };
  }

  if (kind === 'debt-pay') {
    const extra = extracted.debtExtraMonthly ?? 0;
    if (!q.hasDebt || q.debtAmount <= 0) {
      return {
        kind: 'debt-pay',
        title: 'No debt on the profile',
        prompt,
        body: `${extracted.summary} There is no debt amount saved yet.`,
        monthlyDelta: 0,
        hypothetical: false,
        disclaimer,
        source: 'ai',
        rows: [],
        horizons: [],
      };
    }
    const current = simplePayoffMonths(q.debtAmount, q.debtMinPayment);
    const faster = simplePayoffMonths(q.debtAmount, q.debtMinPayment + extra);
    return {
      kind: 'debt-pay',
      title: `Extra ${money(extra)} toward the balance`,
      prompt,
      body: `${extracted.summary} ${money(q.debtAmount)} at ${money(q.debtMinPayment)}/mo is about ${fmtMonths(current)} with no interest. Add ${money(extra)} and the simple split is about ${fmtMonths(faster)}. Real interest makes both longer.`,
      monthlyDelta: extra,
      hypothetical: false,
      disclaimer,
      source: 'ai',
      rows: [
        { label: 'Balance', value: money(q.debtAmount) },
        { label: 'Minimum only', value: fmtMonths(current) },
        { label: 'With extra', value: fmtMonths(faster) },
      ],
      horizons: stacked(extra),
    };
  }

  if (kind === 'rent-change' && extracted.rentMonthly != null) {
    const nextHousing = extracted.rentIsDelta ? q.housing + extracted.rentMonthly : extracted.rentMonthly;
    const nextLeft = leftoverOf(q, q.monthlyIncome, nextHousing);
    const delta = nextLeft - profileLeftover;
    return {
      kind: 'rent-change',
      title: 'The roof changes price',
      prompt,
      body: `${extracted.summary} Housing ${money(q.housing)} → ${money(nextHousing)}. Leftover ${money(profileLeftover)} → ${money(nextLeft)}.`,
      monthlyDelta: delta,
      hypothetical: false,
      disclaimer,
      source: 'ai',
      rows: [
        { label: 'Housing now', value: money(q.housing) },
        { label: 'Housing in this scenario', value: money(nextHousing) },
        { label: 'New leftover', value: money(nextLeft) },
      ],
      horizons: stacked(delta),
    };
  }

  if (kind === 'inflation') {
    const rate = extracted.inflationRate ?? 0.03;
    const years = extracted.pauseMonths ? extracted.pauseMonths / 12 : 5;
    const now = leftoverOf(q);
    const later = purchasingPower(now, rate, years);
    return {
      kind: 'inflation',
      title: `Prices at ${Math.round(rate * 100)}%`,
      prompt,
      body: `${extracted.summary} Leftover ${money(now)}/mo would buy about ${money(later)} of today's stuff after ${years} year${years === 1 ? '' : 's'} at ${Math.round(rate * 100)}% inflation. Sketch only.`,
      monthlyDelta: later - now,
      hypothetical: true,
      disclaimer,
      source: 'rules',
      rows: [
        { label: 'Leftover now', value: money(now) },
        { label: `Buying power in ${years} years`, value: money(later) },
      ],
      horizons: [],
    };
  }

  if (kind === 'breakdown') {
    const income = Math.max(q.monthlyIncome, 1);
    return {
      kind: 'breakdown',
      title: 'Where the month goes',
      prompt,
      body: `${extracted.summary} Take-home ${money(q.monthlyIncome)}. Essentials ${money(bills)} (${Math.round((bills / income) * 100)}%). Treats ${money(q.funMoney)} (${Math.round((q.funMoney / income) * 100)}%). Leftover ${money(profileLeftover)} (${Math.round((profileLeftover / income) * 100)}%).`,
      monthlyDelta: 0,
      hypothetical: false,
      disclaimer,
      source: 'ai',
      rows: [
        { label: 'Take-home', value: money(q.monthlyIncome) },
        { label: 'Essentials', value: money(bills) },
        { label: 'Treats', value: money(q.funMoney) },
        { label: 'Leftover', value: money(profileLeftover) },
      ],
      horizons: [],
    };
  }

  if (kind === 'time-to-goal' && extracted.goalAmount != null) {
    const goal = extracted.goalAmount;
    const months = monthsToGoal(Math.max(0, goal - q.savings), profileLeftover);
    return {
      kind: 'time-to-goal',
      title: `Getting to ${money(goal)}`,
      prompt,
      body: `${extracted.summary} From ${money(q.savings)} toward ${money(goal)} at leftover ${money(profileLeftover)}/mo takes about ${fmtMonths(months)}.`,
      monthlyDelta: profileLeftover,
      hypothetical: false,
      disclaimer,
      source: 'ai',
      rows: [
        { label: 'Goal', value: money(goal) },
        { label: 'Already saved', value: money(q.savings) },
        { label: 'At current leftover', value: fmtMonths(months) },
      ],
      horizons: stacked(Math.max(0, profileLeftover)),
    };
  }

  const monthly =
    extracted.extraIncomeMonthly ??
    extracted.cutMonthly ??
    extracted.saveMonthly ??
    extracted.extraIncomeMonthly ??
    0;

  if (monthly) {
    const nextLeft = leftoverOf(q, q.monthlyIncome + (extracted.extraIncomeMonthly ?? 0), q.housing, q.funMoney - (extracted.cutMonthly ?? 0));
    return {
      kind: extracted.cutMonthly ? 'cut-habit' : extracted.saveMonthly ? 'extra-save' : 'extra-income',
      title: extracted.summary.slice(0, 48) || 'A money shift',
      prompt,
      body: `${extracted.summary} About ${money(monthly)} a month. Leftover would sit near ${money(nextLeft)} if that shift is real and nothing else changes.`,
      monthlyDelta: monthly,
      hypothetical: false,
      disclaimer,
      source: 'ai',
      rows: [
        { label: 'Monthly shift', value: money(monthly) },
        { label: 'Leftover in this scenario', value: money(nextLeft) },
      ],
      horizons: stacked(monthly),
    };
  }

  return {
    kind: 'general',
    title: extracted.summary.slice(0, 56) || 'Your numbers, answering back',
    prompt,
    body: `${extracted.summary} Take-home ${money(q.monthlyIncome)}/mo, leftover ${money(profileLeftover)}, savings ${money(q.savings)}. If income stopped, essentials last about ${fmtMonths(runwayMonths(q.savings, bills))}. Ask with amounts (40k vs 80k, $200 rent, a purchase) for sharper math.`,
    monthlyDelta: 0,
    hypothetical: false,
    disclaimer,
    source: 'ai',
    rows: [
      { label: 'Take-home', value: money(q.monthlyIncome) },
      { label: 'Leftover', value: money(profileLeftover) },
      { label: 'Savings', value: money(q.savings) },
      { label: 'Runway if income stops', value: fmtMonths(runwayMonths(q.savings, bills)) },
    ],
    horizons: [],
  };
}
