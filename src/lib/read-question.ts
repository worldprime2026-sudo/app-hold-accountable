import { toMonthly, type MoneyMention } from '@/lib/money-parse';

export type MoneyRole =
  | 'from'
  | 'to'
  | 'current'
  | 'next'
  | 'extra'
  | 'purchase'
  | 'rent'
  | 'debt'
  | 'cut'
  | 'save'
  | 'invest'
  | 'unlabeled';

export type MoneySpan = MoneyMention & { role: MoneyRole };

export type Polarity = 'up' | 'down' | 'none';

export type QuestionCues = {
  incomeStop: boolean;
  payTalk: boolean;
  raiseTalk: boolean;
  extraTalk: boolean;
  purchase: boolean;
  oneTimeCost: boolean;
  invest: boolean;
  debt: boolean;
  housing: boolean;
  save: boolean;
  cut: boolean;
  runway: boolean;
  inflation: boolean;
  breakdown: boolean;
  recession: boolean;
};

export type QuestionRead = {
  text: string;
  moneys: MoneySpan[];
  durationMonths: number | null;
  percents: number[];
  unknownNumbers: number[];
  polarity: Polarity;
  cues: QuestionCues;
  fromTo: { from: MoneySpan; to: MoneySpan } | null;
  nowThen: { current: MoneySpan; next: MoneySpan } | null;
};

const PIVOT =
  /\bwhat if\b|\bwhat happens if\b|\bsuppose i\b|\bimagine i\b|\binstead(?: of)?\b|\bversus\b|\b vs\.? \b|\bcompared to\b|\bswitch(?:ing)? to\b/i;

const DURATION_UNIT = /^(months?|years?|weeks?|days?|hrs?|hours?)\b/i;
const PERCENT_WORD = /^(percent|percentage|%)\b/i;
const ORDINAL = /^(st|nd|rd|th)\b/i;

const CURRENCY_WORD = /^(dollars?|usd|us\$|bucks|cash)\b/i;
const CURRENCY_BEFORE = /\b(dollars?|usd|us\$|bucks|cash)\s*$/i;
const ONE_TIME_WINDOW =
  /\b(unexpected|expense|expenses|bill|bills|fee|fees|charge|charges|repair|repairs|one-time|one time|copay|er visit)\b/;
const MONEY_CONTEXT =
  /\b(salary|wage|paycheck|payroll|income|earn|earning|make|making|offer|job|rent|mortgage|housing|afford|buy|purchase|cost|price|save|stash|debt|loan|owe|dollars?|usd|bucks|cash|paid|spend|spending|expense|expenses|bill|bills|fee|fees|coffee|latte|subscription|invest|fund|car|phone|raise|promotion)\b|\$/;

const WORD_MONTHS: [RegExp, number][] = [
  [/\b(a|one) month\b/i, 1],
  [/\btwo months\b/i, 2],
  [/\bthree months\b/i, 3],
  [/\bfour months\b/i, 4],
  [/\bfive months\b/i, 5],
  [/\bsix months\b/i, 6],
  [/\bseven months\b/i, 7],
  [/\beight months\b/i, 8],
  [/\bnine months\b/i, 9],
  [/\bten months\b/i, 10],
  [/\beleven months\b/i, 11],
  [/\b(a|one) year\b/i, 12],
  [/\btwo years\b/i, 24],
];

function has(text: string, re: RegExp) {
  return re.test(text);
}

function windowOf(text: string, index: number, raw: string) {
  const start = Math.max(0, index - 40);
  const end = Math.min(text.length, index + raw.length + 40);
  return text.slice(start, end);
}

function periodFrom(window: string, amount: number): MoneyMention['period'] {
  if (/(hour|hourly|\/hr|an hour)/.test(window)) return 'hour';
  if (/(week|weekly|\/wk)/.test(window)) return 'week';
  if (/(year|annual|salary|\/yr|\/year| a year|per year)/.test(window)) return 'year';
  if (/(month|monthly|\/mo|a month|per month)/.test(window)) return 'month';
  if (ONE_TIME_WINDOW.test(window) || /\b(have to pay|need to pay|must pay|pay for)\b/.test(window)) {
    return 'unknown';
  }
  if (amount >= 20000) return 'year';
  if (amount >= 200 && amount <= 15000) return 'month';
  return 'unknown';
}

