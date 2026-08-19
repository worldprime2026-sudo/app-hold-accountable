import { leftoverMonthly } from '@/lib/money-math';
import type { Questionnaire, WhatIfKind } from '@/lib/types';

export type ExtractedScenario = {
  kind: WhatIfKind;
  summary: string;
  currentIncomeMonthly: number | null;
  newIncomeMonthly: number | null;
  extraIncomeMonthly: number | null;
  cutMonthly: number | null;
  saveMonthly: number | null;
  oneTimePurchase: number | null;
  rentMonthly: number | null;
  rentIsDelta: boolean;
  debtExtraMonthly: number | null;
  investMonthly: number | null;
  investAnnualRate: number | null;
  percentChange: number | null;
  goalAmount: number | null;
  inflationRate: number | null;
  pauseMonths: number | null;
};

const KINDS: WhatIfKind[] = [
  'job-change',
  'raise',
  'pay-cut',
  'extra-income',
  'cut-habit',
  'extra-save',
  'debt-pay',
  'invest',
  'purchase',
  'runway',
  'scarcity',
  'breakdown',
  'time-to-goal',
  'rent-change',
  'inflation',
  'general',
];

export function hasLanguageModel() {
  return Boolean(process.env.EXPO_PUBLIC_OPENAI_API_KEY);
}

function profileForModel(q: Questionnaire) {
  const leftover = leftoverMonthly(q);
  return {
    monthlyTakeHome: q.monthlyIncome,
    yearlyTakeHomeIfMonthlyTimes12: q.monthlyIncome * 12,
    housing: q.housing,
    otherBills: q.otherBills,
    treats: q.funMoney,
    leftover,
    savings: q.savings,
    debt: q.hasDebt ? q.debtAmount : 0,
    debtMinPayment: q.hasDebt ? q.debtMinPayment : 0,
    moneyMood: q.moneyMood,
  };
}

export async function extractScenario(
  question: string,
  q: Questionnaire,
  tokens?: Record<string, unknown>
): Promise<ExtractedScenario | null> {
  const apiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
  if (!apiKey) return null;

  const baseUrl = (process.env.EXPO_PUBLIC_OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
  const model = process.env.EXPO_PUBLIC_OPENAI_MODEL || 'gpt-4o-mini';

  const system = `You convert a money question into JSON for a calculator. You do not give advice. You do not invent numbers.

Rules:
- Convert every money amount to MONTHLY USD in the JSON fields.
- "40k a year" or "40k" as salary = 40000/12 = 3333.33 monthly.
- "80k" as a job/salary = 80000/12 = 6666.67 monthly.
- k means thousand. 80k = 80000.
- If the user states current pay IN THE QUESTION, put that in currentIncomeMonthly. Do not use the profile pay for current if they overrode it.
- If they also state a new job/new pay, put that in newIncomeMonthly.
- NEVER swap now vs new. In "right now I earn 40k, what if I earn 80k", current=3333.33 and new=6666.67.
- If they say "more" or "extra $X", that is extraIncomeMonthly, not a replacement salary.
- Percents are SIGNED. "15% raise" or "increases by 15%" → percentChange 0.15. "decreases by 15%", "pay cut 15%", "recession and salary down 15%" → percentChange -0.15 and kind "pay-cut". Never call a decrease a raise.
- Hypothetical investing: investMonthly + investAnnualRate as a decimal (7% = 0.07).
- One-time buys go in oneTimePurchase, not monthly.
- A number next to months/years/weeks/days is DURATION. Put it in pauseMonths. Never treat 3 months as $3 or $3/mo.
- "cannot work", "no payroll", "accident", "lose my job for N months" with no new salary → kind "scarcity", pauseMonths set.
- If a token summary is provided, trust it over guessing. Do not invent money from duration or unknown numbers.
- Return JSON only, matching the schema. No markdown.

Schema:
{"kind":"job-change|raise|pay-cut|extra-income|cut-habit|extra-save|debt-pay|invest|purchase|runway|scarcity|breakdown|time-to-goal|rent-change|inflation|general","summary":"string","currentIncomeMonthly":number|null,"newIncomeMonthly":number|null,"extraIncomeMonthly":number|null,"cutMonthly":number|null,"saveMonthly":number|null,"oneTimePurchase":number|null,"rentMonthly":number|null,"rentIsDelta":boolean,"debtExtraMonthly":number|null,"investMonthly":number|null,"investAnnualRate":number|null,"percentChange":number|null,"goalAmount":number|null,"inflationRate":number|null,"pauseMonths":number|null}`;

  const user = `Saved profile (monthly USD): ${JSON.stringify(profileForModel(q))}

Already classified tokens (trust these; duration is not money): ${JSON.stringify(tokens ?? {})}

Question: ${question}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25000);

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }),
      signal: controller.signal,
    });
    if (!response.ok) return null;
    const json = (await response.json()) as { choices?: { message?: { content?: string } }[] };
    const content = json.choices?.[0]?.message?.content;
    if (!content) return null;
    return normalizeExtracted(JSON.parse(content));
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const n = Number(value.replace(/[^0-9.-]/g, ''));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function normalizeExtracted(raw: Record<string, unknown>): ExtractedScenario {
  const kind = KINDS.includes(raw.kind as WhatIfKind) ? (raw.kind as WhatIfKind) : 'general';
  return {
    kind,
    summary: typeof raw.summary === 'string' ? raw.summary : 'Money question',
    currentIncomeMonthly: asNumber(raw.currentIncomeMonthly),
    newIncomeMonthly: asNumber(raw.newIncomeMonthly),
    extraIncomeMonthly: asNumber(raw.extraIncomeMonthly),
    cutMonthly: asNumber(raw.cutMonthly),
    saveMonthly: asNumber(raw.saveMonthly),
    oneTimePurchase: asNumber(raw.oneTimePurchase),
    rentMonthly: asNumber(raw.rentMonthly),
    rentIsDelta: Boolean(raw.rentIsDelta),
    debtExtraMonthly: asNumber(raw.debtExtraMonthly),
    investMonthly: asNumber(raw.investMonthly),
    investAnnualRate: asNumber(raw.investAnnualRate),
    percentChange: asNumber(raw.percentChange),
    goalAmount: asNumber(raw.goalAmount),
    inflationRate: asNumber(raw.inflationRate),
    pauseMonths: asNumber(raw.pauseMonths) ?? asNumber(raw.durationMonths),
  };
}
