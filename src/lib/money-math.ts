export function leftoverMonthly(input: {
  monthlyIncome: number;
  housing: number;
  otherBills: number;
  funMoney: number;
  hasDebt: boolean;
  debtMinPayment: number;
}) {
  const debt = input.hasDebt ? input.debtMinPayment : 0;
  return input.monthlyIncome - input.housing - input.otherBills - input.funMoney - debt;
}

export function essentialBills(input: {
  housing: number;
  otherBills: number;
  hasDebt: boolean;
  debtMinPayment: number;
}) {
  return input.housing + input.otherBills + (input.hasDebt ? input.debtMinPayment : 0);
}

export function runwayMonths(savings: number, monthlyNeed: number) {
  if (savings <= 0) return 0;
  if (monthlyNeed <= 0) return Number.POSITIVE_INFINITY;
  return savings / monthlyNeed;
}

export function monthsToGoal(goal: number, monthly: number) {
  if (goal <= 0) return 0;
  if (monthly <= 0) return Number.POSITIVE_INFINITY;
  return goal / monthly;
}

export function purchasingPower(amount: number, annualInflation: number, years: number) {
  return amount / Math.pow(1 + annualInflation, years);
}

export function monthsToHorizon(months: number, monthlyAmount: number) {
  return monthlyAmount * months;
}

/** Ordinary annuity: contribute at the end of each month, compounded monthly. */
export function compoundMonthly(monthlyContribution: number, annualRate: number, years: number) {
  const n = Math.round(years * 12);
  const r = annualRate / 12;
  if (n <= 0) return 0;
  if (Math.abs(r) < 1e-12) return monthlyContribution * n;
  return monthlyContribution * ((Math.pow(1 + r, n) - 1) / r);
}

export function simplePayoffMonths(balance: number, monthlyPayment: number) {
  if (balance <= 0) return 0;
  if (monthlyPayment <= 0) return Number.POSITIVE_INFINITY;
  return Math.ceil(balance / monthlyPayment);
}

export const HORIZON_MONTHS = [
  { label: '1 month', months: 1 },
  { label: '1 year', months: 12 },
  { label: '5 years', months: 60 },
  { label: '10 years', months: 120 },
] as const;