function numericDurations(text: string) {
  const found: { months: number; index: number }[] = [];
  const re = /\b(\d+(?:\.\d+)?)\s*(months?|years?|weeks?|days?)\b/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    const n = Number(match[1]);
    const unit = match[2].toLowerCase();
    let months = n;
    if (unit.startsWith('year')) months = n * 12;
    else if (unit.startsWith('week')) months = n / 4.345;
    else if (unit.startsWith('day')) months = n / 30.44;
    found.push({ months, index: match.index });
  }
  return found;
}

function wordDuration(text: string) {
  for (const [pattern, months] of WORD_MONTHS) {
    const match = text.match(pattern);
    if (match && match.index != null) return { months, index: match.index };
  }
  return null;
}

function scanPercents(text: string) {
  return [...text.matchAll(/([0-9]+(?:\.[0-9]+)?)\s*(?:%|percent\b)/gi)].map((m) => Number(m[1]) / 100);
}

const DOWN_RE =
  /\b(decrease|decreases|decreased|decreasing|drop|drops|dropped|dropping|fall|falls|fell|falling|shrink|shrunk|lower|lowers|reduced|reduces|reduce|reduction|downturn|recession|slump|pay\s*cut|cut\s+in|cuts?\s+my\s+(pay|salary|income|hours)|lose|loses|losing|lost)\b/gi;
const UP_RE =
  /\b(increase|increases|increased|increasing|raise|raises|raised|raising|promotion|higher|boost|grow|grows|growth|bump|pay raise)\b/gi;

function polarityOf(text: string, around: number | null = null): Polarity {
  const tokens: { dir: Polarity; index: number }[] = [];
  for (const match of text.matchAll(DOWN_RE)) {
    if (match.index != null) tokens.push({ dir: 'down', index: match.index });
  }
  for (const match of text.matchAll(UP_RE)) {
    if (match.index != null) tokens.push({ dir: 'up', index: match.index });
  }
  if (!tokens.length) return 'none';
  if (around == null) {
    const downs = tokens.filter((t) => t.dir === 'down');
    const ups = tokens.filter((t) => t.dir === 'up');
    if (downs.length && !ups.length) return 'down';
    if (ups.length && !downs.length) return 'up';
    return [...tokens].sort((a, b) => b.index - a.index)[0].dir;
  }
  return [...tokens].sort((a, b) => Math.abs(a.index - around) - Math.abs(b.index - around))[0].dir;
}

function readCues(text: string): QuestionCues {
  const negation = has(
    text,
    /\b(no|without|cannot|can't|cant|can not|stop|stopped|lost|lose|losing|zero|none|not getting)\b|\b(don't|dont|do not)\s+(get|getting|have|receive|work)\b/
  );
  const workIncome = has(
    text,
    /\b(payroll|paycheck|paychecks|salary|income|wages?|job|work|working)\b|\b(no pay|without pay|not getting paid)\b/
  );
  const harm = has(
    text,
    /\b(accident|injured|injury|disability|hospital|laid off|unemployed|fired|sick leave)\b/
  );

  return {
    incomeStop: harm || (negation && workIncome),
    payTalk: has(
      text,
      /\b(job|salary|wage|paycheck|payroll|earn|earning|raise|promotion|offer|employer|income|get paid|got paid|pay me|pays me)\b/
    ),
    raiseTalk: has(text, /\b(raise|promotion|percent more|%\s*more|%\s*raise)\b/),
    extraTalk: has(text, /\b(more|extra|additional|higher|increase|bump)\b/),
    purchase: has(text, /\b(afford|buy|purchase|spend on|one-time|one time|car|phone|laptop|trip|vacation|wedding|deposit)\b/),
    oneTimeCost: has(
      text,
      /\b(unexpected|expense|expenses|bill|bills|fee|fees|charge|charges|repair|repairs|copay)\b|\b(have to pay|need to pay|got to pay|gotta pay|must pay|have to spend|need to spend|pay for|pay a)\b/
    ),
    invest: has(text, /\b(invest|compound|return|stock|market|interest rate)\b/),
    debt: has(text, /\b(debt|owe|loan|credit card|pay off|payoff|toward|towards)\b/),
    housing: has(text, /\b(rent|landlord|mortgage|housing)\b/),
    save: has(text, /\b(save|stash|put away|emergency fund)\b/),
    cut: has(text, /\b(stop buying|cut|quit|skip|coffee|latte|subscription)\b/),
    runway: has(text, /\b(how long|runway|survive|last if|broke)\b/),
    inflation: has(text, /\b(inflation|prices go up|cost of living)\b/),
    breakdown: has(text, /\b(where does my money|breakdown|budget|leftover|how am i doing)\b/),
    recession: has(text, /\b(recession|downturn|depression|slump|economy (crashes|tanks|collapses))\b/),
  };
}

