export type MoneyMood = 'anxious' | 'avoidant' | 'chaotic' | 'curious' | 'fine';

export type MoneyGoal = 'emergency' | 'debt' | 'breathing-room' | 'dont-know' | 'future-flex';

export type CheckHabit = 'daily' | 'weekly' | 'monthly' | 'never';

export type ImpulseHabit = 'rarely' | 'sometimes' | 'often' | 'lifestyle';

export type Questionnaire = {
  name: string;
  moneyMood: MoneyMood;
  monthlyIncome: number;
  housing: number;
  otherBills: number;
  funMoney: number;
  hasDebt: boolean;
  debtAmount: number;
  debtMinPayment: number;
  savings: number;
  goal: MoneyGoal;
  checkAccounts: CheckHabit;
  impulse: ImpulseHabit;
};

export type InsightTone = 'roast' | 'strength' | 'pattern';

export type Insight = {
  tone: InsightTone;
  title: string;
  body: string;
};

export type MoneyProfile = {
  title: string;
  tagline: string;
  pulse: number;
  pulseLabel: string;
  leftover: number;
  totalBills: number;
  leakAnnual: number;
  insights: Insight[];
};

export type ProfileRow = {
  id: string;
  display_name: string | null;
  onboarding_completed: boolean;
  questionnaire: Questionnaire | null;
  money_profile: MoneyProfile | null;
  has_lifetime_access: boolean;
  questions_asked: number;
  xp: number;
  created_at: string;
  updated_at: string;
};

export type Horizon = {
  label: string;
  months: number;
  total: number;
};

export type WhatIfKind =
  | 'cut-habit'
  | 'extra-income'
  | 'job-change'
  | 'raise'
  | 'pay-cut'
  | 'extra-save'
  | 'debt-pay'
  | 'invest'
  | 'purchase'
  | 'runway'
  | 'scarcity'
  | 'breakdown'
  | 'time-to-goal'
  | 'rent-change'
  | 'inflation'
  | 'general';

export type AnswerRow = {
  label: string;
  value: string;
};

export type WhatIfResult = {
  kind: WhatIfKind;
  title: string;
  prompt: string;
  body: string;
  monthlyDelta: number;
  hypothetical: boolean;
  disclaimer: string;
  rows: AnswerRow[];
  horizons: Horizon[];
  extra?: string;
  source?: 'ai' | 'rules';
  understoodAs?: string;
  needsClarification?: boolean;
};

export type SavedScenario = {
  id: string;
  title: string;
  prompt: string;
  result: WhatIfResult;
  created_at: string;
};
