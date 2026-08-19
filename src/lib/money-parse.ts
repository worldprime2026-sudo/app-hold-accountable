export type MoneyMention = {
  amount: number;
  monthly: number;
  index: number;
  window: string;
  period: 'year' | 'month' | 'week' | 'hour' | 'unknown';
};

const SPLIT =
  /\bwhat if\b|\bwhat happens if\b|\bsuppose i\b|\bimagine i\b|\binstead(?: of)?\b|\bversus\b|\b vs\.? \b|\bcompared to\b|\bswitch(?:ing)? to\b/i;

export function findMentions(text: string): { amount: number; index: number; raw: string }[] {
  const found: { amount: number; index: number; raw: string }[] = [];
  const re = /\$?\s*([0-9][0-9,]*(?:\.[0-9]+)?)\s*(k)?(?![0-9])/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    const after = text.slice(match.index + match[0].length).trimStart();
    if (after.startsWith('%')) continue;
    if (/^(months?|years?|weeks?|days?|hrs?|hours?)\b/i.test(after)) continue;
    if (/^(st|nd|rd|th)\b/i.test(after)) continue;
    let n = Number(match[1].replace(/,/g, ''));
    if (!Number.isFinite(n) || n <= 0) continue;
    if (match[2]) n *= 1000;
    found.push({ amount: n, index: match.index, raw: match[0] });
  }
  return found;
}

function windowOf(text: string, index: number, raw: string) {
  const start = Math.max(0, index - 36);
  const end = Math.min(text.length, index + raw.length + 36);
  return text.slice(start, end);
}

function periodFrom(window: string, amount: number): MoneyMention['period'] {
  if (/(hour|hourly|\/hr|an hour)/.test(window)) return 'hour';
  if (/(week|weekly|\/wk)/.test(window)) return 'week';
  if (/(year|annual|salary|\/yr|\/year| a year|per year)/.test(window)) return 'year';
  if (/(month|monthly|\/mo|a month|per month)/.test(window)) return 'month';
  if (amount >= 20000) return 'year';
  if (amount >= 200 && amount <= 15000) return 'month';
  return 'unknown';
}

export function toMonthly(amount: number, period: MoneyMention['period']) {
  if (period === 'hour') return amount * 173.2;
  if (period === 'week') return amount * 4.345;
  if (period === 'year') return amount / 12;
  return amount;
}

export function findDurationMonths(text: string): number | null {
  const numeric = text.match(/\b(\d+(?:\.\d+)?)\s*(months?|years?|weeks?|days?)\b/i);
  if (numeric) {
    const n = Number(numeric[1]);
    const unit = numeric[2].toLowerCase();
    if (unit.startsWith('year')) return n * 12;
    if (unit.startsWith('week')) return n / 4.345;
    if (unit.startsWith('day')) return n / 30.44;
    return n;
  }

  const words: [RegExp, number][] = [
    [/\b(a|one) month\b/i, 1],
    [/\btwo months\b/i, 2],
    [/\bthree months\b/i, 3],
    [/\bfour months\b/i, 4],
    [/\bfive months\b/i, 5],
    [/\bsix months\b/i, 6],
    [/\bnine months\b/i, 9],
    [/\ba year\b/i, 12],
    [/\bone year\b/i, 12],
    [/\btwo years\b/i, 24],
  ];
  for (const [pattern, months] of words) {
    if (pattern.test(text)) return months;
  }
  return null;
}

export function mentionsWithPay(text: string): MoneyMention[] {
  return findMentions(text).map((item) => {
    const window = windowOf(text, item.index, item.raw);
    const period = periodFrom(window, item.amount);
    return {
      amount: item.amount,
      monthly: toMonthly(item.amount, period),
      index: item.index,
      window,
      period,
    };
  });
}

export function splitNowVsThen(text: string) {
  const match = text.match(SPLIT);
  if (!match || match.index == null) return null;
  if (match.index < 4) return null;
  return {
    now: text.slice(0, match.index).trim(),
    then: text.slice(match.index + match[0].length).trim(),
    pivot: match[0],
  };
}

export function looksLikePayChange(text: string) {
  const mentions = findMentions(text);
  const payWords = /\b(job|salary|wage|paycheck|earn|earning|make|making|raise|promotion|offer|workplace|employer|paid|income)\b/.test(
    text
  );
  if (SPLIT.test(text) && mentions.length >= 1 && payWords) return true;
  if (/(new job|change jobs|switch jobs|job offer|higher pay|better pay)/.test(text)) return true;
  if (payWords && mentions.length >= 2) return true;
  return false;
}

export function resolvePayChange(text: string, profileMonthly: number) {
  const notes: string[] = [
    'Yearly figures are divided by 12. If this is gross salary, take-home is usually less after tax. Not a tax calculation.',
  ];

  const fromIdx = text.search(/\bfrom\b/);
  const toIdx = text.search(/\bto\b/);
  const all = mentionsWithPay(text);

  if (fromIdx >= 0 && toIdx > fromIdx && all.length >= 2) {
    const from = all.find((m) => m.index >= fromIdx && m.index < toIdx);
    const to = all.find((m) => m.index > toIdx);
    if (from && to) {
      return { current: from.monthly, next: to.monthly, notes };
    }
  }

  if (toIdx >= 0 && all.length >= 2) {
    const before = all.find((m) => m.index < toIdx);
    const after = all.find((m) => m.index > toIdx);
    if (before && after) {
      return { current: before.monthly, next: after.monthly, notes };
    }
  }

  const split = splitNowVsThen(text);
  let current = profileMonthly;
  let next = profileMonthly;
  let usedQuestionCurrent = false;

  if (split) {
    const nowMentions = mentionsWithPay(split.now);
    const thenMentions = mentionsWithPay(split.then);

    if (nowMentions[0] && thenMentions[0]) {
      current = nowMentions[0].monthly;
      next = thenMentions[0].monthly;
      usedQuestionCurrent = true;
    } else if (!nowMentions[0] && thenMentions.length >= 2) {
      current = thenMentions[0].monthly;
      next = thenMentions[1].monthly;
      usedQuestionCurrent = true;
    } else if (thenMentions[0]) {
      next = thenMentions[0].monthly;
    } else if (nowMentions[1]) {
      current = nowMentions[0].monthly;
      next = nowMentions[1].monthly;
      usedQuestionCurrent = true;
    }
  } else if (all.length >= 2) {
    current = all[0].monthly;
    next = all[1].monthly;
    usedQuestionCurrent = true;
  } else if (all[0]) {
    const extra = /(more|extra|higher|increase|raise|bump)/.test(text);
    next = extra ? profileMonthly + all[0].monthly : all[0].monthly;
  }

  if (usedQuestionCurrent && Math.abs(current - profileMonthly) > 1) {
    notes.unshift(
      `Your question said current pay is ${Math.round(current * 12).toLocaleString('en-US')}/year (${current.toFixed(0)}/mo). Your saved profile still has ${profileMonthly.toFixed(0)}/mo. This answer uses the numbers you typed.`
    );
  }

  return { current, next, notes };
}