function assignRoles(text: string, moneys: MoneySpan[], cues: QuestionCues): MoneySpan[] {
  const fromIdx = text.search(/\bfrom\b/);
  const toIdx = text.search(/\bto\b/);
  const vsIdx = text.search(/\bvs\.?\b|\bversus\b/);

  const tagged = moneys.map((m) => ({ ...m }));

  if (fromIdx >= 0 && toIdx > fromIdx) {
    const from = tagged.find((m) => m.index >= fromIdx && m.index < toIdx);
    const to = tagged.find((m) => m.index > toIdx);
    if (from) from.role = 'from';
    if (to) to.role = 'to';
  } else if (toIdx >= 0) {
    const before = tagged.find((m) => m.index < toIdx);
    const after = tagged.find((m) => m.index > toIdx);
    if (before && after) {
      before.role = 'from';
      after.role = 'to';
    }
  } else if (vsIdx >= 0) {
    const before = tagged.find((m) => m.index < vsIdx);
    const after = tagged.find((m) => m.index > vsIdx);
    if (before && after) {
      before.role = 'from';
      after.role = 'to';
    }
  }

  const pivot = text.match(PIVOT);
  if (pivot?.index != null && pivot.index >= 4) {
    const before = tagged.filter((m) => m.index < pivot.index);
    const after = tagged.filter((m) => m.index >= pivot.index);
    if (before[0] && after[0]) {
      if (before[0].role === 'unlabeled') before[0].role = 'current';
      if (after[0].role === 'unlabeled') after[0].role = 'next';
    }
  }

  for (const item of tagged) {
    if (item.role !== 'unlabeled') continue;
    const w = item.window;
    if (cues.extraTalk && /(more|extra|additional|higher|increase|bump)/.test(w)) item.role = 'extra';
    else if (
      (cues.oneTimeCost || cues.purchase) &&
      /(afford|buy|purchase|cost|price|spend|pay|expense|bill|fee|unexpected)/.test(w)
    )
      item.role = 'purchase';
    else if (cues.housing && /(rent|mortgage|housing|landlord)/.test(w)) item.role = 'rent';
    else if (cues.debt && /(debt|owe|loan|pay off|payoff|toward)/.test(w)) item.role = 'debt';
    else if (cues.cut && /(cut|quit|skip|coffee|latte|subscription)/.test(w)) item.role = 'cut';
    else if (cues.save && /(save|stash|put away)/.test(w)) item.role = 'save';
    else if (cues.invest && /(invest|compound|return)/.test(w)) item.role = 'invest';
    else if (/(now|currently|right now|i earn|i make|i get)/.test(w)) item.role = 'current';
    else if (/(new|offer|would earn|switch|instead|if i)/.test(w)) item.role = 'next';
  }

  return tagged;
}

function pairFromTo(moneys: MoneySpan[]) {
  const from = moneys.find((m) => m.role === 'from');
  const to = moneys.find((m) => m.role === 'to');
  if (from && to) return { from, to };
  return null;
}

