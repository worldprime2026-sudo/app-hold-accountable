import type { ExtractedScenario } from '@/lib/money-extract';
import { leftoverMonthly } from '@/lib/money-math';
import { describeMoney, readQuestion, type MoneySpan, type QuestionRead } from '@/lib/read-question';
import type { Questionnaire, WhatIfResult } from '@/lib/types';

function blank(question: string): ExtractedScenario {
  return {
    kind: 'general',
    summary: question.trim(),
    currentIncomeMonthly: null,
    newIncomeMonthly: null,
    extraIncomeMonthly: null,
    cutMonthly: null,
    saveMonthly: null,
    oneTimePurchase: null,
    rentMonthly: null,
    rentIsDelta: false,
    debtExtraMonthly: null,
    investMonthly: null,
    investAnnualRate: null,
    percentChange: null,
    goalAmount: null,
    inflationRate: null,
    pauseMonths: null,
  };
}

export type UnderstoodQuestion = {
  extracted: ExtractedScenario;
  confidence: 'high' | 'low';
  understoodAs: string;
  missing: string[];
  readyToCompute: boolean;
  read: QuestionRead;
};

function high(
  extracted: ExtractedScenario,
  understoodAs: string,
  read: QuestionRead
): UnderstoodQuestion {
  return {
    extracted,
    confidence: 'high',
    understoodAs,
    missing: [],
    readyToCompute: true,
    read,
  };
}

function unclear(question: string, read: QuestionRead, understoodAs: string, missing: string[]): UnderstoodQuestion {
  const extracted = blank(question);
  extracted.summary = understoodAs;
  return {
    extracted,
    confidence: 'low',
    understoodAs,
    missing,
    readyToCompute: false,
    read,
  };
}

function payPair(read: QuestionRead): { current: MoneySpan; next: MoneySpan } | null {
  if (read.fromTo) return { current: read.fromTo.from, next: read.fromTo.to };
  if (read.nowThen) return { current: read.nowThen.current, next: read.nowThen.next };
  if (read.cues.payTalk && read.moneys.length >= 2) {
    return { current: read.moneys[0], next: read.moneys[1] };
  }
  return null;
}

