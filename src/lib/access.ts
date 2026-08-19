export const FREE_QUESTIONS = 3;

export type AccessProfile = {
  has_lifetime_access?: boolean | null;
  questions_asked?: number | null;
};

function askedKey(userId: string) {
  return `money-playground:questions-asked:${userId}`;
}

function memoryStorage(): Storage | null {
  try {
    if (typeof globalThis === 'undefined') return null;
    const store = (globalThis as { localStorage?: Storage }).localStorage;
    return store ?? null;
  } catch {
    return null;
  }
}

export function readLocalAsked(userId: string | undefined) {
  if (!userId) return 0;
  const raw = memoryStorage()?.getItem(askedKey(userId));
  const n = raw == null ? 0 : Number(raw);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function writeLocalAsked(userId: string, count: number) {
  try {
    memoryStorage()?.setItem(askedKey(userId), String(Math.max(0, count)));
  } catch {
    // Private mode can block storage. Session state still gates this visit.
  }
}

export function questionsAsked(profile: AccessProfile | null | undefined) {
  return profile?.questions_asked ?? 0;
}

export function effectiveQuestionsAsked(
  profile: AccessProfile | null | undefined,
  userId?: string,
  sessionAsked = 0
) {
  return Math.max(questionsAsked(profile), readLocalAsked(userId), sessionAsked);
}

export function questionsLeft(
  profile: AccessProfile | null | undefined,
  userId?: string,
  sessionAsked = 0
) {
  if (profile?.has_lifetime_access) return Infinity;
  return Math.max(0, FREE_QUESTIONS - effectiveQuestionsAsked(profile, userId, sessionAsked));
}

export function canAskQuestion(
  profile: AccessProfile | null | undefined,
  userId?: string,
  sessionAsked = 0
) {
  return questionsLeft(profile, userId, sessionAsked) > 0;
}