function pairNowThen(moneys: MoneySpan[]) {
  const current = moneys.find((m) => m.role === 'current');
  const next = moneys.find((m) => m.role === 'next');
  if (current && next) return { current, next };
  return null;
}

export function describeMoney(span: MoneySpan) {
  const yearly = span.period === 'year' || span.amount >= 20000;
  if (yearly) return `${Math.round(span.amount).toLocaleString('en-US')}/year (${Math.round(span.monthly).toLocaleString('en-US')}/mo)`;
  if (span.period === 'month') return `${Math.round(span.monthly).toLocaleString('en-US')}/mo`;
  return `${Math.round(span.amount).toLocaleString('en-US')}`;
}

export function tokenSummary(read: QuestionRead) {
  return {
    moneyAmounts: read.moneys.map((m) => ({
      rawAmount: m.amount,
      monthly: Math.round(m.monthly * 100) / 100,
      period: m.period,
      role: m.role,
    })),
    durationMonths: read.durationMonths,
    percents: read.percents,
    polarity: read.polarity,
    unknownNumbers: read.unknownNumbers,
    incomeStop: read.cues.incomeStop,
    payTalk: read.cues.payTalk,
  };
}

export function readQuestion(question: string): QuestionRead {
  const text = question.trim().toLowerCase();
  const rawPercents = scanPercents(text);
  const pctAt = text.search(/[0-9]+(?:\.[0-9]+)?\s*(?:%|percent\b)/);
  const polarity = polarityOf(text, pctAt >= 0 ? pctAt : null);
  const percents = rawPercents.map((p) => (polarity === 'down' ? -Math.abs(p) : Math.abs(p)));
  const durations = numericDurations(text);
  const spoken = wordDuration(text);
  const durationMonths = durations[0]?.months ?? spoken?.months ?? null;

  const moneys: MoneySpan[] = [];
  const unknownNumbers: number[] = [];
  const re = /\$?\s*([0-9][0-9,]*(?:\.[0-9]+)?)\s*(k)?(?![a-z0-9])/gi;
  let match: RegExpExecArray | null;

  while ((match = re.exec(text)) !== null) {
    const after = text.slice(match.index + match[0].length).trimStart();
    if (after.startsWith('%') || PERCENT_WORD.test(after)) continue;
    if (DURATION_UNIT.test(after)) continue;
    if (ORDINAL.test(after)) continue;

    let n = Number(match[1].replace(/,/g, ''));
    if (!Number.isFinite(n) || n <= 0) continue;
    if (match[2]) n *= 1000;

    const raw = match[0];
    const window = windowOf(text, match.index, raw);
    const hasDollar = raw.includes('$');
    const hasK = Boolean(match[2]);

    if (!hasDollar && !hasK && n < 100 && has(window, /\b(raise|promotion)\b/) && !has(window, /\b(dollars?|usd|bucks|cash|\$)\b/)) {
      percents.push(n / 100);
      continue;
    }

    const before = text.slice(Math.max(0, match.index - 16), match.index);
    const hasCurrencyWord = CURRENCY_WORD.test(after) || CURRENCY_BEFORE.test(before);
    const looksMoney = hasDollar || hasK || hasCurrencyWord || n >= 1000 || MONEY_CONTEXT.test(window);
    if (!looksMoney) {
      unknownNumbers.push(n);
      continue;
    }

    const period = periodFrom(window, n);
    moneys.push({
      amount: n,
      monthly: toMonthly(n, period),
      index: match.index,
      window,
      period,
      role: 'unlabeled',
    });
  }

  const cues = readCues(text);
  const roleMoneys = assignRoles(text, moneys, cues);

  return {
    text,
    moneys: roleMoneys,
    durationMonths,
    percents: percents.map((p) => (polarity === 'down' ? -Math.abs(p) : p)),
    unknownNumbers,
    polarity,
    cues,
    fromTo: pairFromTo(roleMoneys),
    nowThen: pairNowThen(roleMoneys),
  };
}