export function understandQuestion(question: string, q: Questionnaire): UnderstoodQuestion {
  const read = readQuestion(question);
  const extracted = blank(question);
  const leftover = leftoverMonthly(q);
  const pair = payPair(read);

  if (pair && !read.cues.oneTimeCost) {
    extracted.kind = read.cues.raiseTalk ? 'raise' : 'job-change';
    extracted.currentIncomeMonthly = pair.current.monthly;
    extracted.newIncomeMonthly = pair.next.monthly;
    extracted.summary = `Pay moves from ${describeMoney(pair.current)} to ${describeMoney(pair.next)}.`;
    return high(
      extracted,
      `I read this as: compare ${describeMoney(pair.current)} with ${describeMoney(pair.next)}, then apply your saved bills. Time words were not treated as money.`,
      read
    );
  }

  if (read.cues.incomeStop) {
    extracted.kind = 'scarcity';
    extracted.pauseMonths = read.durationMonths;
    if (read.durationMonths) {
      extracted.summary = `Paychecks stop for ${read.durationMonths} month${read.durationMonths === 1 ? '' : 's'}.`;
      return high(
        extracted,
        `I read this as: income pauses for ${read.durationMonths} month${read.durationMonths === 1 ? '' : 's'}. That number is a duration, not $${read.durationMonths}. Your saved bills still run.`,
        read
      );
    }
    extracted.summary = 'Paychecks stop. No duration was given, so this uses your savings runway.';
    return high(
      extracted,
      'I read this as: income stops, with no time limit in the question. This is the runway against your saved bills and stash. If you meant a set number of months, add that.',
      read
    );
  }

  if ((read.cues.oneTimeCost || read.cues.purchase) && read.moneys[0] && !read.cues.payTalk) {
    const buy = read.moneys.find((m) => m.role === 'purchase') ?? read.moneys[0];
    extracted.kind = 'purchase';
    extracted.oneTimePurchase =
      buy.period === 'month' || buy.period === 'week' || buy.period === 'hour' ? buy.monthly : buy.amount;
    extracted.summary = `A one-time cost of ${describeMoney(buy)}.`;
    return high(
      extracted,
      `I read this as: a one-time hit of ${describeMoney(buy)} against leftover and savings. Not a new paycheck.`,
      read
    );
  }

  if (read.percents[0] != null && (read.cues.raiseTalk || read.cues.payTalk) && !read.cues.invest) {
    const pct = read.percents[0];
    const down = read.polarity === 'down' || pct < 0;
    if (!down && read.polarity === 'none' && !read.cues.raiseTalk) {
      return unclear(
        question,
        read,
        `I found ${Math.round(Math.abs(pct) * 100)}% next to pay, but not whether take-home goes up or down.`,
        ['Say “decreases by 15%” or “a 15% raise” so the direction is in the question.']
      );
    }
    extracted.kind = down ? 'pay-cut' : 'raise';
    extracted.currentIncomeMonthly = q.monthlyIncome;
    extracted.percentChange = down ? -Math.abs(pct) : Math.abs(pct);
    const shown = Math.round(Math.abs(extracted.percentChange) * 100);
    extracted.summary = down ? `A ${shown}% pay cut.` : `A ${shown}% raise.`;
    return high(
      extracted,
      down
        ? `I read this as: take-home falls ${shown}%, not a raise. The leftover uses your saved bills after that smaller paycheck.`
        : `I read this as: take-home rises ${shown}%. The leftover uses your saved bills after that bigger paycheck.`,
      read
    );
  }

  if (read.cues.recession && read.moneys.length === 0 && read.percents.length === 0) {
    return unclear(
      question,
      read,
      'I read recession as a squeeze on money, but not how much pay or spending changes.',
      ['Add a size, like salary decreases by 15%, or hours cut for 3 months.']
    );
  }

  if (read.cues.payTalk && read.moneys[0] && !read.durationMonths) {
    const amount = read.moneys[0];
    const extra = read.cues.extraTalk || amount.role === 'extra';
    extracted.kind = extra ? 'extra-income' : read.cues.raiseTalk ? 'raise' : 'job-change';
    extracted.currentIncomeMonthly = q.monthlyIncome;
    extracted.newIncomeMonthly = extra ? q.monthlyIncome + amount.monthly : amount.monthly;
    extracted.extraIncomeMonthly = extra ? amount.monthly : null;
    if (!extra && Math.abs(amount.monthly - q.monthlyIncome) < 1) {
      return unclear(
        question,
        read,
        `I found ${describeMoney(amount)}, which matches your saved take-home, so a pay-change would be $0. That usually means I used one number as the new pay and ignored a second number, or the question only had one amount.`,
        ['Say both amounts, like from 60k to 80k.', 'Or say extra $X if this is on top of current pay.']
      );
    }
    return high(
      extracted,
      extra
        ? `I read this as: add ${describeMoney(amount)} on top of your saved take-home.`
        : `I read this as: replace take-home with ${describeMoney(amount)}. Your saved bills stay. If that amount is current pay, say the new pay too.`,
      read
    );
  }

  if (read.cues.purchase && read.moneys[0]) {
    const buy = read.moneys.find((m) => m.role === 'purchase') ?? read.moneys[0];
    extracted.kind = 'purchase';
    extracted.oneTimePurchase =
      buy.period === 'month' || buy.period === 'week' || buy.period === 'hour' ? buy.monthly : buy.amount;
    extracted.summary = `A one-time purchase of ${describeMoney(buy)}.`;
    return high(extracted, `I read this as: can ${describeMoney(buy)} fit leftover and savings.`, read);
  }

  if (read.cues.invest) {
    extracted.kind = 'invest';
    extracted.investMonthly = read.moneys[0]?.monthly ?? leftover;
    extracted.investAnnualRate = read.percents[0] ?? 0.07;
    extracted.summary = 'Hypothetical compounding.';
    return high(
      extracted,
      `I read this as: hypothetical monthly contribution at ${Math.round((extracted.investAnnualRate ?? 0.07) * 100)}%. Not a product.`,
      read
    );
  }

  if (read.cues.housing && read.moneys[0]) {
    const rent = read.moneys.find((m) => m.role === 'rent') ?? read.moneys[0];
    extracted.kind = 'rent-change';
    extracted.rentMonthly = read.polarity === 'down' ? -Math.abs(rent.monthly) : rent.monthly;
    extracted.rentIsDelta =
      read.polarity !== 'none' || /\b(up|more|increase|raise|extra|down)\b/.test(read.text);
    extracted.summary = 'Housing cost changes.';
    return high(
      extracted,
      read.polarity === 'down'
        ? `I read this as: housing goes down by ${describeMoney(rent)}.`
        : extracted.rentIsDelta
          ? `I read this as: housing goes up by ${describeMoney(rent)}.`
          : `I read this as: housing becomes ${describeMoney(rent)}.`,
      read
    );
  }

  if (read.cues.debt) {
    extracted.kind = 'debt-pay';
    extracted.debtExtraMonthly = read.moneys[0]?.monthly ?? 100;
    extracted.summary = 'Extra toward debt.';
    return high(extracted, 'I read this as: extra payment toward the saved debt balance.', read);
  }

  if (read.cues.cut && read.moneys[0]) {
    extracted.kind = 'cut-habit';
    extracted.cutMonthly = read.moneys[0].monthly;
    extracted.summary = 'Stopping a repeating spend.';
    return high(extracted, `I read this as: that repeating spend of ${describeMoney(read.moneys[0])} stops.`, read);
  }

  if (read.cues.save && read.moneys[0]) {
    extracted.kind = 'extra-save';
    extracted.saveMonthly = read.moneys[0].monthly;
    extracted.summary = 'Parking more each month.';
    return high(extracted, `I read this as: move ${describeMoney(read.moneys[0])} into savings each month.`, read);
  }

  if (read.cues.inflation) {
    extracted.kind = 'inflation';
    extracted.inflationRate = read.percents[0];
    extracted.summary = 'Prices rise.';
    return high(extracted, 'I read this as: prices go up against your leftover.', read);
  }

  if (read.cues.breakdown) {
    extracted.kind = 'breakdown';
    extracted.summary = 'Where the month goes.';
    return high(extracted, 'I read this as: show where this month of saved numbers goes.', read);
  }

  if (read.cues.runway) {
    extracted.kind = 'runway';
    extracted.pauseMonths = read.durationMonths;
    extracted.summary = 'How long the stash lasts.';
    return high(extracted, 'I read this as: how long savings cover essentials if pay stops.', read);
  }

  if (read.durationMonths && read.moneys.length === 0 && read.unknownNumbers.length === 0) {
    return unclear(
      question,
      read,
      `I found ${read.durationMonths} months of time and no dollar amounts. I will not turn ${read.durationMonths} into $${read.durationMonths}.`,
      [
        'If pay stops for that stretch, say that (cannot work, no paycheck).',
        'If this is extra cost or extra pay, add a $ amount.',
      ]
    );
  }

  if (read.moneys.length === 0) {
    return unclear(
      question,
      read,
      read.unknownNumbers.length
        ? `I saw number(s) ${read.unknownNumbers.join(', ')} but not as money (no $, no k, and not next to dollars/pay/rent/buy words). I did not invent a dollar amount.`
        : 'I did not find a dollar amount, a from/to pay change, or a clear money action.',
      ['Add amounts like from 60k to 80k, $200 rent, or no paycheck for 3 months.']
    );
  }

  return unclear(
    question,
    read,
    `I found money (${read.moneys.map(describeMoney).join('; ')}) but not a clear action (job, raise, buy, rent, debt, save, cut, invest). I will not pick a calculator and hope.`,
    ['Name the action: raise, new job, buy, rent, debt, save, or cut.']
  );
}

export function clarificationResult(question: string, understood: UnderstoodQuestion): WhatIfResult {
  return {
    kind: 'general',
    title: 'Need a clearer read before the math',
    prompt: question,
    body: understood.missing.join(' ') || 'Ask it again with the missing piece above.',
    monthlyDelta: 0,
    hypothetical: false,
    disclaimer: 'No calculation yet. Not financial advice.',
    rows: understood.missing.map((item, index) => ({
      label: understood.missing.length > 1 ? `Need ${index + 1}` : 'Need',
      value: item,
    })),
    horizons: [],
    understoodAs: understood.understoodAs,
    needsClarification: true,
    source: 'rules',
  };
}
