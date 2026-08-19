import { computeFromExtract } from '@/lib/money-compute';
import { extractScenario, hasLanguageModel } from '@/lib/money-extract';
import { tokenSummary } from '@/lib/read-question';
import { clarificationResult, understandQuestion } from '@/lib/understand-question';
import type { ExtractedScenario } from '@/lib/money-extract';
import type { Questionnaire, WhatIfResult } from '@/lib/types';

function groundExtracted(extracted: ExtractedScenario, understood: ReturnType<typeof understandQuestion>): ExtractedScenario {
  const read = understood.read;
  const next = { ...extracted };

  if (read.durationMonths != null && next.newIncomeMonthly != null) {
    const dur = read.durationMonths;
    if (Math.abs(next.newIncomeMonthly - dur) < 0.05 || Math.abs(next.newIncomeMonthly - dur / 12) < 0.05) {
      next.newIncomeMonthly = null;
    }
  }

  if (read.cues.incomeStop && read.durationMonths && read.moneys.length === 0) {
    next.kind = 'scarcity';
    next.pauseMonths = read.durationMonths;
    next.newIncomeMonthly = null;
    next.currentIncomeMonthly = null;
  }

  if (read.cues.oneTimeCost && next.kind === 'job-change' && read.moneys.length < 2) {
    next.kind = 'purchase';
    const buy = read.moneys[0];
    if (buy) {
      next.oneTimePurchase =
        buy.period === 'month' || buy.period === 'week' || buy.period === 'hour' ? buy.monthly : buy.amount;
      next.newIncomeMonthly = null;
    }
  }

  if (read.polarity === 'down' && next.percentChange != null && next.percentChange > 0) {
    next.percentChange = -next.percentChange;
    if (next.kind === 'raise') next.kind = 'pay-cut';
  }

  if (read.durationMonths != null && next.pauseMonths == null && next.kind === 'scarcity') {
    next.pauseMonths = read.durationMonths;
  }

  return next;
}

export async function askMoney(question: string, q: Questionnaire): Promise<WhatIfResult> {
  const local = understandQuestion(question, q);

  if (local.readyToCompute) {
    return {
      ...computeFromExtract(question, q, local.extracted),
      understoodAs: local.understoodAs,
      source: 'rules',
    };
  }

  if (hasLanguageModel()) {
    const extracted = await extractScenario(question, q, tokenSummary(local.read));
    if (extracted) {
      const grounded = groundExtracted(extracted, local);
      return {
        ...computeFromExtract(question, q, grounded),
        understoodAs: grounded.summary || local.understoodAs,
        source: 'ai',
      };
    }
  }

  return clarificationResult(question, local);
}

export { hasLanguageModel };
